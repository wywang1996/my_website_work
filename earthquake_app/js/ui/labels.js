/**
 * HTML 标签覆盖层 + SVG 引导线
 * 标签跟随 3D 位置，节流 10fps 更新，避免每帧重排 DOM
 */

import { CFG } from "../config.js";
import { hexToRgba } from "../utils/format.js";

/**
 * @param {object} globe      globe.gl 实例
 * @param {Function} getState 返回应用 state 的函数
 * @returns {{update: Function}}
 */
export function createLabelsUpdater(globe, getState) {
  const zoneOverlay = document.getElementById("zone-overlay");
  const leaderSvg = document.getElementById("leader-lines");

  let currentZones = [];
  let lastUpdate = 0;
  let lastCamKey = "";

  /* ---------- 判断点是否在可见半球 ---------- */
  function isPointVisible(lat, lng) {
    try {
      const cam = globe.cameraPosition();
      if (!cam) return true;
      const toRad = (d) => (d * Math.PI) / 180;
      const clat = toRad(cam.lat),
        clng = toRad(cam.lng);
      const plat = toRad(lat),
        plng = toRad(lng);
      const dot =
        Math.cos(clat) * Math.cos(clng) * Math.cos(plat) * Math.cos(plng) +
        Math.sin(clat) * Math.sin(plat) +
        Math.cos(clat) * Math.sin(clng) * Math.cos(plat) * Math.sin(plng);
      return dot > 0.12;
    } catch (e) {
      return true;
    }
  }

  /* ---------- 重建所有标签 ---------- */
  function update(zones) {
    if (zones !== undefined) currentZones = zones;

    zoneOverlay.innerHTML = "";
    leaderSvg.innerHTML = "";

    const state = getState();
    if (!state.showZones || state.mode === "heat") return;
    if (!currentZones.length) return;

    for (const z of currentZones) {
      if (!isPointVisible(z.centerLat, z.centerLng)) continue;

      let centerPos, labelPos;
      try {
        centerPos = globe.toScreenPosition(z.centerLat, z.centerLng, 0);
        labelPos = globe.toScreenPosition(z.centerLat, z.centerLng, 0.08);
      } catch (e) {
        continue;
      }
      if (!centerPos || !labelPos) continue;
      if (!isFinite(centerPos.x) || !isFinite(labelPos.x)) continue;

      // HTML 标签（在 3D 位置上方 18px）
      const el = document.createElement("div");
      el.className = `zone-tag lv-${z.level.key}`;
      el.style.left = labelPos.x + "px";
      el.style.top = labelPos.y - 18 + "px";
      el.innerHTML = `⚠️ ${z.level.label}<small>M${z.maxMag.toFixed(1)} · ${z.count}次</small>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        globe.pointOfView(
          { lat: z.centerLat, lng: z.centerLng, altitude: 1.3 },
          950,
        );
      });
      zoneOverlay.appendChild(el);

      // SVG 引导线：中心点 → 标签
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", centerPos.x);
      line.setAttribute("y1", centerPos.y);
      line.setAttribute("x2", labelPos.x);
      line.setAttribute("y2", labelPos.y - 18);
      line.setAttribute("stroke", hexToRgba(z.level.color, 0.55));
      leaderSvg.appendChild(line);
    }
  }

  /* ---------- 节流循环：10fps 检查相机是否变化 ---------- */
  function tick(ts) {
    if (ts - lastUpdate > CFG.labelThrottleMs) {
      lastUpdate = ts;
      try {
        const cam = globe.cameraPosition();
        if (cam) {
          const key = `${cam.lat.toFixed(1)},${cam.lng.toFixed(1)},${cam.altitude.toFixed(2)}`;
          if (key !== lastCamKey) {
            lastCamKey = key;
            update();
          }
        }
      } catch (e) {
        /* ignore */
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { update };
}
