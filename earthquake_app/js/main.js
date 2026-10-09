/**
 * 入口：组装所有模块
 */

import { CFG, HOME_VIEW } from "./config.js";
import { fetchAllSources } from "./data/fetcher.js";
import { saveCache, loadCache } from "./data/cache.js";
import { preprocess } from "./data/preprocess.js";
import { computeActiveZones } from "./algo/zones.js";
import { computeTrend, formatTrend } from "./algo/trend.js";
import { initGlobe, resizeGlobe, resetView } from "./globe/init.js";
import {
  renderPointsMode,
  renderHeatMode,
  setupHexColors,
} from "./globe/layers.js";
import {
  updateHUD,
  showStatus,
  hideStatus,
  markBootDone,
  showBootError,
} from "./ui/hud.js";
import { initZonesPanel } from "./ui/zonesPanel.js";
import { createLabelsUpdater } from "./ui/labels.js";
import { initDetail, hide as hideDetail } from "./ui/detail.js";
import { initTimeline } from "./ui/timeline.js";
import { initSearch } from "./ui/search.js";
import { initNotify, checkAlerts } from "./ui/notify.js";
import { initSettings } from "./ui/settings.js";
import { debounce } from "./utils/format.js";

/* ============================================================
 *  加载兜底
 * ============================================================ */
setTimeout(() => {
  const boot = document.getElementById("boot");
  if (boot && !boot.classList.contains("done")) {
    if (typeof Globe === "undefined") showBootError();
    else markBootDone();
  }
}, 3000);

if (typeof Globe === "undefined") {
  showBootError();
  document.getElementById("status").textContent = "3D 引擎加载失败";
  throw new Error("globe.gl not loaded");
}

/* ============================================================
 *  应用状态
 * ============================================================ */
const state = {
  mode: "points",
  filter: "all",
  showZones: true,
  zonesCollapsed: false,
  allPoints: [],
  allZones: [],
  lastPreprocessed: null,
  timeline: {
    start: Date.now() - CFG.daysBack * 86400000,
    end: Date.now(),
    current: Date.now(),
    playing: false,
    enabled: false,
  },
  searchTerm: "",
  zoomLevel: "near",
  sources: { usgs: { count: 0, ok: false }, emsc: { count: 0, ok: false } },
  lastFetch: 0,
};

/* ============================================================
 *  初始化 3D 地球
 * ============================================================ */
const globeEl = document.getElementById("globe");
const { globe, controls } = initGlobe(globeEl);
setupHexColors(globe);
resizeGlobe(globe);
window.addEventListener("resize", () => resizeGlobe(globe));
globe.onGlobeReady(markBootDone);

/* ============================================================
 *  标签更新器
 * ============================================================ */
const labels = createLabelsUpdater(globe, () => state);

/* ============================================================
 *  详情卡片
 * ============================================================ */
const detail = initDetail(globe, {
  getAllPoints: () => state.allPoints,
});

/* ============================================================
 *  预警面板
 * ============================================================ */
const zonesPanel = initZonesPanel({
  onZoneClick: (z) => {
    globe.pointOfView(
      { lat: z.centerLat, lng: z.centerLng, altitude: 1.3 },
      950,
    );
    controls.autoRotate = false;
    document.getElementById("btn-rotate").classList.remove("active");
  },
  onToggleCollapse: () => {
    state.zonesCollapsed = !state.zonesCollapsed;
    zonesPanel.render(state.allZones, state.zonesCollapsed);
    // 折叠/展开后重新定位（高度变化）
    requestAnimationFrame(repositionZonesPanel);
  },
});

/* ============================================================
 *  时间轴
 * ============================================================ */
const timeline = initTimeline({
  getState: () => state,
  onUpdate: applyMode,
  onAutoRotateOff: () => {
    controls.autoRotate = false;
    document.getElementById("btn-rotate").classList.remove("active");
  },
});

/* ============================================================
 *  搜索
 * ============================================================ */
const search = initSearch({
  getState: () => state,
  onApply: applyMode,
  getVisibleCount: () => getVisiblePoints().length,
});

/* ============================================================
 *  通知 + 设置
 * ============================================================ */
initNotify();

const settingsPanel = initSettings({
  getAllPoints: () => state.allPoints,
  onSettingsChange: (s) => {
    const btn = document.getElementById("btn-notify");
    if (
      btn &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      btn.textContent = s.soundEnabled ? "🔔 声音 开" : "🔕 声音 关";
      btn.classList.toggle("active", s.soundEnabled);
    }
  },
});

/* ============================================================
 *  右上按钮 / 面板 自适应定位
 *  - 预警面板始终贴着右上按钮下方
 *  - 搜索框始终贴着左上 HUD 下方
 * ============================================================ */
