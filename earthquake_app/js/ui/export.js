/**
 * 数据导出
 * - CSV：地震点列表
 * - PNG：等距圆柱投影的平面地图
 */

import { fmtUTC } from "../utils/format.js";

const $ = (id) => document.getElementById(id);

/* ============================================================
 *  CSV 导出
 * ============================================================ */
function toCSV(points) {
  const headers = [
    "时间(UTC)",
    "震级",
    "纬度",
    "经度",
    "深度(km)",
    "地点",
    "数据源",
    "海啸",
    "详情链接",
  ];

  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const rows = points.map((p) =>
    [
      fmtUTC(p.time),
      p.mag.toFixed(1),
      p.lat.toFixed(4),
      p.lng.toFixed(4),
      p.depth != null ? p.depth.toFixed(1) : "",
      p.place || "",
      (p.source || "").toUpperCase(),
      p.tsunami ? "是" : "否",
      p.url || "",
    ]
      .map(escape)
      .join(","),
  );

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(points) {
  if (!points || !points.length) {
    return { ok: false, msg: "当前无数据可导出" };
  }
  try {
    const csv = toCSV(points);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(blob, `earthquakes_${ts}.csv`);
    return { ok: true, msg: `已导出 ${points.length} 条记录` };
  } catch (e) {
    return { ok: false, msg: "导出失败：" + e.message };
  }
}

/* ============================================================
 *  hex → rgba
 * ============================================================ */
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ============================================================
 *  平面地图 PNG 导出
 * ============================================================ */
const WORLD_MAP_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";

let cachedMapImage = null;

function loadWorldMap() {
  if (cachedMapImage) return Promise.resolve(cachedMapImage);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cachedMapImage = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error("世界地图底图加载失败"));
    img.src = WORLD_MAP_URL;
  });
}

