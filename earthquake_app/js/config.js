/**
 * 全局配置
 */

export const CFG = {
  /* ---------- 数据源 ---------- */
  sources: {
    usgs: "https://earthquake.usgs.gov/fdsnws/event/1/query",
    emsc: "https://www.seismicportal.eu/fdsnws/event/1/query",
    cenc: "https://api.wolfx.jp/cenc_eqlist.json",
    jma: "https://api.wolfx.jp/jma_eqlist.json",
  },

  /* ---------- 数据筛选 ---------- */
  minMagnitude: 3.0,
  daysBack: 30,
  recentDays: 7,
  refreshMs: 60 * 1000,

  /* ---------- 图层与渲染 ---------- */
  ringMaxCount: 120,

  /* ---------- DBSCAN 聚类 ---------- */
  dbscanEpsKm: 700,
  dbscanMinPts: 3,

  /* ---------- 活跃区域评分 ---------- */
  zoneScoreBaseMin: 14,
  zoneScoreFactor: 0.006,
  zoneMaxShow: 8,
  scoreHalfLifeDays: 5,
  influenceKmPerMag: 12,

  /* ---------- 时间轴回放 ---------- */
  replaySpeedMs: 60 * 60 * 1000,

  /* ---------- 缓存 ---------- */
  cacheKey: "eq-cache-v1",
  cacheTTL: 5 * 60 * 1000,

  /* ---------- 标签节流 ---------- */
  labelThrottleMs: 100,
};

/* 震级 → 颜色分级 */
export const COLOR_STOPS = [
  [7.0, "#a855f7"],
  [6.0, "#ef4444"],
  [5.0, "#f97316"],
  [4.0, "#eab308"],
  [0.0, "#22c55e"],
];

/* 初始相机视角 */
export const HOME_VIEW = { lat: 25, lng: 105, altitude: 2.1 };
