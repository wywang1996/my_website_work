/**
 * DBSCAN 密度聚类（球面距离 + 网格索引）
 *
 * 相比朴素实现：
 *   - 网格索引：把球面切分成 1km × 1km 的格子，rangeQuery 只扫相邻 9 格
 *   - 自适应 eps：根据数据的平均最近邻距离动态调整
 */

import { haversineKm } from "../utils/geo.js";

/* ============================================================
 *  网格索引
 * ============================================================ */
class GridIndex {
  constructor(points, cellKm) {
    this.cellKm = cellKm;
    this.latCellDeg = cellKm / 111.32; // 纬度方向：1° ≈ 111.32km
    this.lngCellDeg = cellKm / 111.32; // 经度方向：随纬度收缩，用最坏情况（赤道）
    this.grid = new Map();

    for (let i = 0; i < points.length; i++) {
      const key = this._key(points[i].lat, points[i].lng);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    }
  }

  _key(lat, lng) {
    const row = Math.floor(lat / this.latCellDeg);
    const col = Math.floor(lng / this.lngCellDeg);
    return `${row},${col}`;
  }

  /**
   * 返回 (lat, lng) 周围 9 格内的所有点索引
   */
  query(lat, lng) {
    const row = Math.floor(lat / this.latCellDeg);
    const col = Math.floor(lng / this.lngCellDeg);
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = `${row + dr},${col + dc}`;
        const cell = this.grid.get(key);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
}

/* ============================================================
 *  自适应 eps
 *  计算每个点到最近 K 个邻居的平均距离，取中位数
 * ============================================================ */
export function estimateEps(points, k = 4) {
  if (points.length < k + 1) return 200;

  // 大样本随机采样（最多 500 个），降低计算量
  const sample =
    points.length > 500
      ? [...points].sort(() => Math.random() - 0.5).slice(0, 500)
      : points;

  const kthDistances = [];
  for (const p of sample) {
    // 收集所有距离（不 break）
    const dists = [];
    for (const q of sample) {
      if (q === p) continue;
      dists.push(haversineKm(p.lat, p.lng, q.lat, q.lng));
    }
    // 排序后取第 k 近
    dists.sort((a, b) => a - b);
    if (dists[k - 1] != null) kthDistances.push(dists[k - 1]);
  }

  if (!kthDistances.length) return 200;

  // 取中位数
  kthDistances.sort((a, b) => a - b);
  const median = kthDistances[Math.floor(kthDistances.length / 2)];

  // 系数 2.0 + 约束 [200, 1200]
  return Math.min(1200, Math.max(200, median * 2.0));
}

/* ============================================================
 *  DBSCAN
 * ============================================================ */
/**
 * @param {Array}  points  数据点（含 lat/lng）
 * @param {number} epsKm   邻域半径
 * @param {number} minPts  核心点最少邻居数
 * @returns {number[]} 标签数组（0 = 噪声，>0 = 簇 ID）
 */
export function dbscan(points, epsKm, minPts) {
  const n = points.length;
  if (n === 0) return [];

  const labels = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);

  // 网格索引（cell 大小 = epsKm，保证相邻 9 格覆盖整个 eps 邻域）
  const grid = new GridIndex(points, epsKm);

  let clusterId = 0;

  function rangeQuery(idx) {
    const p = points[idx];
    const candidates = grid.query(p.lat, p.lng);
    const out = [];
    for (const j of candidates) {
      if (j === idx) continue;
      if (haversineKm(p.lat, p.lng, points[j].lat, points[j].lng) <= epsKm) {
        out.push(j);
      }
    }
    return out;
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = 1;

    const nb = rangeQuery(i);
    if (nb.length < minPts) {
      labels[i] = 0;
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    const queue = nb.slice();
    const inQueue = new Set(nb);

    while (queue.length) {
      const q = queue.shift();
      if (!visited[q]) {
        visited[q] = 1;
        const qnb = rangeQuery(q);
        if (qnb.length >= minPts) {
          for (const x of qnb) {
            if (!inQueue.has(x)) {
              queue.push(x);
              inQueue.add(x);
            }
          }
        }
      }
      if (labels[q] <= 0) labels[q] = clusterId;
    }
  }

  return Array.from(labels);
}