/* ---------- 图例 ---------- */
function drawLegend(ctx, W, H) {
  const items = [
    { color: "#22c55e", label: "M 3.0 – 3.9" },
    { color: "#eab308", label: "M 4.0 – 4.9" },
    { color: "#f97316", label: "M 5.0 – 5.9" },
    { color: "#ef4444", label: "M 6.0 – 6.9" },
    { color: "#a855f7", label: "M 7.0+" },
  ];

  const pad = 16;
  const boxW = 160;
  const boxH = items.length * 24 + pad * 2 + 20;
  const boxX = W - boxW - 30;
  const boxY = H - boxH - 30;

  // 背景
  ctx.fillStyle = "rgba(10, 16, 30, 0.85)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(110, 165, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 标题
  ctx.font =
    'bold 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = "#7f97b8";
  ctx.fillText("震级图例", boxX + pad, boxY + pad + 12);

  // 图例项
  items.forEach((item, i) => {
    const y = boxY + pad + 34 + i * 24;
    ctx.beginPath();
    ctx.arc(boxX + pad + 6, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();

    ctx.font =
      '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "#b9cae3";
    ctx.fillText(item.label, boxX + pad + 22, y + 5);
  });
}

/**
 * @param {Array} points  当前可见的地震点
 * @param {Array} zones   当前活跃预警区域
 * @param {string} [filename]
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
export async function exportMapPNG(points, zones, filename) {
  if (!points || !points.length) {
    return { ok: false, msg: "当前无数据可导出" };
  }

  try {
    const W = 2400;
    const H = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    /* ---------- 1. 底图 ---------- */
    try {
      const img = await loadWorldMap();
      ctx.drawImage(img, 0, 0, W, H);
      // 加深蓝遮罩，让点更醒目
      ctx.fillStyle = "rgba(3, 8, 20, 0.55)";
      ctx.fillRect(0, 0, W, H);
    } catch (e) {
      // 底图失败回退纯色
      console.warn("底图加载失败，使用纯色背景");
      ctx.fillStyle = "#0a1428";
      ctx.fillRect(0, 0, W, H);
    }

    /* ---------- 2. 经纬网格 ---------- */
    ctx.strokeStyle = "rgba(110, 165, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = ((lng + 180) / 360) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // 赤道线加粗
    ctx.strokeStyle = "rgba(110, 165, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    /* ---------- 3. 投影函数 ---------- */
    const toXY = (lat, lng) => [
      ((lng + 180) / 360) * W,
      ((90 - lat) / 180) * H,
    ];

    /* ---------- 4. 旧数据（>7天）半透明 ---------- */
    for (const p of points) {
      if (p.isRecent) continue;
      const [x, y] = toXY(p.lat, p.lng);
      const r = Math.max(1.5, (p.mag - 3) * 1.2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.baseColor, 0.3);
      ctx.fill();
    }

    /* ---------- 5. 近 7 天亮色 + 白边 ---------- */
    for (const p of points) {
      if (!p.isRecent) continue;
      const [x, y] = toXY(p.lat, p.lng);
      const r = Math.max(2, (p.mag - 3) * 1.5);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.baseColor, 0.9);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    /* ---------- 6. 预警区域 ---------- */
    if (zones && zones.length) {
      for (const z of zones) {
        const [x, y] = toXY(z.centerLat, z.centerLng);
        const rPx = (z.radiusKm / 111.32 / 360) * W;

        // 半透明填充
        ctx.beginPath();
        ctx.arc(x, y, rPx, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(z.level.color, 0.12);
        ctx.fill();

        // 外圈
        ctx.beginPath();
        ctx.arc(x, y, rPx, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(z.level.color, 0.75);
        ctx.lineWidth = 3;
        ctx.stroke();

        // 中心点
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = z.level.color;
        ctx.fill();

        // 标签
        const label = `${z.level.label} · ${z.regionName}`;
        ctx.font =
          'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        const metrics = ctx.measureText(label);
        const padding = 8;
        const labelW = metrics.width + padding * 2;
        const labelH = 22;
        let labelX = x + rPx + 8;
        let labelY = y - labelH / 2;

        // 越界时放到左侧
        if (labelX + labelW > W - 10) {
          labelX = x - rPx - 8 - labelW;
        }
        if (labelY < 10) labelY = 10;
        if (labelY + labelH > H - 10) labelY = H - 10 - labelH;

        // 背景
        ctx.fillStyle = "rgba(10, 16, 30, 0.9)";
        ctx.fillRect(labelX, labelY, labelW, labelH);

        // 边框
        ctx.strokeStyle = hexToRgba(z.level.color, 0.7);
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX, labelY, labelW, labelH);

        // 文字
        ctx.fillStyle = z.level.color;
        ctx.fillText(label, labelX + padding, labelY + 16);
      }
    }

    /* ---------- 7. 图例 ---------- */
    drawLegend(ctx, W, H);

    /* ---------- 8. 标题 ---------- */
    ctx.font =
      'bold 32px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText("全球地震监测", 30, 52);

    ctx.font =
      '15px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "rgba(160, 180, 210, 0.9)";
    const now = new Date();
    const ts = now.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    ctx.fillText(
      `近 30 天 M3.0+ · ${points.length} 次地震 · 预警区域 ${zones ? zones.length : 0} 个 · ${ts}`,
      30,
      80,
    );

    /* ---------- 9. 下载 ---------- */
    const dataURL = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataURL;
    const fn =
      filename ||
      `earthquake_map_${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return {
      ok: true,
      msg: `已导出地图 · ${points.length} 次地震 · ${zones ? zones.length : 0} 个预警区域`,
    };
  } catch (e) {
    console.error("地图导出失败:", e);
    return { ok: false, msg: "导出失败：" + e.message };
  }
}

/* ============================================================
 *  初始化导出按钮
 * ============================================================ */
export function initExport({ getAllPoints, getAllZones }) {
  const btnCSV = $("btn-export-csv");
  const btnPNG = $("btn-export-png");
  const { showStatus, hideStatus } = window.__hudApi || {};

  if (btnCSV) {
    btnCSV.addEventListener("click", () => {
      const res = exportCSV(getAllPoints());
      if (showStatus) {
        showStatus(res.msg, !res.ok);
        hideStatus(2400);
      }
    });
  }

  if (btnPNG) {
    btnPNG.addEventListener("click", async () => {
      // 显示导出中提示（底图加载需要时间）
      if (showStatus) {
        showStatus("正在生成地图…");
      }
      const res = await exportMapPNG(
        getAllPoints(),
        getAllZones ? getAllZones() : [],
      );
      if (showStatus) {
        showStatus(res.msg, !res.ok);
        hideStatus(res.ok ? 2600 : 4000);
      }
    });
  }
}
