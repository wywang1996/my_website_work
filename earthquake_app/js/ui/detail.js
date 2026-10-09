/**
 * 右下角详情卡片
 * 含 30 天趋势图、G-R b 值、余震概率
 */

import { CFG } from "../config.js";
import { esc, fmtUTC, timeAgo, hexToRgba } from "../utils/format.js";

const $ = (id) => document.getElementById(id);

let getPointsProvider = () => [];

export function initDetail(globe, { getAllPoints } = {}) {
  if (getAllPoints) getPointsProvider = getAllPoints;
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
 *  30 天趋势图（每日最大震级）
 * ============================================================ */
function renderTrendChart(points, days = 30) {
  if (!points || !points.length) return "";

  const now = Date.now();
  const dayMs = 86400000;
  const buckets = new Array(days).fill(0);

  for (const p of points) {
    const age = now - p.time;
    if (age < 0 || age >= days * dayMs) continue;
    const idx = days - 1 - Math.floor(age / dayMs);
    if (idx >= 0 && idx < days) {
      buckets[idx] = Math.max(buckets[idx], p.mag);
    }
  }

  const peak = Math.max(...buckets, 1);
  const w = 260,
    h = 36,
    barW = w / days - 1;

  let svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block;margin:6px 0 10px" preserveAspectRatio="none">`;
  buckets.forEach((m, i) => {
    if (m === 0) return;
    const barH = Math.max(2, (m / peak) * (h - 4));
    const x = i * (barW + 1);
    const y = h - barH;
    const color =
      m >= 7
        ? "#a855f7"
        : m >= 6
          ? "#ef4444"
          : m >= 5
            ? "#f97316"
            : m >= 4
              ? "#eab308"
              : "#22c55e";
    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" opacity="0.85" rx="1"/>`;
  });
  svg += "</svg>";
  return svg;
}

/* 从 place 里提取国家/地区名用于匹配 */
function extractRegion(place) {
  if (!place) return "";
  const parts = place.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || "";
}

/* ============================================================
 *  渲染卡片
 * ============================================================ */
function show(d, globe) {
  const detailEl = $("detail");
  const accent = d.baseColor || d.color || "#22c55e";
  const influenceKm = (d.mag * CFG.influenceKmPerMag + 20).toFixed(0);

  /* -------- 趋势数据 -------- */
  const all = getPointsProvider();
  let trendPoints = [];

  if (d.isZone && d.__zonePoints) {
    trendPoints = d.__zonePoints;
  } else {
    const region = extractRegion(d.place);
    if (region) {
      trendPoints = all.filter(
        (p) => p.place && p.place.toLowerCase().includes(region.toLowerCase()),
      );
    }
  }
  const trendSvg = renderTrendChart(trendPoints, 30);

  /* -------- G-R b 值 -------- */
  let bValueHtml = "";
  if (d.bValue) {
    const b = d.bValue.b;
    const level = d.bValue.stressLevel;
    const levelLabel =
      level === "high" ? "高应力" : level === "low" ? "低应力" : "正常";
    const levelColor =
      level === "high" ? "#fca5a5" : level === "low" ? "#86efac" : "#cfe0ff";
    bValueHtml = `
      <div class="detail-row">
        <span>G-R b 值</span>
        <b>${b.toFixed(2)} <span style="color:${levelColor};font-size:11px">(${levelLabel})</span></b>
      </div>`;
  }

  /* -------- 余震概率 -------- */
  let aftershockHtml = "";
  if (d.aftershockRisk) {
    const r = d.aftershockRisk;
    aftershockHtml = `
      <div class="detail-subsection">
        <div class="detail-subtitle">🌋 余震概率预测</div>
        <div class="detail-prob-grid">
          <div class="prob-cell">
            <div class="prob-label">24h M4+</div>
            <div class="prob-value">${(r.next24h_M4 * 100).toFixed(0)}%</div>
          </div>
          <div class="prob-cell">
            <div class="prob-label">24h M5+</div>
            <div class="prob-value">${(r.next24h_M5 * 100).toFixed(0)}%</div>
          </div>
          <div class="prob-cell">
            <div class="prob-label">7d M4+</div>
            <div class="prob-value">${(r.next7d_M4 * 100).toFixed(0)}%</div>
          </div>
          <div class="prob-cell">
            <div class="prob-label">7d M5+</div>
            <div class="prob-value">${(r.next7d_M5 * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>`;
  }

  /* -------- 序列 / 群震标记 -------- */
  let seqBadge = "";
  if (d.isSequence) seqBadge = '<span class="badge-seq">🌋 主震-余震</span>';
  else if (d.isSwarm)
    seqBadge =
      '<span class="badge-seq" style="background:rgba(250,204,21,0.18);border-color:rgba(250,204,21,0.55);color:#fef08a">🐝 群震</span>';

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
      ${seqBadge}
      ${!d.isZone && d.isRecent ? '<span class="badge-new">🔥 近 7 天</span>' : ""}
      ${d.tsunami ? '<span class="badge-warn">🌊 海啸</span>' : ""}
    </div>
    <div class="detail-place">${esc(d.place)}</div>

    ${
      trendSvg
        ? `
      <div class="detail-subsection">
        <div class="detail-subtitle">📈 近 30 天趋势</div>
        ${trendSvg}
      </div>`
        : ""
    }

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
    ${bValueHtml}
    ${d.source ? `<div class="detail-row"><span>数据来源</span><b>${d.source.toUpperCase()}</b></div>` : ""}

    ${aftershockHtml}

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
