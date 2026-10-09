/**
 * 全局配置
 * 所有可调参数集中在这里，改这里即可，不用改其他文件
 */

export const CFG = {
  /* ---------- 数据源 ---------- */
  sources: {
    usgs: "https://earthquake.usgs.gov/fdsnws/event/1/query",
    emsc: "https://www.seismicportal.eu/fdsnws/event/1/query",
  },

  /* ---------- 数据筛选 ---------- */
  minMagnitude: 3.0, // 最低震级
  daysBack: 30, // 回溯天数
  recentDays: 7, // "近 7 天" 窗口
  refreshMs: 60 * 1000, // 自动刷新间隔

  /* ---------- 图层与渲染 ---------- */
  ringMaxCount: 120, // 同时渲染的脉冲环上限

  /* ---------- DBSCAN 聚类 ---------- */
  dbscanEpsKm: 700, // 邻域半径
  dbscanMinPts: 3, // 最少点数

  /* ---------- 活跃区域评分 ---------- */
  zoneScoreBaseMin: 14, // 最低入围评分（基础值）
  zoneScoreFactor: 0.006, // 自适应阈值系数（总条数 × 系数）
  zoneMaxShow: 8, // 最多显示区域数
  scoreHalfLifeDays: 5, // 时间衰减半衰期（天）
  influenceKmPerMag: 12, // 每级震级的影响半径（km）

  /* ---------- 时间轴回放 ---------- */
  replaySpeedMs: 60 * 60 * 1000, // 每秒回放推进的时间（1h/s）

  /* ---------- 缓存 ---------- */
  cacheKey: "eq-cache-v1",
  cacheTTL: 5 * 60 * 1000, // 5 分钟

  /* ---------- 标签节流 ---------- */
  labelThrottleMs: 100, // HTML 标签刷新节流（毫秒）
};

/* 震级 → 颜色分级 */
export const COLOR_STOPS = [
  [7.0, "#a855f7"], // 紫
  [6.0, "#ef4444"], // 红
  [5.0, "#f97316"], // 橙
  [4.0, "#eab308"], // 黄
  [0.0, "#22c55e"], // 绿
];

/* 初始相机视角：中国上方 */
export const HOME_VIEW = { lat: 25, lng: 105, altitude: 2.1 };
