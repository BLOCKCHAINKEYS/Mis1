/* Burger Quest 6 — versioned offline bundle; no external fetches or telemetry. */
'use strict';
const CACHE_NAME='burger-quest-public-v6-20261119';
const ASSETS=['./','./index.html','./styles.css','./hud.css','./release.css','./hud.js','./release.js','./game.js','./restaurant3d.js','./manifest.webmanifest','./privacy.html','./privacy.css','./assets/material-atlas.jpg','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
const KNOWN=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('burger-quest-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||!KNOWN.has(url.pathname))return;
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   // Online-first for updates and offline fallback for installed games.
   try{const response=await fetch(request);if(response.ok&&response.type==='basic')event.waitUntil(cache.put(request,response.clone()));return response;}
   catch(error){const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
     if(request.mode==='navigate'){const fallback=await cache.match('./index.html');if(fallback)return fallback;}throw error;}
 })());
});