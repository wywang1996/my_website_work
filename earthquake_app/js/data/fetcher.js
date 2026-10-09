/**
 * 多数据源拉取与合并
 * USGS / EMSC / CENC / JMA
 */

import { CFG } from "../config.js";
import { haversineKm } from "../utils/geo.js";

/* ============================================================
 *  单条记录归一化
 * ============================================================ */
function normalizeFeature(f, source) {
  const c = f.geometry && f.geometry.coordinates;
  if (!c || c.length < 2) return null;

  const p = f.properties || {};

  let time = p.time;
  if (typeof time === "string") time = new Date(time).getTime();
  if (typeof time !== "number" || !isFinite(time)) time = Date.now();

  const mag =
    typeof p.mag === "number"
      ? p.mag
      : typeof p.magnitude === "number"
        ? p.magnitude
        : 3.0;

  const url =
    p.url ||
    (source === "emsc" && p.unid
      ? `https://www.emsc-csem.org/Earthquake/earthquake.php?id=${p.unid}`
      : "https://earthquake.usgs.gov/earthquakes/map/");

  return {
    source,
    lat: c[1],
    lng: c[0],
    depth: c.length > 2 ? c[2] : null,
    mag,
    time,
    place: p.place || p.flynn_region || p.region || "未知地点",
    url,
    tsunami: p.tsunami === 1,
  };
}

/* ============================================================
 *  通用时间解析
 * ============================================================ */
function parseTime(str) {
  if (!str) return Date.now();
  const t = new Date(str).getTime();
  return isFinite(t) ? t : Date.now();
}

/* ============================================================
 *  USGS
 * ============================================================ */
async function fetchUSGS(start, end) {
  const url = new URL(CFG.sources.usgs);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("starttime", start.toISOString());
  url.searchParams.set("endtime", end.toISOString());
  url.searchParams.set("minmagnitude", String(CFG.minMagnitude));
  url.searchParams.set("orderby", "time");

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(`USGS HTTP ${r.status}`);
  const j = await r.json();
  return (j.features || [])
    .map((f) => normalizeFeature(f, "usgs"))
    .filter(Boolean);
}

/* ============================================================
 *  EMSC
 * ============================================================ */
async function fetchEMSC(start, end) {
  const url = new URL(CFG.sources.emsc);
  url.searchParams.set("format", "json");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("minmag", String(CFG.minMagnitude));

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(`EMSC HTTP ${r.status}`);
  const j = await r.json();
  const features = j.features || (Array.isArray(j) ? j : []);
  return features.map((f) => normalizeFeature(f, "emsc")).filter(Boolean);
}

/* ============================================================
 *  CENC（中国地震台网，通过 Wolfx 聚合）
 * ============================================================ */
async function fetchCENC() {
  const r = await fetch(CFG.sources.cenc, { cache: "no-store" });
  if (!r.ok) throw new Error(`CENC HTTP ${r.status}`);
  const j = await r.json();

  const items = Object.values(j).filter((v) => v && typeof v === "object");

  return items
    .map((item) => {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return null;

      return {
        source: "cenc",
        lat,
        lng,
        depth: parseFloat(item.depth) || null,
        mag: parseFloat(item.magnitude) || 3.0,
        time: parseTime(item.time),
        place: item.placeName || item.location || "中国区域",
        url: "https://news.ceic.ac.cn/",
        tsunami: false,
      };
    })
    .filter(Boolean);
}

/* ============================================================
 *  JMA（日本气象厅，通过 Wolfx 聚合）
 * ============================================================ */
async function fetchJMA() {
  const r = await fetch(CFG.sources.jma, { cache: "no-store" });
  if (!r.ok) throw new Error(`JMA HTTP ${r.status}`);
  const j = await r.json();

  const items = Object.values(j).filter((v) => v && typeof v === "object");

  return items
    .map((item) => {
      const h = item.hypocenter || item;
      const lat = parseFloat(h.latitude);
      const lng = parseFloat(h.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return null;

      return {
        source: "jma",
        lat,
        lng,
        depth: parseFloat(h.depth) || null,
        mag: parseFloat(h.magnitude) || 3.0,
        time: parseTime(item.time || item.originTime),
        place: item.placeName || h.name || "日本区域",
        url: "https://www.jma.go.jp/bosai/quake/",
        tsunami: false,
      };
    })
    .filter(Boolean);
}

/* ============================================================
 *  合并去重
 * ============================================================ */
function mergeAndDedupe(arr) {
  const sorted = arr.slice().sort((a, b) => a.time - b.time);
  const result = [];

  for (const p of sorted) {
    let dup = false;
    for (let i = result.length - 1; i >= 0 && i >= result.length - 30; i--) {
      const q = result[i];
      if (Math.abs(q.time - p.time) > 60000) break;
      if (haversineKm(p.lat, p.lng, q.lat, q.lng) < 100) {
        dup = true;
        break;
      }
    }
    if (!dup) result.push(p);
  }
  return result;
}

/* ============================================================
 *  并发拉取所有数据源
 * ============================================================ */
export async function fetchAllSources(start, end) {
  const results = await Promise.allSettled([
    fetchUSGS(start, end),
    fetchEMSC(start, end),
    fetchCENC(),
    fetchJMA(),
  ]);

  const merged = [];
  const sources = {
    usgs: { count: 0, ok: false },
    emsc: { count: 0, ok: false },
    cenc: { count: 0, ok: false },
    jma: { count: 0, ok: false },
  };

  const names = ["usgs", "emsc", "cenc", "jma"];

  results.forEach((r, idx) => {
    const name = names[idx];
    if (r.status === "fulfilled") {
      merged.push(...r.value);
      sources[name] = { count: r.value.length, ok: true };
    } else {
      console.warn(`[${name}] 拉取失败：`, r.reason);
    }
  });

  // CENC/JMA 返回最近 50 条，可能超出 30 天窗口，过滤一下
  const cutoff = Date.now() - CFG.daysBack * 86400000;
  const filtered = merged.filter((p) => p.time >= cutoff);

  return {
    points: mergeAndDedupe(filtered),
    sources,
  };
}
