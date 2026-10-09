/**
 * Service Worker
 * 策略：network-first，网络失败时回退到缓存
 */

const CACHE_NAME = "earthquake-app-v3";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/main.js",
  "./js/config.js",
  "./js/utils/geo.js",
  "./js/utils/format.js",
  "./js/data/fetcher.js",
  "./js/data/cache.js",
  "./js/data/preprocess.js",
  "./js/data/subscription.js",
  "./js/algo/dbscan.js",
  "./js/algo/sequence.js",
  "./js/algo/zones.js",
  "./js/algo/trend.js",
  "./js/globe/init.js",
  "./js/globe/layers.js",
  "./js/ui/hud.js",
  "./js/ui/zonesPanel.js",
  "./js/ui/labels.js",
  "./js/ui/detail.js",
  "./js/ui/timeline.js",
  "./js/ui/search.js",
  "./js/ui/notify.js",
  "./js/ui/settings.js",
  "./js/ui/export.js",
  "./js/workers/cluster.worker.js",
  "./js/workers/clusterClient.js",
  "./manifest.json",
];

/* ============================================================
 *  安装：预缓存本地资源
 * ============================================================ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache
              .add(url)
              .catch((err) => console.warn("[SW] 预缓存失败:", url, err)),
          ),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

/* ============================================================
 *  激活：清理旧版本缓存
 * ============================================================ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ============================================================
 *  拦截请求
 * ============================================================ */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 外部 CDN / API 直接走网络
  if (url.origin !== self.location.origin) return;

  // 本地资源 network-first
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});
