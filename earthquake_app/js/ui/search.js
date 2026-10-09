/**
 * 区域搜索框
 * 输入防抖 250ms，修改 state.searchTerm 后重渲染
 */

import { debounce } from "../utils/format.js";
import { showStatus, hideStatus } from "./hud.js";

/**
 * @param {object} opt
 * @param {Function} opt.getState          返回 state
 * @param {Function} opt.onApply           搜索词改变后重渲染
 * @param {Function} opt.getVisibleCount   返回当前可见点数量
 */
export function initSearch({ getState, onApply, getVisibleCount }) {
  const input = document.getElementById("search-input");

  const onInput = debounce(() => {
    getState().searchTerm = input.value.trim();
    onApply();

    if (getState().searchTerm) {
      showStatus(
        `搜索「${getState().searchTerm}」· ${getVisibleCount()} 条结果`,
      );
      hideStatus(2200);
    }
  }, 250);

  input.addEventListener("input", onInput);

  return {
    focus: () => input.focus(),
    blur: () => input.blur(),
    isFocused: () => document.activeElement === input,
  };
}