function repositionZonesPanel() {
  const actions = document.getElementById("actions");
  const panel = document.getElementById("zones-panel");
  if (!actions || !panel) return;

  const rect = actions.getBoundingClientRect();
  const top = Math.round(rect.bottom + 12);
  panel.style.top = top + "px";

  const viewportH = window.innerHeight;
  const maxH = Math.max(120, viewportH - top - 90); // 留出底部时间轴 + 状态条空间
  panel.style.maxHeight = Math.min(420, maxH) + "px";
}

function repositionSearchBox() {
  const hud = document.getElementById("hud-top");
  const box = document.getElementById("search-box");
  if (!hud || !box) return;
  const rect = hud.getBoundingClientRect();
  box.style.top = Math.round(rect.bottom + 12) + "px";
}

// 初次定位
requestAnimationFrame(() => {
  repositionSearchBox();
  repositionZonesPanel();
});

// 窗口缩放 / 屏幕旋转时重新定位
const handleResize = debounce(() => {
  repositionSearchBox();
  repositionZonesPanel();
}, 150);
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", handleResize);

/* ============================================================
 *  地球点击
 * ============================================================ */
globe.onPointClick((d) => {
  if (d.isZone) {
    globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.3 }, 950);
    showStatus(`⚠️ ${d.place}`, false, true);
    hideStatus(3000);
  } else {
    detail.show(d);
  }
  controls.autoRotate = false;
  document.getElementById("btn-rotate").classList.remove("active");
});

globe.onHexClick((d) => {
  if (!d || !Array.isArray(d.points) || d.points.length === 0) return;
  let strongest = d.points[0];
  for (const p of d.points) {
    if (p && typeof p.mag === "number" && p.mag > strongest.mag) strongest = p;
  }
  detail.show(strongest);
  const recentN = d.points.filter((p) => p.isRecent).length;
  if (d.points.length > 1) {
    const extra = recentN > 0 ? ` · 近7天 ${recentN} 次` : "";
    showStatus(`该区域共 ${d.points.length} 次地震${extra}`);
    hideStatus(3600);
  }
  controls.autoRotate = false;
});

/* ============================================================
 *  过滤管线
 * ============================================================ */
function getVisiblePoints() {
  let arr = state.allPoints;

  if (state.timeline.enabled) {
    const cutoff = state.timeline.current;
    arr = arr.filter((p) => p.time <= cutoff);
  }
  if (state.searchTerm) {
    const q = state.searchTerm.toLowerCase();
    arr = arr.filter((p) => p.place && p.place.toLowerCase().includes(q));
  }
  if (state.zoomLevel === "far") {
    arr = arr.filter((p) => p.mag >= 4.5 || p.isRecent);
  } else if (state.zoomLevel === "mid") {
    arr = arr.filter((p) => p.mag >= 3.8 || p.isRecent);
  }
  return arr;
}

/* ============================================================
 *  应用模式
 * ============================================================ */
function applyMode() {
  const isHeat = state.mode === "heat";
  const isWeekOnly = state.filter === "week";
  const showZones = state.showZones && !isHeat;

  let points = getVisiblePoints();
  if (isWeekOnly) points = points.filter((p) => p.isRecent);

  const zones = computeActiveZones(points);
  state.allZones = zones;

  if (isHeat) {
    renderHeatMode(globe, points);
  } else {
    renderPointsMode(globe, points, zones, showZones, CFG.ringMaxCount);
  }

  // 按钮状态
  const btnMode = document.getElementById("btn-mode");
  const btnWeek = document.getElementById("btn-week");
  const btnZones = document.getElementById("btn-zones");

  btnMode.textContent = isHeat ? "📍 点模式" : "🔥 热力模式";
  btnMode.classList.toggle("active", isHeat);
  btnWeek.classList.toggle("active", isWeekOnly);
  btnZones.classList.toggle("active", state.showZones && !isHeat);
  btnZones.textContent = state.showZones ? "⚠️ 预警区域" : "⚠️ 预警 关闭";

  // 面板 + 标签
  zonesPanel.render(zones, state.zonesCollapsed);
  zonesPanel.setVisible(showZones);
  labels.update(zones);

  // 通知
  checkAlerts(zones);

  // 趋势
  const trend = computeTrend(state.allPoints, 7);
  const trendText = formatTrend(trend);

  // 更新 HUD
  const pre = state.lastPreprocessed;
  if (pre) {
    updateHUD({
      total: pre.points.length,
      maxMag: pre.maxMag,
      recentCount: pre.recentCount,
      zoneCount: zones.length,
      sources: state.sources,
      trendText,
    });
  }

  // 面板显示/隐藏后重新定位
  requestAnimationFrame(repositionZonesPanel);
}

/* ============================================================
 *  数据应用
 * ============================================================ */
function applyPreprocessed(pre, sources) {
  state.allPoints = pre.points;
  state.lastPreprocessed = pre;
  if (sources) state.sources = sources;

  applyMode();
}

/* ============================================================
 *  数据加载
 * ============================================================ */
let loading = false;

