/**
 * 活跃预警区域识别（多尺度）
 */

import { CFG } from "../config.js";
import { haversineKm } from "../utils/geo.js";
import { shortenPlace } from "../utils/format.js";
import { dbscan, estimateEps } from "./dbscan.js";
import { analyzeSequence } from "./sequence.js";

/* ============================================================
 *  评分
 * ============================================================ */
function scoreCluster(clusterPoints, seq) {
  const now = Date.now();
  const halfLife = CFG.scoreHalfLifeDays * 86400000;

  let score = 0,
    maxMag = 0,
    recentCount = 0,
    last24hCount = 0,
    lastTime = 0;
  let maxPoint = clusterPoints[0];

  const aftershockSet = seq.isSequence ? new Set(seq.aftershocks) : null;

  for (const p of clusterPoints) {
    const ageMs = now - p.time;
    const timeWeight = Math.exp(-ageMs / halfLife);
    let w = Math.max(0.3, p.mag - 2.5) * timeWeight * 4;
    if (aftershockSet && aftershockSet.has(p)) w *= 0.35;
    score += w;

    if (p.mag > maxMag) {
      maxMag = p.mag;
      maxPoint = p;
    }
    if (ageMs <= CFG.recentDays * 86400000) recentCount++;
    if (ageMs <= 86400000) last24hCount++;
    if (p.time > lastTime) lastTime = p.time;
  }

  score += recentCount * 2.5;
  score += last24hCount * 6;
  if (maxMag >= 6) score += (maxMag - 5) * 10;
  else if (maxMag >= 5) score += (maxMag - 4) * 5;
  if (clusterPoints.length < 3) score *= 0.4;

  // 群震加成
  if (seq.isSwarm) score += 15;

  // b 值修正：低 b 值（高应力）加成
  if (seq.bValue && seq.bValue.b < 0.9) score *= 1.15;

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
 *  等级判定（综合评分 + b 值 + 序列类型）
 * ============================================================ */
export function zoneLevel(score, seq) {
  // b 值极低 → 强制升一级
  const bBoost = seq?.bValue && seq.bValue.b < 0.85;

  const effectiveScore = bBoost ? score * 1.2 : score;

  if (effectiveScore >= 100)
    return {
      key: "critical",
      label: "高危",
      color: "#ef4444",
      bg: "rgba(120,10,20,0.9)",
      border: "rgba(239,68,68,0.85)",
    };
  if (effectiveScore >= 60)
    return {
      key: "warning",
      label: "警戒",
      color: "#f97316",
      bg: "rgba(90,40,5,0.88)",
      border: "rgba(249,115,22,0.85)",
    };
  if (effectiveScore >= 30)
    return {
      key: "watch",
      label: "关注",
      color: "#eab308",
      bg: "rgba(80,60,5,0.85)",
      border: "rgba(234,179,8,0.75)",
    };
  if (effectiveScore >= 12)
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
 *  多尺度聚类
 * ============================================================ */
function multiscaleCluster(points) {
  // 第一级：自适应 eps 找大簇
  const epsLarge = estimateEps(points, 4);
  const labelsLarge = dbscan(points, epsLarge, CFG.dbscanMinPts);

  const groups = new Map();
  for (let i = 0; i < points.length; i++) {
    const l = labelsLarge[i];
    if (l <= 0) continue;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(points[i]);
  }

  // 第二级：对每个大簇，用 40% eps 找次级中心
  const subclusters = [];
  for (const bigCluster of groups.values()) {
    if (bigCluster.length < 6) {
      subclusters.push(bigCluster);
      continue;
    }

    const epsSmall = Math.max(150, epsLarge * 0.4);
    const labelsSmall = dbscan(bigCluster, epsSmall, 2);

    const subGroups = new Map();
    for (let i = 0; i < bigCluster.length; i++) {
      const l = labelsSmall[i];
      if (l <= 0) continue;
      if (!subGroups.has(l)) subGroups.set(l, []);
      subGroups.get(l).push(bigCluster[i]);
    }

    // 只有子簇足够大（≥4）才拆开，否则保留原大簇
    for (const sub of subGroups.values()) {
      if (sub.length >= 4) subclusters.push(sub);
      else subclusters.push(bigCluster.slice(0, 0)); // 忽略极小簇
    }
    // 兜底：如果拆分后子簇太碎，用原大簇
    if (subclusters.length === 0) subclusters.push(bigCluster);
  }

  return subclusters;
}

/* ============================================================
 *  主计算
 * ============================================================ */
export function computeActiveZones(points) {
  if (!points.length) return [];

  const clusters = multiscaleCluster(points);

  const adaptiveMin = Math.max(
    CFG.zoneScoreBaseMin,
    points.length * CFG.zoneScoreFactor,
  );

  const zones = [];

  for (const clusterPoints of clusters) {
    if (clusterPoints.length < CFG.dbscanMinPts) continue;

    const seq = analyzeSequence(clusterPoints);
    const s = scoreCluster(clusterPoints, seq);
    if (s.score < adaptiveMin) continue;

    const lv = zoneLevel(s.score, seq);
    if (!lv) continue;

    const centerLat = s.maxPoint.lat;
    const centerLng = s.maxPoint.lng;

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
      radiusDeg: radiusKm / 111.32,
      score: s.score,
      level: lv,
      maxMag: s.maxMag,
      recentCount: s.recentCount,
      last24hCount: s.last24hCount,
      lastTime: s.lastTime,
      count: s.count,

      isSequence: seq.isSequence,
      isSwarm: seq.isSwarm,
      sequenceType: seq.type,
      mainshock: seq.mainshock,
      aftershockRisk: seq.aftershockRisk,
      bValue: seq.bValue,

      regionName: shortenPlace(s.maxPoint.place),
      rawPlace: s.maxPoint.place,
      points: clusterPoints,
    });
  }

  zones.sort((a, b) => b.score - a.score);
  return zones.slice(0, CFG.zoneMaxShow);
}
