/**
 * sessionStorage 缓存
 * 用于页面重载时先渲染旧数据，再异步刷新
 */

import { CFG } from "../config.js";

/**
 * 保存地震点到 sessionStorage
 * @param {Array} points 归一化后的点（含 lat/lng/mag/time/place/url/source 等）
 */
export function saveCache(points) {
  try {
    const payload = {
      t: Date.now(),
      points: points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        depth: p.depth,
        mag: p.mag,
        time: p.time,
        place: p.place,
        url: p.url,
        tsunami: p.tsunami,
        source: p.source,
      })),
    };
    sessionStorage.setItem(CFG.cacheKey, JSON.stringify(payload));
  } catch (e) {
    /* 存储超限时静默忽略 */
  }
}

/**
 * 从 sessionStorage 读取缓存
 * @returns {Array|null} 未过期返回点数组，否则返回 null
 */
export function loadCache() {
  try {
    const raw = sessionStorage.getItem(CFG.cacheKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.t || Date.now() - data.t > CFG.cacheTTL) return null;
    return data.points || null;
  } catch (e) {
    return null;
  }
}

/**
 * 清空缓存（调试用）
 */
export function clearCache() {
  try {
    sessionStorage.removeItem(CFG.cacheKey);
  } catch (e) {
    /* ignore */
  }
}