async function loadEarthquakes(isFirst) {
  if (loading) return;
  loading = true;

  if (isFirst) {
    showStatus("正在获取地震数据…");
    const cached = loadCache();
    if (cached && cached.length) {
      applyPreprocessed(preprocess(cached), state.sources);
      showStatus(`已从缓存加载 ${cached.length} 条，正在刷新…`);
    }
  }

  try {
    const end = new Date();
    const start = new Date(end.getTime() - CFG.daysBack * 86400000);

    const { points, sources } = await fetchAllSources(start, end);
    state.lastFetch = Date.now();

    const pre = preprocess(points);
    applyPreprocessed(pre, sources);
    saveCache(points);
    timeline.show();

    settingsPanel.refresh();

    if (pre.points.length === 0) {
      showStatus("近 30 天内暂无 M3.0+ 地震记录");
    } else if (state.allZones.length > 0) {
      const top = state.allZones[0];
      showStatus(
        `⚠️ ${state.allZones.length} 个活跃区域 · 最高「${top.level.label}」${top.regionName}`,
        false,
        true,
      );
      hideStatus(5200);
    } else {
      const u = sources.usgs.count,
        e = sources.emsc.count;
      showStatus(`已加载 ${pre.points.length} 条 · USGS ${u} + EMSC ${e}`);
      hideStatus(3400);
    }
  } catch (err) {
    console.error("[地震数据] 加载失败：", err);
    showStatus("数据加载失败，60 秒后自动重试", true);
    hideStatus(6000);
  } finally {
    loading = false;
  }
}

/* ============================================================
 *  按钮事件
 * ============================================================ */
const btnRotate = document.getElementById("btn-rotate");

btnRotate.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle("active", controls.autoRotate);
});

document.getElementById("btn-reset").addEventListener("click", () => {
  resetView(globe, controls);
  btnRotate.classList.add("active");
});

document.getElementById("btn-mode").addEventListener("click", () => {
  state.mode = state.mode === "heat" ? "points" : "heat";
  applyMode();
  if (state.mode === "heat") {
    controls.autoRotate = false;
    btnRotate.classList.remove("active");
  }
});

document.getElementById("btn-week").addEventListener("click", () => {
  state.filter = state.filter === "week" ? "all" : "week";
  applyMode();
  showStatus(state.filter === "week" ? "已筛选：近 7 天" : "已恢复：近 30 天");
  hideStatus(2200);
});

document.getElementById("btn-zones").addEventListener("click", () => {
  state.showZones = !state.showZones;
  applyMode();
  showStatus(state.showZones ? "预警区域已开启" : "预警区域已关闭");
  hideStatus(2200);
});

/* ============================================================
 *  缩放剔除
 * ============================================================ */
const checkZoomLevel = debounce(() => {
  let alt = 2.0;
  try {
    const cam = globe.cameraPosition();
    if (cam) alt = cam.altitude;
  } catch (e) {
    /* ignore */
  }

  const newLevel = alt > 2.0 ? "far" : alt > 1.2 ? "mid" : "near";
  if (newLevel !== state.zoomLevel) {
    state.zoomLevel = newLevel;
    applyMode();
  }
}, 300);

controls.addEventListener("change", checkZoomLevel);

globeEl.addEventListener("dblclick", () => {
  resetView(globe, controls);
  btnRotate.classList.add("active");
});

/* ============================================================
 *  启动 + 刷新
 * ============================================================ */
loadEarthquakes(true);

let timer = setInterval(() => loadEarthquakes(false), CFG.refreshMs);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(timer);
    timer = null;
  } else if (!timer) {
    loadEarthquakes(false);
    timer = setInterval(() => loadEarthquakes(false), CFG.refreshMs);
  }
});

/* ============================================================
 *  快捷键
 * ============================================================ */
window.addEventListener("keydown", (e) => {
  if (search.isFocused()) return;

  if (e.key === "Escape") {
    hideDetail();
    search.blur();
    settingsPanel.close();
  }
  if (e.key === "r" || e.key === "R") {
    controls.autoRotate = !controls.autoRotate;
    btnRotate.classList.toggle("active", controls.autoRotate);
  }
  if (e.key === "h" || e.key === "H") {
    state.mode = state.mode === "heat" ? "points" : "heat";
    applyMode();
  }
  if (e.key === "w" || e.key === "W") {
    state.filter = state.filter === "week" ? "all" : "week";
    applyMode();
  }
  if (e.key === "z" || e.key === "Z") {
    state.showZones = !state.showZones;
    applyMode();
  }
  if (e.key === "c" || e.key === "C") {
    state.zonesCollapsed = !state.zonesCollapsed;
    zonesPanel.render(state.allZones, state.zonesCollapsed);
    requestAnimationFrame(repositionZonesPanel);
  }
  if (e.key === "/") {
    e.preventDefault();
    search.focus();
  }
  if (e.key === " ") {
    e.preventDefault();
    timeline.toggle();
  }
  if (e.key === "s" || e.key === "S") {
    settingsPanel.open();
  }
});
