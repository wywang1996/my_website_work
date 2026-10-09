/**
 * 聚类 Worker 客户端
 * 主线程通过它异步调用 Worker，返回 Promise
 */

let worker = null;
let seq = 0;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./cluster.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const { id, ok, zones, error } = e.data;
      const resolver = pending.get(id);
      if (!resolver) return;
      pending.delete(id);
      if (ok) resolver.resolve(zones);
      else resolver.reject(new Error(error));
    };
    worker.onerror = (err) => {
      console.error("[Cluster Worker] 错误:", err);
      // 所有待处理请求都失败
      for (const r of pending.values()) r.reject(err);
      pending.clear();
      // 允许下次重建
      worker = null;
    };
  } catch (e) {
    console.warn("[Cluster Worker] 初始化失败，将回退到主线程:", e);
    worker = null;
  }
  return worker;
}

/**
 * 异步计算活跃区域
 * @param {Array} points
 * @returns {Promise<Array>} zones
 */
export function computeZonesAsync(points) {
  const w = ensureWorker();
  if (!w) {
    // 回退：主线程同步计算（极少发生）
    return import("../algo/zones.js").then((m) => m.computeActiveZones(points));
  }

  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    // 只传 Worker 需要的字段，减小传输量
    const payload = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      mag: p.mag,
      time: p.time,
      place: p.place,
      isRecent: p.isRecent,
    }));
    w.postMessage({ id, points: payload });
  });
}
