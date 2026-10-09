/**
 * 区域订阅管理
 * - 用户订阅特定区域（关键词匹配 place 字段）
 * - 存储用 localStorage（比 sessionStorage 更持久）
 * - 提供匹配函数：判断某个地震点是否命中用户订阅
 */

const STORAGE_KEY = "eq-subscriptions-v1";

/* ============================================================
 *  内部工具
 * ============================================================ */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[订阅] 保存失败:", e);
  }
}

function genId() {
  return (
    "sub_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

/* ============================================================
 *  CRUD
 * ============================================================ */
export function listSubscriptions() {
  return load();
}

/**
 * @param {object} opt
 * @param {string} opt.name            显示名（如 "Japan 日本"）
 * @param {string} opt.keyword         匹配关键词（英文小写，如 "japan"）
 * @param {number} [opt.minMagnitude]  只推送此震级以上
 * @param {string[]} [opt.levels]      只推送这些等级
 */
export function addSubscription({
  name,
  keyword,
  minMagnitude = 5.0,
  levels = ["critical", "warning"],
}) {
  const list = load();
  const sub = {
    id: genId(),
    name: name.trim(),
    keyword: keyword.trim().toLowerCase(),
    minMagnitude,
    levels,
    enabled: true,
    createdAt: Date.now(),
  };
  list.push(sub);
  save(list);
  return sub;
}

export function removeSubscription(id) {
  const list = load().filter((s) => s.id !== id);
  save(list);
}

export function toggleSubscription(id) {
  const list = load();
  const sub = list.find((s) => s.id === id);
  if (sub) {
    sub.enabled = !sub.enabled;
    save(list);
  }
  return sub;
}

export function updateSubscription(id, patch) {
  const list = load();
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    save(list);
    return list[idx];
  }
  return null;
}

/* ============================================================
 *  匹配
 * ============================================================ */
/**
 * 判断单个地震点是否命中订阅
 */
export function matchesSubscription(point, sub) {
  if (!sub.enabled) return false;
  if (point.mag < sub.minMagnitude) return false;
  if (!point.place) return false;
  return point.place.toLowerCase().includes(sub.keyword);
}

/**
 * 返回该点命中的所有订阅
 */
export function matchPoint(point) {
  const subs = load();
  return subs.filter((s) => matchesSubscription(point, s));
}

/* ============================================================
 *  预警区域匹配（用 regionName 而非 place）
 * ============================================================ */
export function matchZone(zone) {
  const subs = load();
  return subs.filter((s) => {
    if (!s.enabled) return false;
    if (zone.maxMag < s.minMagnitude) return false;
    if (s.levels.length && !s.levels.includes(zone.level.key)) return false;
    if (!zone.regionName) return false;
    return zone.regionName.toLowerCase().includes(s.keyword);
  });
}

/* ============================================================
 *  批量统计（订阅列表里显示"本周命中 N 次"）
 * ============================================================ */
export function countMatches(sub, allPoints, windowDays = 7) {
  const cutoff = Date.now() - windowDays * 86400000;
  return allPoints.filter(
    (p) => p.time >= cutoff && matchesSubscription(p, sub),
  ).length;
}
