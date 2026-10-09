/**
 * 左上角统计面板 + 底部状态条 + 启动遮罩
 */

const $ = (id) => document.getElementById(id);

/**
 * @param {object} opt
 * @param {number} opt.total
 * @param {number} opt.maxMag
 * @param {number} opt.recentCount
 * @param {number} opt.zoneCount
 * @param {object} opt.sources  {usgs:{count,ok}, emsc:{...}, cenc:{...}, jma:{...}}
 * @param {string} [opt.trendText]
 */
export function updateHUD({
  total,
  maxMag,
  recentCount,
  zoneCount,
  sources,
  trendText,
}) {
  $("stat-count").textContent = total.toLocaleString("en-US");
  $("stat-max").textContent = total ? "M " + maxMag.toFixed(1) : "—";
  $("stat-week").textContent = recentCount.toLocaleString("en-US");
  $("stat-zones").textContent = zoneCount;
  $("stat-time").textContent = new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
  });

  if (sources) {
    const parts = [];
    for (const [key, val] of Object.entries(sources)) {
      const ok = val.ok ? "" : " ✗";
      parts.push(`${key.toUpperCase()} ${val.count}${ok}`);
    }
    $("stat-source").textContent = parts.join(" · ");
  }

  const trendRow = $("stat-trend");
  if (trendRow && trendText) {
    trendRow.textContent = trendText;
  }
}

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

export function markBootDone() {
  const boot = $("boot");
  if (boot) boot.classList.add("done");
}

export function showBootError() {
  const err = $("boot-error");
  if (err) err.style.display = "block";
  markBootDone();
}
