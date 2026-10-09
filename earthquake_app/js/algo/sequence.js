/**
 * 主震-余震序列识别
 *
 * 判定条件（满足则视为序列）：
 *   1. 簇内最高震级 ≥ M5
 *   2. 余震（主震之后的点）≥ 3 次
 *   3. 余震数 > 前震数（说明主震后活动增强）
 *
 * 返回对象包含：
 *   - isSequence:     是否识别为序列
 *   - mainshock:      主震点
 *   - aftershocks:    余震数组
 *   - foreshocks:     前震数组
 *   - aftershockWeights: 每个余震的大森定律衰减权重
 */

export function analyzeSequence(points) {
  // 点数太少不可能形成有意义的序列
  if (points.length < 4) return { isSequence: false };

  // 按时间升序
  const sorted = [...points].sort((a, b) => a.time - b.time);

  // 找最大震级的点作为主震
  let maxMag = 0;
  let maxIdx = 0;
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

  // 大森定律（Omori's law）：
  //   余震频次 ∝ 1 / (t + c)
  //   c 为主震后稳定时间（小时），取 1
  const c = 1;
  const aftershockWeights = aftershocks.map((a) => {
    const dtHours = Math.max(0.1, (a.time - mainshock.time) / 3600000);
    return 1 / (dtHours + c);
  });

  return {
    isSequence,
    mainshock,
    aftershocks,
    foreshocks,
    aftershockWeights,
    maxMag,
  };
}
