/**
 * 时间对比：当前窗口 vs 上一个等长窗口
 * 输出活跃度变化百分比、震级变化等
 */

/**
 * @param {Array} allPoints 全部点
 * @param {number} windowDays 窗口天数（默认 7）
 * @returns {object} 对比结果
 */
export function computeTrend(allPoints, windowDays = 7) {
  const now = Date.now();
  const windowMs = windowDays * 86400000;

  const currStart = now - windowMs;
  const prevStart = now - 2 * windowMs;

  const curr = allPoints.filter((p) => p.time >= currStart);
  const prev = allPoints.filter(
    (p) => p.time >= prevStart && p.time < currStart,
  );

  const currCount = curr.length;
  const prevCount = prev.length;

  const currMax = curr.length ? Math.max(...curr.map((p) => p.mag)) : 0;
  const prevMax = prev.length ? Math.max(...prev.map((p) => p.mag)) : 0;

  const currAvg = curr.length
    ? curr.reduce((s, p) => s + p.mag, 0) / curr.length
    : 0;
  const prevAvg = prev.length
    ? prev.reduce((s, p) => s + p.mag, 0) / prev.length
    : 0;

  // 变化百分比（0 除保护）
  const countChange =
    prevCount === 0
      ? currCount > 0
        ? 100
        : 0
      : ((currCount - prevCount) / prevCount) * 100;

  const avgMagChange =
    prevAvg === 0 ? 0 : ((currAvg - prevAvg) / prevAvg) * 100;

  // 趋势方向
  let direction = "stable";
  if (countChange > 25) direction = "up";
  else if (countChange < -25) direction = "down";

  // 等级判定
  let severity = "normal";
  if (Math.abs(countChange) > 100) severity = "extreme";
  else if (Math.abs(countChange) > 50) severity = "high";
  else if (Math.abs(countChange) > 25) severity = "moderate";

  return {
    windowDays,
    currCount,
    prevCount,
    currMax,
    prevMax,
    currAvg,
    prevAvg,
    countChange,
    avgMagChange,
    direction,
    severity,
  };
}

/**
 * 格式化趋势文案："比上 7 天 ↑ 42%"
 */
export function formatTrend(trend) {
  if (trend.prevCount === 0) {
    return trend.currCount > 0 ? "上一周期无数据" : "两周期均无数据";
  }
  const arrow =
    trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  const sign = trend.countChange > 0 ? "+" : "";
  return `比上 ${trend.windowDays} 天 ${arrow} ${sign}${trend.countChange.toFixed(0)}%`;
}
