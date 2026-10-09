/**
 * 设置面板
 * - 通知阈值（最低震级、最低等级）
 * - 声音开关
 * - 区域订阅管理
 * - 数据清理
 */

import {
  listSubscriptions,
  addSubscription,
  removeSubscription,
  toggleSubscription,
  updateSubscription,
  countMatches,
} from "../data/subscription.js";
import { showStatus, hideStatus } from "./hud.js";
import { esc } from "../utils/format.js";

const SETTINGS_KEY = "eq-settings-v1";

/* ============================================================
 *  设置存储
 * ============================================================ */
const defaultSettings = {
  notifyMinMag: 5.0,
  notifyMinLevel: "critical",
  soundEnabled: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const data = JSON.parse(raw);
    return { ...defaultSettings, ...data };
  } catch (e) {
    return { ...defaultSettings };
  }
}

function saveSettings(obj) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
  } catch (e) {
    /* ignore */
  }
}

/* ============================================================
 *  全局状态
 * ============================================================ */
let currentSettings = loadSettings();
let allPointsProvider = () => [];

export function getSettings() {
  return currentSettings;
}

/* ============================================================
 *  初始化
 * ============================================================ */
/**
 * @param {object} opt
 * @param {Function} opt.getAllPoints 返回当前全部点（用于订阅统计）
 * @param {Function} opt.onSettingsChange 设置变化回调
 */
export function initSettings({ getAllPoints, onSettingsChange }) {
  allPointsProvider = getAllPoints || (() => []);

  const panel = document.getElementById("settings-panel");
  const btn = document.getElementById("btn-settings");
  const closeBtn = document.getElementById("settings-close");
  const overlay = document.getElementById("settings-overlay");
  if (!panel || !btn) return;

  /* ---------- 打开/关闭 ---------- */
  function open() {
    panel.classList.add("show");
    if (overlay) overlay.classList.add("show");
    renderAll();
  }
  function close() {
    panel.classList.remove("show");
    if (overlay) overlay.classList.remove("show");
  }

  btn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (overlay) overlay.addEventListener("click", close);

  /* ---------- 通知阈值控件 ---------- */
  const magInput = document.getElementById("settings-min-mag");
  const levelSelect = document.getElementById("settings-min-level");
  const soundToggle = document.getElementById("settings-sound");

  if (magInput) {
    magInput.value = currentSettings.notifyMinMag;
    magInput.addEventListener("input", () => {
      const v = parseFloat(magInput.value);
      if (isFinite(v) && v >= 0 && v <= 10) {
        currentSettings.notifyMinMag = v;
        saveSettings(currentSettings);
        onSettingsChange?.(currentSettings);
      }
    });
  }

  if (levelSelect) {
    levelSelect.value = currentSettings.notifyMinLevel;
    levelSelect.addEventListener("change", () => {
      currentSettings.notifyMinLevel = levelSelect.value;
      saveSettings(currentSettings);
      onSettingsChange?.(currentSettings);
    });
  }

  if (soundToggle) {
    soundToggle.checked = currentSettings.soundEnabled;
    soundToggle.addEventListener("change", () => {
      currentSettings.soundEnabled = soundToggle.checked;
      saveSettings(currentSettings);
      onSettingsChange?.(currentSettings);
    });
  }

  /* ---------- 添加订阅 ---------- */
  const addBtn = document.getElementById("settings-add-sub");
  const nameInput = document.getElementById("settings-sub-name");
  const keyInput = document.getElementById("settings-sub-keyword");
  const magSubInput = document.getElementById("settings-sub-mag");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const name = (nameInput?.value || "").trim();
      const keyword = (keyInput?.value || "").trim().toLowerCase();
      const minMagnitude = parseFloat(magSubInput?.value) || 5.0;

      if (!name || !keyword) {
        showStatus("订阅名称和关键词不能为空", true);
        hideStatus(2200);
        return;
      }

      addSubscription({ name, keyword, minMagnitude });
      if (nameInput) nameInput.value = "";
      if (keyInput) keyInput.value = "";
      if (magSubInput) magSubInput.value = "5.0";
      renderSubscriptions();
      showStatus(`已添加订阅「${name}」`);
      hideStatus(2000);
    });
  }

  /* ---------- 清空缓存 ---------- */
  const clearBtn = document.getElementById("settings-clear-cache");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("eq-cache-v1");
        showStatus("已清理地震数据缓存");
        hideStatus(2000);
      } catch (e) {
        showStatus("清理失败", true);
        hideStatus(2200);
      }
    });
  }

  /* ---------- 渲染函数 ---------- */
  function renderSubscriptions() {
    const listEl = document.getElementById("settings-sub-list");
    if (!listEl) return;

    const subs = listSubscriptions();
    if (subs.length === 0) {
      listEl.innerHTML =
        '<div class="settings-empty">暂无订阅，添加后只会推送你关心的区域</div>';
      return;
    }

    const points = allPointsProvider();
    let html = "";
    subs.forEach((s) => {
      const hits = countMatches(s, points, 7);
      html += `
        <div class="sub-item" data-id="${s.id}">
          <label class="sub-toggle">
            <input type="checkbox" ${s.enabled ? "checked" : ""} data-act="toggle">
          </label>
          <div class="sub-info">
            <div class="sub-name">${esc(s.name)}</div>
            <div class="sub-meta">
              <code>${esc(s.keyword)}</code> · M${s.minMagnitude.toFixed(1)}+ · 近7天 ${hits} 次
            </div>
          </div>
          <button class="sub-del" data-act="del" title="删除">✕</button>
        </div>`;
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll(".sub-item").forEach((el) => {
      const id = el.dataset.id;
      el.querySelector('[data-act="toggle"]')?.addEventListener(
        "change",
        () => {
          toggleSubscription(id);
        },
      );
      el.querySelector('[data-act="del"]')?.addEventListener("click", () => {
        removeSubscription(id);
        renderSubscriptions();
      });
    });
  }

  function renderAll() {
    // 控件状态同步
    if (magInput) magInput.value = currentSettings.notifyMinMag;
    if (levelSelect) levelSelect.value = currentSettings.notifyMinLevel;
    if (soundToggle) soundToggle.checked = currentSettings.soundEnabled;
    renderSubscriptions();
  }

  // 暴露给外部
  return {
    open,
    close,
    refresh: renderAll,
    getSettings: () => currentSettings,
  };
}
