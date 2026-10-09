/**
 * 浏览器通知 + 声音提醒
 * 当预警区域等级升到「高危」且分数显著上升时触发一次
 *
 * 注意：浏览器要求音频必须在「用户交互之后」才能播放。
 * 因此这里加了 audioUnlocked 标记，只有用户首次点击/按键后才启用声音。
 */

import { showStatus, hideStatus } from "./hud.js";

/* ============================================================
 *  内部状态
 * ============================================================ */
const state = {
  soundEnabled: true,
  lastTopScore: 0,
  lastAlertKey: "",
  audioUnlocked: false, // 用户是否已交互过
};

let audioCtx = null;

/* ============================================================
 *  音频解锁：用户第一次点击/按键时创建 AudioContext
 * ============================================================ */
function unlockAudio() {
  if (state.audioUnlocked) return;
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    state.audioUnlocked = true;
  } catch (e) {
    /* 静默失败 */
  }
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

/* ============================================================
 *  初始化按钮
 * ============================================================ */
export function initNotify() {
  const btn = document.getElementById("btn-notify");
  if (!btn) return;

  // 点击按钮本身就是一次交互，顺便解锁音频
  btn.addEventListener("pointerdown", unlockAudio);

  btn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      showStatus("当前浏览器不支持通知");
      hideStatus(2600);
      return;
    }

    // 已授权 → 切换声音
    if (Notification.permission === "granted") {
      state.soundEnabled = !state.soundEnabled;
      btn.textContent = state.soundEnabled ? "🔔 声音 开" : "🔕 声音 关";
      btn.classList.toggle("active", state.soundEnabled);
      showStatus(state.soundEnabled ? "声音提醒已开启" : "声音提醒已关闭");
      hideStatus(2200);
      return;
    }

    // 请求授权
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      btn.textContent = "🔔 声音 开";
      btn.classList.add("active");
      showStatus("已授权通知 · 检测到高危区域将推送");
      hideStatus(3200);
    } else {
      showStatus("已拒绝通知权限", true);
      hideStatus(2600);
    }
  });
}

/* ============================================================
 *  声音：用 Web Audio API 播放两声短促提示
 * ============================================================ */
function playAlertSound() {
  if (!state.soundEnabled) return;
  // 用户还没交互 → 静默跳过，避免浏览器报错
  if (!state.audioUnlocked) return;

  try {
    if (!audioCtx) return;
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
    /* 静默失败 */
  }
}

/* ============================================================
 *  浏览器通知
 * ============================================================ */
function sendNotification(zone) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification("⚠️ 高危地震区域", {
      body: `${zone.regionName} · M${zone.maxMag.toFixed(1)} · ${zone.count} 次`,
      tag: "quake-zone-" + zone.regionName,
    });
  } catch (e) {
    /* 静默失败 */
  }
}

/* ============================================================
 *  对外接口：每次 applyMode 后调用
 * ============================================================ */
export function checkAlerts(zones) {
  if (!zones.length) return;

  const top = zones[0];
  const key = `${top.regionName}|${top.level.key}`;

  // 触发条件：等级 ≥ 高危，且（分数显著上升 或 换了区域）
  const shouldAlert =
    top.level.key === "critical" &&
    (top.score > state.lastTopScore * 1.3 || key !== state.lastAlertKey);

  if (shouldAlert) {
    playAlertSound();
    sendNotification(top);
    state.lastAlertKey = key;
  }

  state.lastTopScore = Math.max(state.lastTopScore, top.score);
}
