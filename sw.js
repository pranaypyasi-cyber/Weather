// =====================================================
// Cloudify - Service Worker (offline support)
// App ki files aur weather API ke jawab cache mein rakhta hai,
// taaki internet na ho tab bhi aakhri data dikhe.
// =====================================================

const VERSION = "cloudify-v2";
const SHELL_CACHE = VERSION + "-shell";
const API_CACHE = VERSION + "-api";
const CDN_CACHE = VERSION + "-cdn";

const SHELL_FILES = [
  "./", "./index.html", "./style.css", "./script.js", "./favicon.svg",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"
];
const CHART_JS = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
const API_HOSTS = [
  "api.open-meteo.com", "geocoding-api.open-meteo.com",
  "air-quality-api.open-meteo.com", "api.bigdatacloud.net"
];
const MAX_API_ENTRIES = 60;

// Install: app ki files pehle se save kar lo
self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES);
    try {                                          // Chart.js na mile to bhi install fail na ho
      const cdn = await caches.open(CDN_CACHE);
      await cdn.add(new Request(CHART_JS, { mode: "cors" }));
    } catch (e) { /* koi baat nahi */ }
    await self.skipWaiting();
  })());
});

// Activate: purane version ka cache saaf karo
self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    const names = await caches.keys();
    await Promise.all(names.filter(function (n) { return !n.startsWith(VERSION); })
                           .map(function (n) { return caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (API_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(apiNetworkFirst(req));               // weather: pehle internet, nahi to cache
  } else if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(cacheFirst(req, CDN_CACHE));         // Chart.js: version fixed hai, cache kaafi
  } else if (url.origin === self.location.origin) {
    event.respondWith(shellNetworkFirst(req));             // apni files: pehle internet (taaki update turant dikhe)
  }
});

// Apni files: internet ho to taaza, nahi to cache
async function shellNetworkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (error) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") return cache.match("./index.html");
    throw error;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

// Weather API: internet ho to taaza jawab (aur cache mein save), nahi to purana cache wala
// Cache se diye gaye jawab pe "X-Cloudify-Cache: hit" lagate hain, taaki app bata sake ki data purana hai
async function apiNetworkFirst(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_API_ENTRIES) await cache.delete(keys[0]);   // sabse purana hatao
    }
    return res;
  } catch (error) {
    const cached = await cache.match(req);
    if (!cached) throw error;
    const headers = new Headers(cached.headers);
    headers.set("X-Cloudify-Cache", "hit");
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: headers });
  }
}