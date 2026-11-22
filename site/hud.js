/* Burger Quest 5 responsive HUD/splash. No external code or telemetry. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const html=document.documentElement;
 html.classList.add('bq-v5');
 const hudState={orders:true,grill:true,manage:false,inspector:false};
 function layout(){
   const v=window.visualViewport,w=Math.round(Math.min(innerWidth,v?.width||innerWidth)),h=Math.round(v?.height||innerHeight);
   const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
   html.dataset.device=w<=700?'mobile':w<=1050?'tablet':'desktop';
   html.dataset.input=touch?'touch':'pointer';
   html.dataset.orientation=w>h?'landscape':'portrait';
   html.dataset.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches?'yes':'no';
   const device=$('deviceReadout');if(device)device.textContent=(w<=700?'MOBILE':w<=1050?'TABLET':'DESKTOP')+' · '+(touch?'TOUCH':'MOUSE')+' · AUTO';
 }
 function toggle(panel,force){
   if(panel==='manage')hudState.manage=force??!hudState.manage;
   else if(panel==='inspector')hudState.inspector=force??!hudState.inspector;
   else hudState[panel]=force??!hudState[panel];
   html.classList.toggle('manage-open',hudState.manage);
   html.classList.toggle('show-inspector',hudState.inspector);
   for(const id of ['orders','grill']){
      const el=$(id==='orders'?'orderPanel':'grillPanel');if(el)el.classList.toggle('bq-hud-hidden',!hudState[id]);
   }
   document.querySelectorAll('[data-hud-toggle]').forEach(b=>b.setAttribute('aria-pressed',String(!!hudState[b.dataset.hudToggle])));
 }
 function ready(){
   layout();window.addEventListener('resize',layout,{passive:true});window.visualViewport?.addEventListener('resize',layout,{passive:true});
   const dock=$('hudActions');
   for(const id of ['shiftButton','pauseButton','addPatty','startBurger','serveBurger','undoBurger','trashBurger']){
      const btn=$(id);if(btn&&dock){(id==='pauseButton'?document.querySelector('.shift-controls'):dock).appendChild(btn);btn.dataset.hudShort=({shiftButton:'START',pauseButton:'PAUSE',addPatty:'PATTY',startBurger:'BUN',serveBurger:'SERVE',undoBurger:'UNDO',trashBurger:'TRASH'})[id];}
   }
   // Real controls are reparented, not duplicated: game listeners, disabled states, and saves remain connected.
   document.querySelectorAll('[data-hud-toggle]').forEach(b=>b.addEventListener('click',()=>toggle(b.dataset.hudToggle)));
   $('hudGraphics')?.addEventListener('click',()=>{$('fxButton')?.click(); const control=$('hudGraphics');control.title=$('fxButton')?.textContent||'Graphics options';});
   const close=$('hudClose');close?.addEventListener('click',()=>toggle('manage',false));
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&hudState.manage)toggle('manage',false);if(e.target.closest('input,textarea,[contenteditable=true]'))return;
      if(e.code==='KeyO')toggle('orders');else if(e.code==='KeyG')toggle('grill');else if(e.code==='KeyB')toggle('manage');else if(e.code==='KeyI')toggle('inspector');
   });
   const entry=$('enterGame'),splash=$('splashScreen'),state=$('splashStatus'),bar=$('splashProgressBar');
   entry?.addEventListener('click',()=>{
      splash.hidden=true;try{sessionStorage.setItem('burgerquest5-intro','seen')}catch(_){}
      const overlay=$('modalRoot');if(overlay&&!overlay.hidden){const dismiss=overlay.querySelector('[data-modal=gotit],[data-modal=close]');dismiss?.click()}
      if(window.Burger3D?.status?.().active===false){const warn=$('hudSignal');if(warn)warn.textContent='WEBGL UNAVAILABLE · FALLBACK GRAPHICS';}
   });
   $('splashHelp')?.addEventListener('click',()=>{
     const help=$('helpButton');splash.hidden=true;help?.click();
   });
   let checks=0;
   const boot=setInterval(()=>{
      checks++;
      const renderer=window.Burger3D?.status?.();
      const initialized=!!window.BurgerQuestDiagnostics?.snapshot?.()?.stock;
      if(renderer?.atlasLoaded&&initialized){state.textContent='KITCHEN READY · TEXTURES LOADED';bar.style.width='100%';entry.disabled=false;clearInterval(boot);if(matchMedia('(max-width:700px)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches){$('fxButton')?.click();}return}
      if(renderer?.active&&initialized){bar.style.width='76%';state.textContent='LOADING FOOD TEXTURES…'}
      else if(initialized){bar.style.width='55%';state.textContent='INITIALIZING RESTAURANT…'}
      if(checks>30){bar.style.width='100%';state.textContent=renderer?.active?'READY · TEXTURE LOADING CONTINUES':'READY · FALLBACK GRAPHICS AVAILABLE';entry.disabled=false;clearInterval(boot)}
   },100);
   // An automatic device/profile readout and a live cook/quality signal, not invented FPS claims.
   const signal=$('hudSignal');
   setInterval(()=>{
      const s=window.BurgerQuestDiagnostics?.snapshot?.();if(!s||!signal)return;
      const r=window.Burger3D?.status?.();
      if($('shiftButton'))$('shiftButton').dataset.hudShort=s.shift?.running?'END':'START';
      signal.textContent=(r?.active?'WEBGL 3D':'BASIC GRAPHICS')+' · '+(s.grillHeat||425)+'°F · GREASE '+Math.round(s.grease||0)+'% · '+(s.cookedQuality?.length||0)+' READY';
   },900);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();