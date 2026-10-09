/**
 * 数据预处理
 * 把原始记录转换为带视觉字段的渲染点
 */

import { CFG } from "../config.js";
import { magColor, hexToRgba } from "../utils/format.js";

/* ============================================================
 *  震级 → 视觉参数
 * ============================================================ */

/**
 * 圆盘半径（单位：度）
 * M3 = 0.45°，M8 = 1.65°
 */
export function magRadius(m) {
  const t = Math.min(1, Math.max(0, (m - 3) / 5));
  return 0.45 + t * 1.2;
}

/**
 * 圆盘离地高度（地球半径比例）
 * 极低值，贴住地表不凸起
 * M3 = 0.002，M8 = 0.005
 */
export function magAltitude(m) {
  const t = Math.min(1, Math.max(0, (m - 3) / 5));
  return 0.002 + t * 0.003;
}

/* ============================================================
 *  主预处理
 * ============================================================ */
/**
 * @param {Array} rawPoints 原始点（来自 fetcher）
 * @returns {{points: Array, maxMag: number, recentCount: number}}
 */
export function preprocess(rawPoints) {
  const now = Date.now();
  const recentCutoff = now - CFG.recentDays * 86400000;

  const points = [];
  let maxMag = 0;
  let recentCount = 0;

  for (const p of rawPoints) {
    const isRecent = p.time >= recentCutoff;
    if (p.mag > maxMag) maxMag = p.mag;
    if (isRecent) recentCount++;

    const baseColor = magColor(p.mag);

    points.push({
      /* 地理 */
      lat: p.lat,
      lng: p.lng,
      depth: p.depth,

      /* 属性 */
      mag: p.mag,
      time: p.time,
      place: p.place,
      url: p.url,
      source: p.source || "usgs",
      tsunami: p.tsunami === 1,

      /* 视觉 */
      baseColor,
      color: hexToRgba(baseColor, isRecent ? 0.95 : 0.38),
      altitude: magAltitude(p.mag),
      radius: magRadius(p.mag),
      weight: Math.max(1, p.mag - 2), // 热力图权重

      /* 状态 */
      isRecent,
    });
  }

  return { points, maxMag, recentCount };
}
