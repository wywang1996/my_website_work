/**
 * 地理计算工具
 */

export const EARTH_R = 6371; // 地球平均半径（km）

/**
 * Haversine 公式：两经纬度点之间的大圆距离
 * @returns {number} 距离（km）
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}
