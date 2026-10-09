/**
 * 时间轴回放
 * 拖动滑块或点击播放，推进 state.timeline.current，触发 onUpdate
 */

import { CFG } from "../config.js";
import { fmtShort } from "../utils/format.js";

const $ = (id) => document.getElementById(id);

/**
 * @param {object} opt
 * @param {Function} opt.getState          返回 state
 * @param {Function} opt.onUpdate          每次时间改变后调用（重渲染）
 * @param {Function} opt.onAutoRotateOff   播放开始时关闭自动旋转
 */
export function initTimeline({ getState, onUpdate, onAutoRotateOff }) {
  const slider = $("tl-slider");
  const playBtn = $("tl-play");
  const timeEl = $("tl-time");
  const timelineEl = $("timeline");

  let raf = null;
  let lastT = 0;

  /* ---------- 刷新 UI ---------- */
  function updateUI() {
    const tl = getState().timeline;
    const span = tl.end - tl.start;
    if (span <= 0) return;

    const ratio = (tl.current - tl.start) / span;
    slider.value = Math.round(ratio * 1000);

    // 更新滑块左侧的进度渐变
    slider.style.setProperty("--progress", (ratio * 100).toFixed(1) + "%");

    timeEl.textContent = tl.playing
      ? `▶ ${fmtShort(tl.current)}`
      : tl.enabled
        ? fmtShort(tl.current)
        : "实时";
  }

  /* ---------- 滑块拖动 ---------- */
  slider.addEventListener("input", () => {
    const tl = getState().timeline;
    const span = tl.end - tl.start;

    tl.current = tl.start + (parseInt(slider.value, 10) / 1000) * span;
    tl.enabled = tl.current < tl.end - 1000;
    if (!tl.enabled) tl.current = tl.end;

    tl.playing = false;
    playBtn.classList.remove("active");
    playBtn.textContent = "▶";

    updateUI();
    onUpdate();
  });

  /* ---------- 播放推进 ---------- */
  function step(ts) {
    const tl = getState().timeline;
    if (!tl.playing) return;

    if (lastT) {
      const dt = ts - lastT;
      tl.current += (dt * CFG.replaySpeedMs) / 1000;

      if (tl.current >= tl.end) {
        tl.current = tl.end;
        tl.playing = false;
        playBtn.classList.remove("active");
        playBtn.textContent = "▶";
      }
      updateUI();
      onUpdate();
    }
    lastT = ts;
    raf = requestAnimationFrame(step);
  }

  /* ---------- 播放/暂停 ---------- */
  playBtn.addEventListener("click", () => {
    const tl = getState().timeline;

    // 正在播放 → 暂停
    if (tl.playing) {
      tl.playing = false;
      playBtn.classList.remove("active");
      playBtn.textContent = "▶";
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      lastT = 0;
      updateUI();
      return;
    }

    // 已到终点 → 从头开始
    if (tl.current >= tl.end) tl.current = tl.start;

    tl.enabled = true;
    tl.playing = true;
    playBtn.classList.add("active");
    playBtn.textContent = "⏸";
    lastT = 0;

    onAutoRotateOff();
    raf = requestAnimationFrame(step);
  });

  /* ---------- 对外接口 ---------- */
  return {
    show() {
      timelineEl.classList.add("show");
      const tl = getState().timeline;
      tl.end = Date.now();
      tl.start = tl.end - CFG.daysBack * 86400000;
      if (!tl.enabled) tl.current = tl.end;
      updateUI();
    },
    updateUI,
    toggle: () => playBtn.click(),
  };
}
