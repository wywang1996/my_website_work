/**
 * 格式化与视觉映射工具
 */

import { COLOR_STOPS } from "../config.js";

const pad2 = (n) => String(n).padStart(2, "0");

/* ---------- 时间 ---------- */

/** 完整 UTC 时间：2025-01-15 08:30 UTC */
export function fmtUTC(ms) {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`
  );
}

/** 短时间：01-15 08:30（用于时间轴） */
export function fmtShort(ms) {
  const d = new Date(ms);
  return (
    `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 2 天前 */
export function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

/* ---------- 文本 ---------- */

/** HTML 转义，防止 XSS */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 简化 USGS 长地名：
 *   "120km SSE of Hachinohe, Japan" → "Japan · Hachinohe"
 */
export function shortenPlace(place) {
  if (!place) return "未知区域";
  let s = place.replace(/^\d+\s*km\s+[NSEW]+\s+of\s+/i, "");
  const parts = s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (parts.length >= 2) s = parts.slice(-2).join(" · ");
  return s.length > 26 ? s.slice(0, 24) + "…" : s;
}

/* ---------- 颜色 ---------- */

/** hex → rgba 字符串 */
export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 震级 → 颜色（按 COLOR_STOPS 分级） */
export function magColor(m) {
  for (let i = 0; i < COLOR_STOPS.length; i++) {
    if (m >= COLOR_STOPS[i][0]) return COLOR_STOPS[i][1];
  }
  return "#22c55e";
}

/* ---------- 函数工具 ---------- */

/** 防抖：延迟 ms 毫秒后执行，重复触发重置计时 */
export function debounce(fn, ms) {
  let t;
  return function () {
    const args = arguments;
    const ctx = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), ms);
  };
}
