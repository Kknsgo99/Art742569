/**
 * Service Worker — ทำงานเฉพาะตอนโฮสต์แบบ static (เช่น GitHub Pages) เท่านั้น
 * ใช้งานไม่ได้เมื่อรันอยู่ภายใน Apps Script HtmlService เพราะหน้าเว็บถูกเสิร์ฟ
 * ผ่าน iframe แบบ sandbox (script.googleusercontent.com) ซึ่งเบราว์เซอร์ไม่อนุญาต
 * ให้ลงทะเบียน Service Worker ในนั้นได้ — ไฟล์นี้จึงมีผลเมื่อเปิดผ่าน URL ของ
 * GitHub Pages โดยตรงเท่านั้น
 *
 * หน้าที่: แคช "เปลือกแอป" (index.html + ไลบรารีจาก CDN ที่เรียกบ่อย) ไว้ให้
 * เปิดแอปได้แม้ออฟไลน์ ส่วนข้อมูลจริง (ทะเบียน/คะแนน/ผล) ใช้ localStorage cache
 * ที่ทำไว้แล้วในตัวแอป (ดู API.call ในไฟล์ index.html) — Service Worker นี้ไม่
 * แตะ request ที่ยิงไปยัง Apps Script (script.google.com) เลย ปล่อยให้วิ่งผ่าน
 * เครือข่ายตามปกติ/ตกไปเป็น error ตามการจัดการออฟไลน์ที่มีอยู่แล้วในแอป
 */

const CACHE_NAME = 'art74-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ไม่ยุ่งกับ request ที่ยิงไปยัง Apps Script backend หรือโดเมนอื่น — ปล่อยผ่านปกติ
  if (url.origin !== self.location.origin) {
    return;
  }

  // เปลือกแอป (HTML/manifest ของตัวเอง): cache-first แล้วอัปเดตแคชเบื้องหลัง
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached); // ออฟไลน์และไม่มีเครือข่าย — ใช้ของที่แคชไว้ถ้ามี

      return cached || fetchPromise;
    })
  );
});
