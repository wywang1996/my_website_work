/**
 * DBSCAN 密度聚类（球面距离）
 *
 * 相比贪心聚类，DBSCAN 对噪声（孤立地震）更鲁棒，
 * 不会因为时间顺序不同而把同一区域的点分成两个簇。
 *
 * 参数：
 *   epsKm  —— 邻域半径（km）
 *   minPts —— 成为核心点所需的最少邻居数
 *
 * 返回：与输入等长的标签数组
 *   0  = 噪声
 *   >0 = 簇编号（从 1 开始）
 */

import { haversineKm } from "../utils/geo.js";

export function dbscan(points, epsKm, minPts) {
  const n = points.length;
  const labels = new Int32Array(n).fill(-1); // -1=未访问, 0=噪声, >0=簇ID
  const visited = new Uint8Array(n);
  let clusterId = 0;

  /**
   * 查询某点的 eps 邻域内所有点索引
   * O(n) —— 对 3000 条数据可接受；如要更快可上网格索引
   */
  function rangeQuery(idx) {
    const out = [];
    const p = points[idx];
    for (let j = 0; j < n; j++) {
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

    // 非核心点 → 先标记为噪声
    if (nb.length < minPts) {
      labels[i] = 0;
      continue;
    }

    // 新簇
    clusterId++;
    labels[i] = clusterId;

    // 用队列做广度优先扩展
    const queue = nb.slice();
    const inQueue = new Set(nb);

    while (queue.length) {
      const q = queue.shift();

      if (!visited[q]) {
        visited[q] = 1;
        const qnb = rangeQuery(q);
        // q 也是核心点 → 把它的邻居加入扩展队列
        if (qnb.length >= minPts) {
          for (const x of qnb) {
            if (!inQueue.has(x)) {
              queue.push(x);
              inQueue.add(x);
            }
          }
        }
      }

      // 边界点（label=0）也归入当前簇
      if (labels[q] <= 0) labels[q] = clusterId;
    }
  }

  return Array.from(labels);
}
