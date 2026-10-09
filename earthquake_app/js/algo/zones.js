/**
 * 活跃预警区域识别
 *
 * 流程：
 *   1. DBSCAN 聚类
 *   2. 对每个簇做序列识别
 *   3. 综合评分（含时间衰减 + 序列折减 + 大震加成）
 *   4. 自适应阈值过滤
 *   5. 按分数排序，取前 N 个
 */

import { CFG } from "../config.js";
import { haversineKm } from "../utils/geo.js";
import { shortenPlace } from "../utils/format.js";
import { dbscan } from "./dbscan.js";
import { analyzeSequence } from "./sequence.js";

/* ============================================================
 *  单簇评分
 * ============================================================ */
function scoreCluster(clusterPoints, seq) {
  const now = Date.now();
  const halfLife = CFG.scoreHalfLifeDays * 86400000;

  let score = 0;
  let maxMag = 0;
  let recentCount = 0;
  let last24hCount = 0;
  let lastTime = 0;
  let maxPoint = clusterPoints[0];

  // 余震集合（用于折减）
  const aftershockSet = seq.isSequence ? new Set(seq.aftershocks) : null;

  for (const p of clusterPoints) {
    const ageMs = now - p.time;
    const timeWeight = Math.exp(-ageMs / halfLife);

    // 基础分：震级 × 时间衰减
    let w = Math.max(0.3, p.mag - 2.5) * timeWeight * 4;

    // 余震折减：0.35 倍，避免序列刷分
    if (aftershockSet && aftershockSet.has(p)) {
      w *= 0.35;
    }

    score += w;

    if (p.mag > maxMag) {
      maxMag = p.mag;
      maxPoint = p;
    }
    if (ageMs <= CFG.recentDays * 86400000) recentCount++;
    if (ageMs <= 86400000) last24hCount++;
    if (p.time > lastTime) lastTime = p.time;
  }

  // 近 7 天次数加成
  score += recentCount * 2.5;
  // 24h 内活动强加成
  score += last24hCount * 6;
  // 大震加成
  if (maxMag >= 6) score += (maxMag - 5) * 10;
  else if (maxMag >= 5) score += (maxMag - 4) * 5;
  // 数据太少降低权重
  if (clusterPoints.length < 3) score *= 0.4;

  return {
    score,
    maxMag,
    recentCount,
    last24hCount,
    lastTime,
    count: clusterPoints.length,
    maxPoint,
  };
}

/* ============================================================
 *  评分 → 预警等级
 * ============================================================ */
export function zoneLevel(score) {
  if (score >= 100)
    return {
      key: "critical",
      label: "高危",
      color: "#ef4444",
      bg: "rgba(120,10,20,0.9)",
      border: "rgba(239,68,68,0.85)",
    };
  if (score >= 60)
    return {
      key: "warning",
      label: "警戒",
      color: "#f97316",
      bg: "rgba(90,40,5,0.88)",
      border: "rgba(249,115,22,0.85)",
    };
  if (score >= 30)
    return {
      key: "watch",
      label: "关注",
      color: "#eab308",
      bg: "rgba(80,60,5,0.85)",
      border: "rgba(234,179,8,0.75)",
    };
  if (score >= 12)
    return {
      key: "active",
      label: "活跃",
      color: "#22c55e",
      bg: "rgba(10,50,25,0.82)",
      border: "rgba(34,197,94,0.7)",
    };
  return null;
}

/* ============================================================
 *  主计算函数
 * ============================================================ */
/**
 * @param {Array} points 预处理后的点（含 lat/lng/mag/time/isRecent）
 * @returns {Array} 活跃区域数组，按评分降序
 */
export function computeActiveZones(points) {
  if (!points.length) return [];

  // 1. DBSCAN 聚类
  const labels = dbscan(points, CFG.dbscanEpsKm, CFG.dbscanMinPts);

  // 2. 按簇ID分组
  const groups = new Map();
  for (let i = 0; i < points.length; i++) {
    const l = labels[i];
    if (l <= 0) continue; // 跳过噪声
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(points[i]);
  }

  // 3. 自适应阈值：至少 zoneScoreBaseMin，或按数据量线性调整
  const adaptiveMin = Math.max(
    CFG.zoneScoreBaseMin,
    points.length * CFG.zoneScoreFactor,
  );

  const zones = [];

  for (const clusterPoints of groups.values()) {
    if (clusterPoints.length < CFG.dbscanMinPts) continue;

    // 序列识别 + 评分
    const seq = analyzeSequence(clusterPoints);
    const s = scoreCluster(clusterPoints, seq);
    if (s.score < adaptiveMin) continue;

    const lv = zoneLevel(s.score);
    if (!lv) continue;

    // 区域中心：用「簇内震级最高的点」，比加权质心更符合直觉
    const centerLat = s.maxPoint.lat;
    const centerLng = s.maxPoint.lng;

    // 影响半径 = max(簇内最大距离, 震级 × 影响系数)
    let maxDist = 0;
    for (const p of clusterPoints) {
      const d = haversineKm(centerLat, centerLng, p.lat, p.lng);
      if (d > maxDist) maxDist = d;
    }
    const magInfluence = s.maxMag * CFG.influenceKmPerMag;
    const radiusKm = Math.min(1500, Math.max(200, maxDist + 120, magInfluence));

    zones.push({
      centerLat,
      centerLng,
      radiusKm,
      radiusDeg: radiusKm / 111.32, // 转为角度（用于脉冲半径）

      score: s.score,
      level: lv,

      maxMag: s.maxMag,
      recentCount: s.recentCount,
      last24hCount: s.last24hCount,
      lastTime: s.lastTime,
      count: s.count,

      // 序列标记
      isSequence: seq.isSequence,
      mainshock: seq.mainshock,

      regionName: shortenPlace(s.maxPoint.place),
      rawPlace: s.maxPoint.place,
      points: clusterPoints,
    });
  }

  // 按评分降序，取前 N
  zones.sort((a, b) => b.score - a.score);
  return zones.slice(0, CFG.zoneMaxShow);
}
