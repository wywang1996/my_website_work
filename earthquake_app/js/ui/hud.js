/**
 * 左上角统计面板 + 底部状态条 + 启动遮罩
 */

const $ = (id) => document.getElementById(id);

/* ============================================================
 *  HUD 数据更新
 * ============================================================ */
/**
 * @param {object} opt
 * @param {number} opt.total      近 30 天总条数
 * @param {number} opt.maxMag     最大震级
 * @param {number} opt.recentCount 近 7 天条数
 * @param {number} opt.zoneCount   预警区域数
 * @param {object} opt.sources    {usgs, emsc}
 */
export function updateHUD({ total, maxMag, recentCount, zoneCount, sources }) {
  $("stat-count").textContent = total.toLocaleString("en-US");
  $("stat-max").textContent = total ? "M " + maxMag.toFixed(1) : "—";
  $("stat-week").textContent = recentCount.toLocaleString("en-US");
  $("stat-zones").textContent = zoneCount;
  $("stat-time").textContent = new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
  });

  if (sources) {
    $("stat-source").textContent =
      `USGS ${sources.usgs} · EMSC ${sources.emsc}`;
  }
}

/* ============================================================
 *  底部状态条
 * ============================================================ */
export function showStatus(text, isError, isAlert) {
  const el = $("status");
  el.textContent = text;
  el.classList.remove("hidden");
  el.classList.toggle("error", !!isError);
  el.classList.toggle("alert", !!isAlert);
}

export function hideStatus(delay) {
  setTimeout(() => $("status").classList.add("hidden"), delay || 0);
}

/* ============================================================
 *  启动遮罩
 * ============================================================ */
export function markBootDone() {
  const boot = $("boot");
  if (boot) boot.classList.add("done");
}

export function showBootError() {
  const err = $("boot-error");
  if (err) err.style.display = "block";
  markBootDone();
}
