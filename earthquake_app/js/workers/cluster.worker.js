/**
 * 聚类 Worker
 * 接收点数据 → 跑 DBSCAN + 序列分析 + 评分 → 返回 zones
 */

import { computeActiveZones } from "../algo/zones.js";

self.onmessage = (e) => {
  const { id, points } = e.data;

  try {
    const zones = computeActiveZones(points);

    // zones 里包含 points 数组（用于趋势图），需要精简后再传回
    const serialized = zones.map((z) => ({
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusKm: z.radiusKm,
      radiusDeg: z.radiusDeg,
      score: z.score,
      level: z.level,
      maxMag: z.maxMag,
      recentCount: z.recentCount,
      last24hCount: z.last24hCount,
      lastTime: z.lastTime,
      count: z.count,
      isSequence: z.isSequence,
      isSwarm: z.isSwarm,
      sequenceType: z.sequenceType,
      aftershockRisk: z.aftershockRisk,
      bValue: z.bValue,
      regionName: z.regionName,
      rawPlace: z.rawPlace,
      // 只传最近 200 个点用于趋势图，减小传输体积
      points: z.points.slice(-200),
    }));

    self.postMessage({ id, ok: true, zones: serialized });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};
