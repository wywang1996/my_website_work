/**
 * 多数据源拉取与合并
 * - USGS：FDSN Event Web Service（GeoJSON）
 * - EMSC：European-Mediterranean Seismological Centre（GeoJSON）
 *
 * 两个数据源并发拉取，任一失败不影响另一个。
 * 拉取后按「时间 ±60s + 距离 <100km」判定重复并去重。
 */

import { CFG } from "../config.js";
import { haversineKm } from "../utils/geo.js";

/* ============================================================
 *  单条记录归一化：统一字段名
 * ============================================================ */
function normalizeFeature(f, source) {
  const c = f.geometry && f.geometry.coordinates;
  if (!c || c.length < 2) return null;

  const p = f.properties || {};

  // 时间可能是毫秒数或 ISO 字符串
  let time = p.time;
  if (typeof time === "string") time = new Date(time).getTime();
  if (typeof time !== "number" || !isFinite(time)) time = Date.now();

  // 震级字段命名兼容
  const mag =
    typeof p.mag === "number"
      ? p.mag
      : typeof p.magnitude === "number"
        ? p.magnitude
        : 3.0;

  // EMSC 详情页 URL 拼接
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
 *  USGS 拉取
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
 *  EMSC 拉取
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
 *  合并去重：时间 ±60s、距离 <100km 视为同一事件
 * ============================================================ */
function mergeAndDedupe(arr) {
  // 按时间升序，方便只与最近的 30 条比较
  const sorted = arr.slice().sort((a, b) => a.time - b.time);
  const result = [];

  for (const p of sorted) {
    let dup = false;
    // 倒序检查，只在时间窗口内的候选
    for (let i = result.length - 1; i >= 0 && i >= result.length - 30; i--) {
      const q = result[i];
      if (Math.abs(q.time - p.time) > 60000) break; // 超出 60s 窗口，后面更早，直接停
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
 *  对外接口：并发拉取所有数据源
 * ============================================================ */
/**
 * @param {Date} start 起始时间
 * @param {Date} end   结束时间
 * @returns {Promise<{points: Array, sources: {usgs: number, emsc: number}}>}
 */
export async function fetchAllSources(start, end) {
  const results = await Promise.allSettled([
    fetchUSGS(start, end),
    fetchEMSC(start, end),
  ]);

  const merged = [];
  const sources = { usgs: 0, emsc: 0 };

  results.forEach((r, idx) => {
    const name = idx === 0 ? "usgs" : "emsc";
    if (r.status === "fulfilled") {
      merged.push(...r.value);
      sources[name] = r.value.length;
    } else {
      console.warn(`[${name}] 拉取失败：`, r.reason);
    }
  });

  return {
    points: mergeAndDedupe(merged),
    sources,
  };
}
