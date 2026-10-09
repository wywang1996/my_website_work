/**
 * 浏览器通知 + 声音提醒
 * 过滤条件：settings 阈值 + 订阅匹配
 */

import { showStatus, hideStatus } from "./hud.js";
import { getSettings } from "./settings.js";
import { listSubscriptions, matchZone } from "../data/subscription.js";

const state = {
  soundEnabled: true,
  lastTopScore: 0,
  lastAlertKey: "",
  audioUnlocked: false,
};

let audioCtx = null;

/* ---------- 等级比较 ---------- */
const LEVEL_ORDER = ["active", "watch", "warning", "critical"];
function levelGte(a, b) {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b);
}

/* ---------- 音频解锁 ---------- */
function unlockAudio() {
  if (state.audioUnlocked) return;
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    state.audioUnlocked = true;
  } catch (e) {
    /* ignore */
  }
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

/* ---------- 按钮 ---------- */
export function initNotify() {
  const btn = document.getElementById("btn-notify");
  if (!btn) return;

  btn.addEventListener("pointerdown", unlockAudio);

  btn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      showStatus("当前浏览器不支持通知");
      hideStatus(2600);
      return;
    }

    if (Notification.permission === "granted") {
      state.soundEnabled = !state.soundEnabled;
      btn.textContent = state.soundEnabled ? "🔔 声音 开" : "🔕 声音 关";
      btn.classList.toggle("active", state.soundEnabled);
      showStatus(state.soundEnabled ? "声音提醒已开启" : "声音提醒已关闭");
      hideStatus(2200);
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      btn.textContent = "🔔 声音 开";
      btn.classList.add("active");
      showStatus("已授权通知 · 检测到匹配区域将推送");
      hideStatus(3200);
    } else {
      showStatus("已拒绝通知权限", true);
      hideStatus(2600);
    }
  });
}

/* ---------- 声音 ---------- */
function playAlertSound() {
  if (!state.soundEnabled) return;
  if (!state.audioUnlocked || !audioCtx) return;

  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    [880, 660].forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0, t + i * 0.18);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.22);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.3);
    });
  } catch (e) {
    /* ignore */
  }
}

/* ---------- 通知 ---------- */
function sendNotification(zone, matchedSubs) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const subText = matchedSubs.length
      ? `📍 ${matchedSubs.map((s) => s.name).join(" / ")}`
      : "";
    new Notification("⚠️ 地震预警", {
      body:
        `${zone.regionName} · M${zone.maxMag.toFixed(1)} · ${zone.count} 次` +
        (subText ? `\n${subText}` : ""),
      tag: "quake-zone-" + zone.regionName,
    });
  } catch (e) {
    /* ignore */
  }
}

/* ---------- 对外接口 ---------- */
export function checkAlerts(zones) {
  if (!zones.length) return;

  const settings = getSettings();
  const subs = listSubscriptions();

  // 过滤：阈值 + 订阅
  const candidates = zones.filter((z) => {
    if (z.maxMag < settings.notifyMinMag) return false;
    if (!levelGte(z.level.key, settings.notifyMinLevel)) return false;

    // 如果有订阅，只推命中订阅的
    if (subs.length > 0) {
      return matchZone(z).length > 0;
    }
    return true;
  });

  if (!candidates.length) return;

  const top = candidates[0];
  const key = `${top.regionName}|${top.level.key}`;
  const shouldAlert =
    top.score > state.lastTopScore * 1.3 || key !== state.lastAlertKey;

  if (shouldAlert) {
    playAlertSound();
    sendNotification(top, matchZone(top));
    state.lastAlertKey = key;
  }
  state.lastTopScore = Math.max(state.lastTopScore, top.score);
}
