/**
 * 右下角详情卡片
 */

import { CFG } from "../config.js";
import { esc, fmtUTC, timeAgo, hexToRgba } from "../utils/format.js";

const $ = (id) => document.getElementById(id);

/**
 * @param {object} globe globe.gl 实例（用于“定位”按钮）
 * @returns {{show: Function, hide: Function}}
 */
export function initDetail(globe) {
  // 阻止卡片内部点击穿透到地球
  $("detail").addEventListener("click", (e) => e.stopPropagation());

  return {
    show: (d) => show(d, globe),
    hide,
  };
}

export function hide() {
  $("detail").classList.remove("show");
}

/* ============================================================
 *  渲染卡片内容
 * ============================================================ */
function show(d, globe) {
  const detailEl = $("detail");
  const accent = d.baseColor || d.color || "#22c55e";
  const influenceKm = (d.mag * CFG.influenceKmPerMag + 20).toFixed(0);

  detailEl.innerHTML = `
    <button class="close-btn" id="detail-close">✕</button>
    <div class="detail-head">
      <span class="detail-mag"
            style="color:${accent};
                   background:${hexToRgba(accent, 0.14)};
                   border-color:${hexToRgba(accent, 0.45)}">
        M ${d.mag.toFixed(1)}
      </span>
      ${d.isZone ? '<span class="badge-zone">⚠️ 预警区域中心</span>' : ""}
      ${d.isSequence ? '<span class="badge-seq">🌋 地震序列主震</span>' : ""}
      ${!d.isZone && d.isRecent ? '<span class="badge-new">🔥 近 7 天</span>' : ""}
      ${d.tsunami ? '<span class="badge-warn">🌊 海啸预警</span>' : ""}
    </div>
    <div class="detail-place">${esc(d.place)}</div>
    <div class="detail-row"><span>发震时刻</span><b>${fmtUTC(d.time)}</b></div>
    <div class="detail-row"><span>相对时间</span><b>${timeAgo(d.time)}</b></div>
    <div class="detail-row"><span>震源深度</span>
      <b>${d.depth != null && isFinite(d.depth) ? d.depth.toFixed(1) + " km" : "—"}</b>
    </div>
    <div class="detail-row"><span>经纬坐标</span>
      <b>${d.lat.toFixed(3)}°, ${d.lng.toFixed(3)}°</b>
    </div>
    <div class="detail-row"><span>预计影响半径</span>
      <b>~${influenceKm} km</b>
    </div>
    ${d.source ? `<div class="detail-row"><span>数据来源</span><b>${d.source.toUpperCase()}</b></div>` : ""}
    <div class="detail-actions">
      <button id="detail-fly">🎯 定位</button>
      ${d.url && d.url !== "#" ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">原站详情 ↗</a>` : ""}
    </div>`;

  detailEl.classList.add("show");

  $("detail-close").addEventListener("click", hide);

  const fly = $("detail-fly");
  if (fly) {
    fly.addEventListener("click", () => {
      globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.35 }, 950);
    });
  }
}
