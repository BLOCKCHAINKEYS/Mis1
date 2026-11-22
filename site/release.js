/* Burger Quest 6 public release. Only offline/local UI helpers; no analytics or network. */
(()=>{'use strict';
  const html=document.documentElement;
  function onVisibility(){const el=document.getElementById('liveTicket');if(el)el.setAttribute('aria-hidden',String(!el.getClientRects().length));}
  document.addEventListener('visibilitychange',onVisibility,{passive:true});
  window.addEventListener('pageshow',onVisibility,{passive:true});
  const banner=document.getElementById('updateBanner');
  const showUpdate=()=>{if(banner)banner.hidden=false;};
  document.getElementById('dismissUpdate')?.addEventListener('click',()=>{if(banner)banner.hidden=true;});
  document.getElementById('applyUpdate')?.addEventListener('click',()=>{
    // The existing game autosaves, but use its Save button explicitly before reloading.
    document.getElementById('menuButton')?.click();
    const save=document.querySelector('[data-modal="save"]');save?.click();
    location.reload();
  });
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    let hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController)showUpdate();hadController=true;
    });
  }
  // Wake installed service workers after return from browser cache: check for a new release.
  window.addEventListener('pageshow',()=>{if(location.protocol==='https:'&&'serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(reg=>reg?.update()).catch(()=>{});},{once:true});
})();