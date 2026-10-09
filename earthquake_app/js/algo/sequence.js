/**
 * 地震序列分析
 * - 前震 / 主震 / 余震 / 群震 分类
 * - G-R 关系 b 值（应力状态指标）
 * - 修正大森定律余震概率预测
 */

/* ============================================================
 *  G-R 关系 b 值
 *
 *  古登堡-里希特关系：log10(N) = a - b*M
 *  b 值通常在 0.8 ~ 1.2，越小代表应力越高
 *
 *  用最小二乘拟合数据点
 * ============================================================ */
export function computeBValue(points) {
  if (points.length < 10) return null;

  // 震级分箱（0.2 为单位）
  const mags = points.map((p) => p.mag).sort((a, b) => a - b);
  const minMag = mags[0];
  const binSize = 0.2;

  const bins = new Map();
  for (const m of mags) {
    const bin = Math.round((m - minMag) / binSize) * binSize + minMag;
    bins.set(bin, (bins.get(bin) || 0) + 1);
  }

  // 累积频次（大于等于某震级的数量）
  const sortedBins = [...bins.entries()].sort((a, b) => a[0] - b[0]);
  const dataPoints = [];
  let cumCount = 0;
  for (let i = sortedBins.length - 1; i >= 0; i--) {
    cumCount += sortedBins[i][1];
    if (cumCount >= 3) {
      dataPoints.push([sortedBins[i][0], Math.log10(cumCount)]);
    }
  }

  if (dataPoints.length < 4) return null;

  // 最小二乘 y = a + b*x
  const N = dataPoints.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const [x, y] of dataPoints) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = N * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;

  const slope = (N * sumXY - sumX * sumY) / denom;
  return {
    b: -slope, // 取负，因为 N 随 M 递减
    a: (sumY - slope * sumX) / N,
    sampleCount: points.length,
    // b 值低 → 应力高 → 风险提示
    stressLevel: -slope < 0.9 ? "high" : -slope < 1.1 ? "normal" : "low",
  };
}

/* ============================================================
 *  修正大森定律：余震概率
 *
 *  Omori-Utsu 公式：
 *    n(t) = K / (t + c)^p
 *  其中 p 通常 0.9~1.5
 *
 *  用来预测：未来 T 小时内发生 ≥ M_threshold 余震的概率
 * ============================================================ */
function predictAftershockProbability(
  mainshock,
  aftershocks,
  windowHours,
  magThreshold,
) {
  if (!aftershocks.length) return 0;

  const c = 0.05; // 稳定时间（小时）
  const p = 1.1; // 衰减指数

  // 用观测数据反推 K
  // 时间窗口内实际发生的 ≥ threshold 的余震数
  const relevant = aftershocks.filter((a) => a.mag >= magThreshold);
  if (relevant.length === 0) return 0;

  // 计算观测时间窗口
  const tObs =
    (Math.max(...relevant.map((a) => a.time)) - mainshock.time) / 3600000;
  if (tObs <= 0) return 0;

  // 拟合 K：观测数量 = ∫₀^tObs K/(t+c)^p dt
  // 积分结果：(K/(1-p)) * [(tObs+c)^(1-p) - c^(1-p)]
  const integral = (Math.pow(tObs + c, 1 - p) - Math.pow(c, 1 - p)) / (1 - p);
  if (Math.abs(integral) < 1e-9) return 0;
  const K = relevant.length / integral;

  // 预测未来 windowHours 小时内的期望数量
  const tEnd = tObs + windowHours;
  const futureIntegral =
    (Math.pow(tEnd + c, 1 - p) - Math.pow(tObs + c, 1 - p)) / (1 - p);
  const expected = K * futureIntegral;

  // 泊松分布：至少发生一次的概率 = 1 - e^(-λ)
  return Math.min(0.99, 1 - Math.exp(-expected));
}

/* ============================================================
 *  序列分类
 * ============================================================ */
/**
 * @param {Array} points 同一簇内的地震点
 * @returns {object} 序列分析结果
 */
export function analyzeSequence(points) {
  if (points.length < 4) {
    return { isSequence: false, type: "none" };
  }

  const sorted = [...points].sort((a, b) => a.time - b.time);

  // 找最大震级点
  let maxMag = 0,
    maxIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].mag > maxMag) {
      maxMag = sorted[i].mag;
      maxIdx = i;
    }
  }

  const mainshock = sorted[maxIdx];
  const aftershocks = sorted.slice(maxIdx + 1);
  const foreshocks = sorted.slice(0, maxIdx);

  // 序列判定
  const isSequence =
    maxMag >= 5 &&
    aftershocks.length >= 3 &&
    aftershocks.length > foreshocks.length;

  // 群震判定：无显著主震（最大震级与次大震级差距 < 0.5），持续多天
  const sortedByMag = [...sorted].sort((a, b) => b.mag - a.mag);
  const magGap =
    sortedByMag.length >= 2 ? sortedByMag[0].mag - sortedByMag[1].mag : 0;
  const timeSpanDays =
    (sorted[sorted.length - 1].time - sorted[0].time) / 86400000;
  const isSwarm =
    !isSequence && magGap < 0.5 && timeSpanDays > 1 && sorted.length >= 6;

  // 主余震衰减权重
  const c = 1;
  const aftershockWeights = aftershocks.map((a) => {
    const dtHours = Math.max(0.1, (a.time - mainshock.time) / 3600000);
    return 1 / (dtHours + c);
  });

  // 余震概率预测（只有序列才做）
  let aftershockRisk = null;
  if (isSequence) {
    aftershockRisk = {
      next24h_M4: predictAftershockProbability(mainshock, aftershocks, 24, 4.0),
      next24h_M5: predictAftershockProbability(mainshock, aftershocks, 24, 5.0),
      next7d_M4: predictAftershockProbability(
        mainshock,
        aftershocks,
        24 * 7,
        4.0,
      ),
      next7d_M5: predictAftershockProbability(
        mainshock,
        aftershocks,
        24 * 7,
        5.0,
      ),
    };
  }

  // b 值
  const bValue = computeBValue(points);

  return {
    isSequence,
    isSwarm,
    type: isSequence
      ? "mainshock-aftershock"
      : isSwarm
        ? "swarm"
        : "background",
    mainshock,
    aftershocks,
    foreshocks,
    aftershockWeights,
    aftershockRisk,
    bValue,
    maxMag,
  };
}
