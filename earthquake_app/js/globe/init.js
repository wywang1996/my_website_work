/**
 * 3D 地球初始化
 * - 加载贴图（夜间地球 + 地形 + 星空）
 * - 配置所有图层访问器（point / ring / hexBin）
 * - 配置相机与控制
 *
 * 依赖：全局 window.Globe（由 CDN 的 globe.gl 提供）
 */

import { HOME_VIEW } from "../config.js";

/* ============================================================
 *  初始化
 * ============================================================ */
/**
 * @param {HTMLElement} container 挂载容器
 * @returns {{globe: object, controls: object}}
 */
export function initGlobe(container) {
  if (typeof Globe === "undefined") {
    throw new Error("globe.gl 未加载，请检查 CDN");
  }

  const globe = Globe()(container)
    /* ---------- 贴图 ---------- */
    .globeImageUrl(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg",
    )
    .bumpImageUrl(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png",
    )
    .backgroundImageUrl(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png",
    )

    /* ---------- 大气层 ---------- */
    .showAtmosphere(true)
    .atmosphereColor("#5aa9f0")
    .atmosphereAltitude(0.25)

    /* ---------- 点位访问器（圆盘） ---------- */
    .pointLat("lat")
    .pointLng("lng")
    .pointColor("color")
    .pointAltitude("altitude")
    .pointRadius("radius")
    .pointResolution(20)

    /* ---------- 脉冲环访问器 ---------- */
    .ringLat("lat")
    .ringLng("lng")
    .ringColor("color")
    .ringMaxRadius("maxR")
    .ringPropagationSpeed("speed")
    .ringRepeatPeriod("period")
    .ringAltitude(0.006)

    /* ---------- 热力图（HexBin）访问器 ---------- */
    .hexBinPointLat("lat")
    .hexBinPointLng("lng")
    .hexBinPointWeight("weight")
    .hexBinResolution(3)
    .hexMargin(0.22)
    .hexTopCurvatureResolution(5)
    .hexBinMerge(false)
    .hexTransitionDuration(900);

  /* ---------- 相机与控制 ---------- */
  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 130;
  controls.maxDistance = 700;

  globe.pointOfView(HOME_VIEW, 0);

  return { globe, controls };
}

/* ============================================================
 *  尺寸自适应
 * ============================================================ */
export function resizeGlobe(globe) {
  globe.width(window.innerWidth).height(window.innerHeight);
}

/* ============================================================
 *  重置视角
 * ============================================================ */
/**
 * 让相机飞回默认视角，并开启自动旋转
 */
export function resetView(globe, controls) {
  globe.pointOfView(HOME_VIEW, 900);
  controls.autoRotate = true;
}

/* ============================================================
 *  自动旋转开关（辅助方法）
 * ============================================================ */
export function setAutoRotate(controls, btn, on) {
  controls.autoRotate = on;
  if (btn) btn.classList.toggle("active", on);
}
