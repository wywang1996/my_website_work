/**
 * 多数据源拉取与合并
 */

import { CFG } from "../config.js";
import { haversineKm } from "../utils/geo.js";

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

/**
 * @returns {Promise<{points: Array, sources: {usgs: {count, ok}, emsc: {count, ok}}}>}
 */
export async function fetchAllSources(start, end) {
  const results = await Promise.allSettled([
    fetchUSGS(start, end),
    fetchEMSC(start, end),
  ]);

  const merged = [];
  const sources = {
    usgs: { count: 0, ok: false },
    emsc: { count: 0, ok: false },
  };

  results.forEach((r, idx) => {
    const name = idx === 0 ? "usgs" : "emsc";
    if (r.status === "fulfilled") {
      merged.push(...r.value);
      sources[name] = { count: r.value.length, ok: true };
    } else {
      console.warn(`[${name}] 拉取失败：`, r.reason);
      sources[name] = { count: 0, ok: false };
    }
  });

  return {
    points: mergeAndDedupe(merged),
    sources,
  };
}
