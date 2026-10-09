/**
 * 右上角预警区域列表
 * 支持折叠、点击定位
 */

import { esc, timeAgo } from "../utils/format.js";

const $ = (id) => document.getElementById(id);

/* ============================================================
 *  初始化：注册头部点击折叠
 * ============================================================ */
/**
 * @param {object} opt
 * @param {Function} opt.onZoneClick        点击区域回调
 * @param {Function} opt.onToggleCollapse   点击头部回调
 */
export function initZonesPanel({ onZoneClick, onToggleCollapse }) {
  $("zones-header").addEventListener("click", (e) => {
    e.stopPropagation();
    onToggleCollapse();
  });

  return {
    render: (zones, collapsed) => render(zones, collapsed, onZoneClick),
    setVisible: (v) => $("zones-panel").classList.toggle("show", v),
  };
}

/* ============================================================
 *  渲染列表
 * ============================================================ */
function render(zones, collapsed, onZoneClick) {
  const panel = $("zones-panel");
  const list = $("zones-list");

  panel.classList.toggle("collapsed", !!collapsed);
  $("zones-count").textContent = zones.length;

  if (zones.length === 0) {
    list.innerHTML =
      '<div class="zones-empty">当前无达到预警阈值的活跃区域</div>';
    return;
  }

  let html = "";
  zones.forEach((z, i) => {
    const lv = z.level;
    const meta = [`M${z.maxMag.toFixed(1)}`];
    if (z.recentCount > 0) meta.push(`近7天 ${z.recentCount} 次`);
    if (z.last24hCount > 0) meta.push(`24h ${z.last24hCount} 次`);
    meta.push(timeAgo(z.lastTime));

    const seqBadge = z.isSequence
      ? '<span class="zone-level-badge" style="background:rgba(168,85,247,0.18);color:#e9d5ff;border:1px solid rgba(168,85,247,0.55)">序列</span>'
      : "";

    html += `
      <div class="zone-item" data-idx="${i}">
        <span class="zone-dot" style="background:${lv.color};color:${lv.color}"></span>
        <div class="zone-info">
          <div class="zone-name">
            <span class="zone-level-badge"
                  style="background:${lv.bg};color:${lv.color};border:1px solid ${lv.border}">
              ${lv.label}
            </span>${seqBadge}${esc(z.regionName)}
          </div>
          <div class="zone-meta">${meta.join(" · ")}</div>
        </div>
      </div>`;
  });

  list.innerHTML = html;

  // 绑定点击
  list.querySelectorAll(".zone-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const z = zones[parseInt(el.dataset.idx, 10)];
      if (z) onZoneClick(z);
    });
  });
}
