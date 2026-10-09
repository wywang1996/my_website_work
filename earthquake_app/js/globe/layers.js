/**
 * 图层渲染
 * - 点模式：圆盘点 + 脉冲环
 * - 热力模式：六边形色块
 */

import { hexToRgba } from "../utils/format.js";

/* ============================================================
 *  热力图色彩映射
 * ============================================================ */
function heatColor(v) {
  if (v < 1.5) return "rgba(34, 197, 94, 0.30)";
  if (v < 3) return "rgba(34, 197, 94, 0.65)";
  if (v < 6) return "rgba(163, 230, 53, 0.78)";
  if (v < 10) return "rgba(234, 179, 8, 0.85)";
  if (v < 16) return "rgba(249, 115, 22, 0.88)";
  if (v < 25) return "rgba(239, 68, 68, 0.92)";
  if (v < 40) return "rgba(220, 38, 38, 0.95)";
  return "rgba(168, 85, 247, 0.96)";
}

function heatAltitude(d) {
  const w = d.sumWeight || 0;
  return 0.004 + Math.min(0.055, Math.log(1 + w) * 0.016);
}

/* ============================================================
 *  初始化热力图颜色（init 之后调用一次即可）
 * ============================================================ */
export function setupHexColors(globe) {
  globe
    .hexTopColor((d) => heatColor(d.sumWeight))
    .hexSideColor((d) => heatColor(d.sumWeight))
    .hexAltitude(heatAltitude);
}

/* ============================================================
 *  点模式渲染
 * ============================================================ */
/**
 * @param {object} globe       globe.gl 实例
 * @param {Array}  points      可见地震点（已预处理）
 * @param {Array}  zones       活跃区域
 * @param {boolean} showZones  是否显示预警区域
 * @param {number} ringMax     脉冲环数量上限
 */
export function renderPointsMode(globe, points, zones, showZones, ringMax) {
  // 关闭热力图
  globe.hexBinPointsData([]);

  /* ---------- 1. 点位数据 ---------- */
  const renderPoints = points.slice();

  if (showZones) {
    for (const z of zones) {
      renderPoints.push({
        lat: z.centerLat,
        lng: z.centerLng,
        mag: z.maxMag,
        baseColor: z.level.color,
        color: hexToRgba(z.level.color, 0.88),
        altitude: 0.008,
        radius: 2.2 + Math.min(1.3, z.score / 90),
        isRecent: true,
        isZone: true,
        place: `⚠️ ${z.level.label} · ${z.regionName}`,
        time: z.lastTime,
        url: "#",
        depth: null,
      });
    }
  }
  globe.pointsData(renderPoints);

  /* ---------- 2. 脉冲环 ---------- */
  const rings = [];

  // 每个近 7 天点
  for (const p of points) {
    if (!p.isRecent) continue;

    const ageHours = (Date.now() - p.time) / 3600000;
    const isFresh = ageHours < 24;

    rings.push({
      lat: p.lat,
      lng: p.lng,
      color: () => hexToRgba(p.baseColor, isFresh ? 0.72 : 0.42),
      maxR: Math.max(1.8, p.radius * (isFresh ? 3.6 : 2.4)),
      speed: isFresh ? 2.0 : 1.1,
      period: isFresh ? 1000 : 2000,
      _prio: isFresh ? 1 : 0, // 24h 内优先保留
    });
  }

  // 每个预警区域一个脉冲
  if (showZones) {
    for (const z of zones) {
      rings.push({
        lat: z.centerLat,
        lng: z.centerLng,
        color: () => hexToRgba(z.level.color, 0.72),
        maxR: Math.max(3.5, z.radiusDeg * 1.4),
        speed: 0.55,
        period: 2200,
        _prio: 2, // 预警区域优先最高
      });
    }
  }

  // 按优先级排序后截断（避免环太多卡顿）
  rings.sort((a, b) => b._prio - a._prio);
  globe.ringsData(rings.slice(0, ringMax));
}

/* ============================================================
 *  热力模式渲染
 * ============================================================ */
export function renderHeatMode(globe, points) {
  // 清空点与环
  globe.pointsData([]);
  globe.ringsData([]);

  // 渲染六边形
  globe.hexBinPointsData(points);
}

/* ============================================================
 *  清空所有图层（切模式时可用）
 * ============================================================ */
export function clearAllLayers(globe) {
  globe.pointsData([]);
  globe.ringsData([]);
  globe.hexBinPointsData([]);
}
