/* Burger Quest 6.0 — public release, self-contained, dependency-free tycoon gameplay.
   Player data stays in browser localStorage unless explicitly exported. */
(() => {
  'use strict';
  const SAVE_KEY = 'burger-quest-save-v1';
  const SHIFT_LENGTH = 105;
  const MAX_QUEUE = 3;
  const INGREDIENTS = {
    beef:    {label:'Beef patty',      short:'Beef',       icon:'🥩', cost:3,  tier:0, purchase:'raw'},
    cheese:  {label:'Melted cheese',   short:'Cheese',     icon:'🧀', cost:1,  tier:0},
    pickle:  {label:'Pickle',          short:'Pickle',     icon:'🥒', cost:1,  tier:0},
    onion:   {label:'Grilled onion',   short:'Onion',      icon:'🧅', cost:1,  tier:0},
    tomato:  {label:'Tomato',          short:'Tomato',     icon:'🍅', cost:1,  tier:0},
    lettuce: {label:'Crisp romaine',   short:'Romaine',    icon:'🥬', cost:1,  tier:0},
    chili:   {label:'Chopped chilies', short:'Chilies',    icon:'🌶️',cost:2,  tier:1},
    garlic:  {label:'Garlic-butter romaine',short:'Garlic greens',icon:'🧄',cost:3,tier:1},
    bacon:   {label:'Smoky bacon',     short:'Bacon',      icon:'🥓', cost:3,  tier:2},
    sauce:   {label:'Secret sauce',    short:'Sauce',      icon:'🥫', cost:2,  tier:3},
  };
  const STANDS = [
    {name:'THE CORNER CART',     label:'Corner Cart',     city:'Your first sidewalk smash-burger cart.', cost:0,     sales:0,   mult:1,    rent:12,passive:18, description:'One cart. Two burners. Unlimited ambition.'},
    {name:'DOWNTOWN WINDOW',     label:'Downtown Window', city:'Lunch rush in the heart of the city.', cost:450,   sales:12,  mult:1.2,  rent:28,passive:55, description:'Unlock chili peppers and garlic-butter romaine.'},
    {name:'BEACH BOARDWALK',     label:'Beach Boardwalk', city:'Golden-hour burgers by the water.',     cost:1700,  sales:40,  mult:1.45, rent:52,passive:110,description:'Unlock bacon and premium stacks.'},
    {name:'MIDNIGHT MARKET',     label:'Midnight Market', city:'Where the city eats after dark.',      cost:5500,  sales:95,  mult:1.75, rent:100,passive:190,description:'Unlock house sauce and the late-night crowd.'},
    {name:'SKYLINE FLAGSHIP',   label:'Skyline Flagship',city:'A legendary burger destination.',      cost:16000, sales:190, mult:2.1,  rent:200,passive:390,description:'Every menu item. Your own burger landmark.'}
  ];
  const RECIPES = [
    {id:'classic', name:'THE CLASSIC',       tier:0, price:14, req:{beef:1,cheese:1,pickle:1}},
    {id:'backyard',name:'BACKYARD CRUSH',    tier:0, price:17, req:{beef:1,cheese:1,onion:1,tomato:1}},
    {id:'garden', name:'THE GARDEN KISS',    tier:0, price:17, req:{beef:1,lettuce:1,tomato:1,onion:1}},
    {id:'double', name:'DOUBLE TROUBLE',     tier:0, price:25, req:{beef:2,cheese:2,pickle:1,onion:1}},
    {id:'hot',    name:'THE HOT STACK',      tier:1, price:28, req:{beef:2,cheese:1,chili:1,onion:1}},
    {id:'garlic', name:'THE GARLIC MELT',    tier:1, price:34, req:{beef:2,cheese:2,garlic:1,chili:1,pickle:1,onion:1}},
    {id:'bacon',  name:'BACON AFTER DARK',   tier:2, price:39, req:{beef:2,cheese:2,bacon:2,onion:1,garlic:1}},
    {id:'savage', name:'THE SAUCE BOSS',     tier:3, price:44, req:{beef:2,cheese:2,bacon:1,sauce:1,chili:1,tomato:1}},
    {id:'skyline',name:'THE SKYLINE STACK',  tier:4, price:62, req:{beef:3,cheese:2,bacon:2,garlic:1,sauce:1,tomato:1,chili:1}}
  ];
  const CUSTOMERS = [
    {name:'Monique', icon:'👩🏽',color:'pink'}, {name:'Darius',icon:'👨🏿',color:'blue'},
    {name:'Avery',icon:'🧑🏽',color:'green'}, {name:'Carmen',icon:'👩🏻',color:'pink'},
    {name:'Jordan',icon:'👨🏾',color:'blue'}, {name:'Riley',icon:'🧑🏻',color:'green'},
    {name:'Deja',icon:'👩🏿',color:'pink'}, {name:'Luis',icon:'👨🏽',color:'blue'},
    {name:'Toni',icon:'👩🏾',color:'green'}, {name:'Miles',icon:'🧔🏽',color:'blue'}
  ];
  const UPGRADE_TYPES = {
    grill:{name:'GRILL POWER',desc:'Extra grill stations and faster cooking.',base:[140,450,1100]},
    staff:{name:'CREW TRAINING',desc:'More patient customers and better returns from your other stands.',base:[175,510,1350]},
    brand:{name:'BRAND & EXPERIENCE',desc:'Larger tips and more passive business from owned stands.',base:[160,470,1250]}
  };
  const $ = id => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const money = amount => '$'+Math.round(amount).toLocaleString('en-US');
  const rand = (a,b) => a+Math.random()*(b-a);
  const choose = a => a[Math.floor(Math.random()*a.length)];
  const e = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeInt = (n,lo,hi, fallback=lo) => Number.isFinite(n)?clamp(Math.floor(n),lo,hi):fallback;
  let state;
  let managementTab='supplies';
  let lastFrame=performance.now();
  let renderWait=0, saveWait=0, soundCtx=null, storageAvailable=true;
  const freshGame = () => ({
    version:1, cash:180, debt:0, rep:3.65, served:0, day:1,
    owned:[0], active:0, upgrades:{'0':{grill:0,staff:0,brand:0}},
    stock:{bun:18,raw:24,cheese:24,pickle:20,onion:20,tomato:20,lettuce:20,chili:0,garlic:0,bacon:0,sauce:0},
    cooked:0, cookedQuality:[], grillHeat:425, grease:0, totalCleaned:0, clock:0, shift:{running:false,paused:false,time:SHIFT_LENGTH,revenue:0,served:0,missed:0,tip:0},
    orders:[], selected:null, nextSpawn:0, nextId:1, slots:Array(2).fill(null),
    build:{bun:false,layers:[],qualities:[]}, streak:0, bestStreak:0, perfectFlips:0, burned:0,
    lifetimeRevenue:0, lifetimeCosts:0, ledger:[], audio:false, onboardingSeen:false,
    unlockedWealth:false
  });
  const getUpgrade = name => (state.upgrades[String(state.active)]||{grill:0,staff:0,brand:0})[name]||0;
  const priceAtStand = recipe => Math.round(recipe.price*STANDS[state.active].mult);
  const maxSlots = () => 2+Math.min(2,getUpgrade('grill'));
  const cookFactor = () => clamp(425/state.grillHeat,.68,1.42)*(1-Math.min(.35,getUpgrade('grill')*.12));
  const searGrade = slot => clamp(Math.round(91-Math.abs(state.grillHeat-445)*.22-state.grease*.18+(slot.perfect?9:0)),38,100);
  const staffPatience = () => 1+getUpgrade('staff')*.15;
  function sanitizeSave(raw) {
    if(!raw||typeof raw!=='object'||raw.version!==1) throw new Error('Unsupported or invalid Burger Quest save.');
    const clean=freshGame();
    clean.cash=safeInt(raw.cash,0,1e12,180);
    clean.debt=safeInt(raw.debt,0,1e12);
    clean.rep=clamp(Number(raw.rep)||3,1,5);
    clean.served=safeInt(raw.served,0,1e8);
    clean.day=safeInt(raw.day,1,1e6,1);
    clean.owned=Array.isArray(raw.owned)?Array.from(new Set(raw.owned.filter(i=>Number.isInteger(i)&&i>=0&&i<STANDS.length))).sort():[0];
    if(!clean.owned.includes(0))clean.owned.unshift(0);
    clean.active=clean.owned.includes(raw.active)?raw.active:0;
    for(const i of clean.owned){
      const u=raw.upgrades?.[String(i)]||{};
      clean.upgrades[String(i)]={grill:safeInt(u.grill,0,3),staff:safeInt(u.staff,0,3),brand:safeInt(u.brand,0,3)};
    }
    for(const k of Object.keys(clean.stock))clean.stock[k]=safeInt(raw.stock?.[k],0,1e8,clean.stock[k]);
    clean.cooked=safeInt(raw.cooked,0,1e6);
    clean.grillHeat=safeInt(raw.grillHeat,325,550,425);
    clean.grease=clamp(Number(raw.grease)||0,0,100);
    clean.totalCleaned=safeInt(raw.totalCleaned,0,1e7);
    clean.cookedQuality=Array.isArray(raw.cookedQuality)?raw.cookedQuality.slice(0,1000).map(v=>safeInt(v,38,100,75)).slice(0,clean.cooked):[];
    while(clean.cookedQuality.length<Math.min(clean.cooked,1000))clean.cookedQuality.push(75);
    clean.clock=clamp(Number(raw.clock)||0,0,1e12);
    const sh=raw.shift||{};
    clean.shift={running:!!sh.running,paused:!!sh.running,time:clamp(Number(sh.time)||SHIFT_LENGTH,0,SHIFT_LENGTH),revenue:safeInt(sh.revenue,0,1e9),served:safeInt(sh.served,0,1e7),missed:safeInt(sh.missed,0,1e7),tip:safeInt(sh.tip,0,1e9)};
    clean.orders=Array.isArray(raw.orders)?raw.orders.slice(0,MAX_QUEUE).filter(o=>RECIPES.some(r=>r.id===o.recipe)&&Number.isFinite(o.remaining)&&Number.isFinite(o.patience)).map(o=>({id:safeInt(o.id,1,1e10),recipe:o.recipe,remaining:clamp(o.remaining,0,2000),patience:clamp(o.patience,1,2000),customer:safeInt(o.customer,0,CUSTOMERS.length-1)})):[];
    clean.selected=clean.orders.some(o=>o.id===raw.selected)?raw.selected:(clean.orders[0]?.id||null);
    clean.nextSpawn=clamp(Number(raw.nextSpawn)||0,0,1e12);
    clean.nextId=Math.max(safeInt(raw.nextId,1,1e10,1),...clean.orders.map(o=>o.id+1),1);
    clean.slots=Array.from({length:maxSlotsFromRaw(clean)},(_,i)=>{
      const slot=Array.isArray(raw.slots)?raw.slots[i]:null;
      if(!slot||!['s1','flip','s2','ready','burnt'].includes(slot.phase))return null;
      return {phase:slot.phase,started:clamp(Number(slot.started)||0,0,clean.clock),flipped:!!slot.flipped,perfect:!!slot.perfect};
    });
    clean.build={bun:!!raw.build?.bun,layers:Array.isArray(raw.build?.layers)?raw.build.layers.filter(k=>typeof k==='string'&&Object.hasOwn(INGREDIENTS,k)).slice(0,18):[],qualities:[]};
    const beefCount=clean.build.layers.filter(k=>k==='beef').length;
    clean.build.qualities=Array.from({length:beefCount},(_,i)=>safeInt(raw.build?.qualities?.[i],38,100,75));
    clean.streak=safeInt(raw.streak,0,1e7);clean.bestStreak=safeInt(raw.bestStreak,0,1e7);
    clean.perfectFlips=safeInt(raw.perfectFlips,0,1e8);clean.burned=safeInt(raw.burned,0,1e8);
    clean.lifetimeRevenue=safeInt(raw.lifetimeRevenue,0,1e12);
    clean.lifetimeCosts=safeInt(raw.lifetimeCosts,0,1e12);
    clean.ledger=Array.isArray(raw.ledger)?raw.ledger.slice(0,100).filter(x=>typeof x?.label==='string'&&Number.isFinite(x?.amount)).map(x=>({day:safeInt(x.day,1,1e6,1),label:x.label.slice(0,70),amount:clamp(x.amount,-1e12,1e12)})):[];
    clean.audio=!!raw.audio;clean.onboardingSeen=!!raw.onboardingSeen;clean.unlockedWealth=!!raw.unlockedWealth;
    // Restarting a paused shift is explicit. This prevents losing orders while the tab is closed.
    return clean;
  }
  function maxSlotsFromRaw(g){return 2+Math.min(2,g.upgrades[String(g.active)]?.grill||0)}
  function store(){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));$('saveIndicator').textContent='SAVED LOCALLY';storageAvailable=true}
    catch(_){storageAvailable=false;$('saveIndicator').textContent='LOCAL SAVE UNAVAILABLE — EXPORT SAVE'}
  }
  function load(){try{let s=localStorage.getItem(SAVE_KEY);return s?sanitizeSave(JSON.parse(s)):null}catch(err){console.warn('Save not loaded:',err);return null}}
  function receipt(label,amount){
    state.ledger.unshift({day:state.day,label,amount:Math.round(amount)});
    state.ledger=state.ledger.slice(0,100);
    if(amount>=0)state.lifetimeRevenue+=Math.round(amount);else state.lifetimeCosts+=Math.abs(Math.round(amount));
  }
  function ding(kind='tap') {
    if(!state.audio)return;
    try {
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      soundCtx=soundCtx||new C();if(soundCtx.state==='suspended')soundCtx.resume();
      const osc=soundCtx.createOscillator(),g=soundCtx.createGain(),now=soundCtx.currentTime;
      osc.type=kind==='bad'?'sawtooth':kind==='cash'?'triangle':'sine';
      osc.frequency.setValueAtTime(kind==='bad'?180:kind==='cash'?540:430,now);
      osc.frequency.exponentialRampToValueAtTime(kind==='bad'?125:kind==='cash'?820:550,now+.12);
      g.gain.setValueAtTime(.07,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);
      osc.connect(g);g.connect(soundCtx.destination);osc.start(now);osc.stop(now+.21);
    }catch(_){}
  }
  function sizzle(duration=.35){
    if(!state.audio)return;
    try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      soundCtx=soundCtx||new C();if(soundCtx.state==='suspended')soundCtx.resume();
      const len=Math.floor(soundCtx.sampleRate*duration),buffer=soundCtx.createBuffer(1,len,soundCtx.sampleRate),ch=buffer.getChannelData(0);
      for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(.45+.55*Math.random());
      const src=soundCtx.createBufferSource(),filter=soundCtx.createBiquadFilter(),gain=soundCtx.createGain(),now=soundCtx.currentTime;
      src.buffer=buffer;filter.type='bandpass';filter.frequency.value=2100;filter.Q.value=.55;
      gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.13,now+.028);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      src.connect(filter);filter.connect(gain);gain.connect(soundCtx.destination);src.start(now);src.stop(now+duration);
    }catch(_){}
  }
  function cleanGriddle(){
    if(state.shift.running&&state.shift.paused)return fail('Resume your shift before cleaning.');
    if(state.slots.some(Boolean))return fail('Clear every patty before scraping the griddle.');
    if(state.grease<1)return toast('Griddle is already clean.');
    const prior=Math.round(state.grease);
    state.grease=0;state.totalCleaned++;
    if(state.shift.running)state.shift.time=Math.max(0,state.shift.time-3);
    toast(`Griddle scraped clean · ${prior}% buildup removed${state.shift.running?' · 3s spent':''}.`,'good');sizzle(.15);persistRender();
  }
  function updateHeat(value){
    state.grillHeat=safeInt(Number(value),325,550,425);
    $('heatValue').textContent=state.grillHeat+'°F';
    $('heatRange').value=String(state.grillHeat);
    window.Burger3D?.setGrillEnvironment?.(state.grillHeat,state.grease,state.shift.running);
  }
  function toast(message,type='neutral') {
    const div=document.createElement('div');div.className='toast '+(type==='good'?'good':type==='bad'?'bad':'');div.textContent=message;
    $('toastRegion').appendChild(div);setTimeout(()=>div.remove(),3600);
  }
  function fail(message){toast(message,'bad');ding('bad')}
  function displayModal(content){$('modalRoot').hidden=false;$('modalRoot').innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-label="Burger Quest dialog"><button class="modal-close" aria-label="Close dialog" data-modal="close">×</button>'+content+'</div>'}
  function closeModal(){$('modalRoot').hidden=true;$('modalRoot').innerHTML=''}
  function showHowTo(){displayModal(`<span class="eyebrow">WELCOME TO YOUR NEXT OBSESSION</span><h2>THE ROAD TO BURGER RICHES</h2><p>Every patty is a payday. Turn one tiny stand into the most profitable burger empire in town.</p><div class="onboard-steps"><div><strong>01 · OPEN</strong>Hit <b>Open for business</b>. Choose a customer ticket and set your griddle heat (425–475°F is the sweet spot).</div><div><strong>02 · SEAR</strong>Drop raw beef on the grill. Tap when it says <b>FLIP NOW</b>, then tap again when <b>READY</b> to collect.</div><div><strong>03 · STACK</strong>Start a fresh bun. Tap cooked beef and toppings, or drag a topping onto the 3D plate. High-quality sears earn better tips; scrape grease between patties.</div><div><strong>04 · SERVE & GROW</strong>Serve the exact order before patience runs out. Restock, buy upgrades, and open new stands with the money you earn.</div></div><p class="keyboard-hint">Touch, mouse, and keyboard supported. Tab/Enter works on all controls. The game automatically pauses when you switch browser tabs.</p><div class="modal-actions"><button class="button primary" data-modal="gotit">LET'S GET GRILLING</button></div>`)}
  function showMenu(){displayModal(`<span class="eyebrow">BUSINESS OPERATIONS</span><h2>GAME SAVES & SETTINGS</h2><p>Your progress automatically saves to this browser when storage is available. Export your save for backup or to move to another device.</p><div class="modal-actions"><button class="button primary" data-modal="save">SAVE NOW</button><button class="button secondary" data-modal="export">EXPORT .JSON SAVE</button><button class="button subdued" data-modal="import">IMPORT SAVE</button></div><div class="modal-actions"><button class="button subdued" data-modal="help">HOW TO PLAY</button><button class="button subdued" data-modal="privacy">PRIVACY & DATA</button><button class="button subdued" data-modal="reset">NEW GAME / RESET</button></div><p class="keyboard-hint">If you open the standalone HTML as a file, some browsers may block local storage. The export option works as a manual backup.</p>`)}
  function showConfirmReset(){displayModal(`<span class="eyebrow">DANGER ZONE</span><h2>START A NEW BURGER EMPIRE?</h2><p class="danger-line">This will replace your current saved business, including cash, unlocked stands, stock, and upgrades. Export your progress first if you want a backup.</p><div class="modal-actions"><button class="button subdued" data-modal="close">KEEP MY GAME</button><button class="button heat" data-modal="confirmreset">RESET EVERYTHING</button></div>`)}
  function openShift() {
    if(state.shift.running){endShift(false);return}
    state.shift={running:true,paused:false,time:SHIFT_LENGTH,revenue:0,served:0,missed:0,tip:0};
    state.orders=[];state.selected=null;state.clock=0;state.nextSpawn=0;state.nextId=1;
    state.slots=Array(maxSlots()).fill(null);state.build={bun:false,layers:[],qualities:[]};state.streak=0;
    spawnOrder();state.nextSpawn=rand(12,16);
    toast('Doors open. Your first ticket is in!','good');ding('tap');persistRender();
  }
  function endShift(auto) {
    if(!state.shift.running)return;
    const oldDay=state.day;
    const otherIncome=state.owned.filter(i=>i!==state.active).reduce((sum,i)=>sum+STANDS[i].passive+((state.upgrades[String(i)]?.staff||0)*22)+((state.upgrades[String(i)]?.brand||0)*18),0);
    const costs=state.owned.reduce((sum,i)=>sum+STANDS[i].rent+((state.upgrades[String(i)]?.staff||0)*7),0);
    state.cash+=otherIncome;
    if(otherIncome)receipt('Other stands: daily sales',otherIncome);
    state.cash=Math.max(0,state.cash-costs);
    receipt('Daily rent and wages',-costs);
    const net=state.shift.revenue+otherIncome-costs;
    state.shift.running=false;state.shift.paused=false;state.orders=[];state.selected=null;
    state.slots=Array(maxSlots()).fill(null);state.build={bun:false,layers:[],qualities:[]};
    state.day++;
    persistRender();
    displayModal(`<span class="eyebrow">DAY ${String(oldDay).padStart(2,'0')} · ${auto?'CLOCKED OUT':'EARLY CLOSE'}</span><h2>THAT'S A WRAP.</h2><p>Count the money, clean the grill, and get ready for the next rush.</p><div class="modal-kpi-grid"><div>BURGERS SERVED<strong>${state.shift.served}</strong></div><div>ORDERS MISSED<strong>${state.shift.missed}</strong></div><div>ACTIVE STAND SALES<strong>${money(state.shift.revenue)}</strong></div><div>OTHER STANDS<strong>${money(otherIncome)}</strong></div><div>RENT & WAGES<strong>${money(costs)}</strong></div><div>DAY PROFIT / LOSS<strong class="${net>=0?'money-positive':'money-negative'}">${net<0?'-':''}${money(Math.abs(net))}</strong></div></div><p>Current cash: <b>${money(state.cash)}</b> · Reputation: <b>${state.rep.toFixed(1)} / 5</b></p><div class="modal-actions"><button class="button primary" data-modal="closeday">BACK TO THE STAND</button></div>`);
    if(net>0)ding('cash');
  }
  function selectedOrder(){return state.orders.find(o=>o.id===state.selected)||null}
  function recipeOf(order){return RECIPES.find(r=>r.id===order?.recipe)||RECIPES[0]}
  function spawnOrder(){
    if(state.orders.length>=MAX_QUEUE)return;
    const available=RECIPES.filter(r=>r.tier<=state.active);
    const choice=choose(available);
    const customer=Math.floor(rand(0,CUSTOMERS.length));
    const patience=Math.max(48,(80-state.active*5)*staffPatience()+rand(-9,17));
    const o={id:state.nextId++,recipe:choice.id,customer,patience,remaining:patience};
    state.orders.push(o);if(state.selected===null)state.selected=o.id;
    if(state.audio&&state.orders.length===1)ding('tap');
  }
  function missOrder(order){
    state.orders=state.orders.filter(o=>o.id!==order.id);
    state.shift.missed++;state.rep=clamp(state.rep-.14,1,5);state.streak=0;
    if(state.selected===order.id)state.selected=state.orders[0]?.id||null;
    toast(`${CUSTOMERS[order.customer].name} left. Reputation dropped.`,'bad');
    ding('bad');
  }
  function tick(dt){
    if(!state.shift.running||state.shift.paused)return;
    state.clock+=dt;state.shift.time=Math.max(0,state.shift.time-dt);
    state.orders.slice().forEach(o=>{o.remaining-=dt;if(o.remaining<=0)missOrder(o)});
    if(state.clock>=state.nextSpawn){spawnOrder();state.nextSpawn=state.clock+rand(12,16)}
    if(state.orders.length===0&&state.nextSpawn-state.clock>5)state.nextSpawn=state.clock+5;
    const f=cookFactor();
    for(const slot of state.slots){
      if(!slot)continue;
      const elapsed=state.clock-slot.started;
      if(slot.phase==='s1'&&elapsed>=3.1*f){slot.phase='flip';slot.started=state.clock}
      else if(slot.phase==='flip'&&elapsed>=4.8*f){slot.phase='burnt';state.burned++;toast('A patty burned! Clear the grill.','bad');ding('bad')}
      else if(slot.phase==='s2'&&elapsed>=2.9*f){slot.phase='ready';slot.started=state.clock}
      else if(slot.phase==='ready'&&elapsed>=5.7*f){slot.phase='burnt';state.burned++;toast('You left a cooked patty too long!','bad')}
    }
    if(state.shift.time<=0)endShift(true);
  }
  function dropPatty(){
    if(!state.shift.running||state.shift.paused)return fail('Open an active shift to cook.');
    if(state.stock.raw<=0)return fail('Out of raw patties — restock beef in STOCK.');
    let index=state.slots.findIndex(s=>s===null);
    if(index<0)return fail('All burners are occupied. Flip, collect or clear a slot.');
    state.stock.raw--;state.slots[index]={phase:'s1',started:state.clock,flipped:false,perfect:false};state.grease=clamp(state.grease+1.5,0,100);sizzle(.40);ding();persistRender();
  }
  function tapGrill(index){
    if(!state.shift.running||state.shift.paused)return fail('The grill is closed or paused.');
    const slot=state.slots[index];if(!slot)return dropPatty();
    if(slot.phase==='flip'){
      slot.perfect=(state.clock-slot.started)<=1.7*cookFactor();
      slot.flipped=true;slot.phase='s2';slot.started=state.clock;state.grease=clamp(state.grease+3,0,100);sizzle(.22);
      if(slot.perfect){state.perfectFlips++;toast('PERFECT FLIP! Nice sear.','good')}
      ding();
    }else if(slot.phase==='ready'){
      const grade=searGrade(slot);state.cooked++;state.cookedQuality.push(grade);state.slots[index]=null;
      state.grease=clamp(state.grease+4,0,100);toast(`Patty collected · sear ${grade}/100`,grade>=80?'good':'neutral');ding('cash');
    }else if(slot.phase==='burnt'){
      state.slots[index]=null;toast('Burnt patty discarded.');ding('bad');
    }else toast('Still sizzling! Flip when the grill says FLIP NOW.');
    persistRender();
  }
  function startBurger(){
    if(!state.shift.running||state.shift.paused)return fail('Open an active shift first.');
    if(!selectedOrder())return fail('Select a customer ticket first.');
    if(state.build.bun)return fail('Already building! Serve, undo or discard your current burger.');
    if(state.stock.bun<=0)return fail('You need fresh buns. Buy stock from the back office.');
    state.stock.bun--;state.build={bun:true,layers:[],qualities:[]};ding();persistRender();
  }
  function addIngredient(key,placement){
    if(!state.shift.running||state.shift.paused)return fail('Open an active shift first.');
    if(!state.build.bun)return fail('Start with a fresh bun first.');
    if(!Object.hasOwn(INGREDIENTS,key)||INGREDIENTS[key].tier>state.active)return;
    if(state.build.layers.length>=18)return fail('That burger is too tall. Undo a topping first.');
    if(key==='beef'){
      if(state.cooked<=0)return fail('You need a cooked patty. Fire up the grill first.');
      state.cooked--;
      state.build.qualities.push(state.cookedQuality.pop()??75);
    } else {
      if(state.stock[key]<=0)return fail(`Out of ${INGREDIENTS[key].label}. Restock first.`);
      state.stock[key]--;
    }
    state.build.layers.push(key);
    if(placement)window.Burger3D?.setNextDrop?.(placement.x,placement.z);
    ding();persistRender();
  }
  function undo(){
    const key=state.build.layers.pop();
    if(key){if(key==='beef'){state.cooked++;state.cookedQuality.push(state.build.qualities.pop()??75)}else state.stock[key]++}
    else if(state.build.bun){state.build.bun=false;state.stock.bun++}
    else return;
    ding();persistRender();
  }
  function trash(){
    if(!state.build.bun)return;
    state.build={bun:false,layers:[],qualities:[]};toast('Burger discarded. Used ingredients are lost.','bad');ding('bad');persistRender();
  }
  function buildCounts(){const counts={};for(const i of state.build.layers)counts[i]=(counts[i]||0)+1;return counts}
  function matchBurger(order){
    if(!state.build.bun||!order)return false;
    const required=recipeOf(order).req,added=buildCounts();
    return Object.keys({...required,...added}).every(k=>(required[k]||0)===(added[k]||0));
  }
  function serve(){
    if(!state.shift.running||state.shift.paused)return fail('Open an active shift first.');
    const o=selectedOrder();if(!o)return fail('Select a ticket before serving.');
    if(!matchBurger(o))return fail('Ticket does not match. Check missing and extra ingredients.');
    const recipe=recipeOf(o);
    const base=priceAtStand(recipe);
    const speedBonus=Math.round(clamp(o.remaining/o.patience,0,1)*5);
    const quality=state.build.qualities.length?Math.round(state.build.qualities.reduce((a,b)=>a+b,0)/state.build.qualities.length):75;
    const qualityBonus=Math.round(clamp((quality-72)/7,-5,5));
    const tip=Math.max(0,Math.round((2+speedBonus+Math.min(state.streak,5)+qualityBonus)*(1+getUpgrade('brand')*.25)));
    const gross=base+tip;
    const repay=state.debt>0?Math.min(state.debt,Math.floor(gross*.2)):0;
    state.debt-=repay;state.cash+=gross-repay;
    receipt(`Sold ${recipe.name} (+${money(tip)} tip)`,gross);
    if(repay)receipt('Supplier loan repayment',-repay);
    state.shift.revenue+=gross;state.shift.tip+=tip;state.shift.served++;
    state.served++;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);
    state.rep=clamp(state.rep+.035,1,5);
    state.orders=state.orders.filter(x=>x.id!==o.id);state.selected=state.orders[0]?.id||null;
    state.build={bun:false,layers:[],qualities:[]};
    const burst=$('saleBurst');if(burst){
      $('saleBurstAmount').textContent='+'+money(gross-repay);
      $('saleBurstDetail').textContent=recipe.name+' · '+quality+'/100 SEAR · '+money(tip)+' TIP';
      burst.hidden=false;burst.classList.remove('burst-animate');void burst.offsetWidth;burst.classList.add('burst-animate');
      clearTimeout(window.__bqSaleBurstTimeout);window.__bqSaleBurstTimeout=setTimeout(()=>{burst.hidden=true;},1550);
    }
    toast(`${CUSTOMERS[o.customer].name}: ${quality>=86?'INCREDIBLE SEAR!':quality>=70?'Delicious!':'Could use a better sear.'} ${money(gross-repay)} earned · ${money(tip)} tip · ${quality}/100`,quality>=70?'good':'neutral');ding('cash');
    if(state.cash>=25000&&state.owned.length===5&&!state.unlockedWealth){state.unlockedWealth=true;setTimeout(()=>showWealthModal(),350)}
    if(state.orders.length===0)state.nextSpawn=Math.min(state.nextSpawn,state.clock+2.5);
    persistRender();
  }
  function showWealthModal(){displayModal(`<span class="eyebrow">LEGENDARY ACHIEVEMENT</span><h2>BURGER EMPIRE BUILT.</h2><p>You grew a sidewalk cart into five stands and banked ${money(state.cash)}. You are officially a burger mogul. Keep serving to chase an even bigger fortune.</p><div class="modal-kpi-grid"><div>LIFETIME BURGERS<strong>${state.served.toLocaleString()}</strong></div><div>LOCATIONS OWNED<strong>${state.owned.length}</strong></div><div>DAY REACHED<strong>${state.day}</strong></div><div>CURRENT NET WORTH<strong>${money(state.cash-state.debt)}</strong></div></div><div class="modal-actions"><button class="button primary" data-modal="close">KEEP THE EMPIRE GROWING</button></div>`)}
  function buyStock(key,qty){
    const ing=key==='bun'?{label:'Burger buns',cost:2,tier:0}:key==='raw'?{label:'Raw beef patties',cost:3,tier:0}:INGREDIENTS[key];
    if(!ing||ing.tier>state.active)return fail('That ingredient is not unlocked yet.');
    const cost=Math.ceil(qty*ing.cost*(qty>=30?.92:1));
    if(state.cash<cost)return fail(`${money(cost)} needed. Serve orders or use supplier credit if eligible.`);
    state.cash-=cost;state.stock[key]+=qty;receipt(`Bought ${qty} ${ing.label}`,-cost);
    toast(`Restocked ${qty} ${ing.label} for ${money(cost)}.`,'good');ding('cash');persistRender();
  }
  function borrow(){
    if(state.cash>=50||state.debt>0)return fail('Supplier credit is available only when cash is below $50 with no existing loan.');
    state.cash+=100;state.debt+=120;state.ledger.unshift({day:state.day,label:'Emergency supplier credit (financing)',amount:100});
    toast('Received $100. You owe $120, repaid from future burger sales.','good');persistRender();
  }
  function buyStand(index){
    const stand=STANDS[index];if(!stand||state.owned.includes(index))return;
    if(state.shift.running)return fail('Close your current shift before opening a new location.');
    if(index!==state.owned.length)return fail('Expand in order to manage your growing business.');
    if(state.served<stand.sales)return fail(`Sell ${stand.sales} burgers first. ${state.served} sold so far.`);
    if(state.cash<stand.cost)return fail(`${money(stand.cost)} needed to open ${stand.label}.`);
    state.cash-=stand.cost;receipt(`Opened ${stand.label}`,-stand.cost);
    state.owned.push(index);state.upgrades[String(index)]={grill:0,staff:0,brand:0};state.active=index;
    state.slots=Array(maxSlots()).fill(null);
    toast(`GRAND OPENING! ${stand.label} is yours!`,'good');ding('cash');managementTab='empire';persistRender();
  }
  function travel(index){
    if(!state.owned.includes(index))return;
    if(state.shift.running)return fail('Finish the shift before switching locations.');
    state.active=index;state.slots=Array(maxSlots()).fill(null);
    state.orders=[];state.selected=null;state.build={bun:false,layers:[],qualities:[]};state.shift.time=SHIFT_LENGTH;
    toast(`Now managing ${STANDS[index].label}.`,'good');persistRender();
  }
  function upgrade(type){
    if(!UPGRADE_TYPES[type])return;
    if(state.shift.running)return fail('Upgrade your stand between shifts.');
    const level=getUpgrade(type);if(level>=3)return fail('This upgrade is already at MAX.');
    const cost=Math.ceil(UPGRADE_TYPES[type].base[level]*(1+state.active*.3));
    if(state.cash<cost)return fail(`${money(cost)} needed for ${UPGRADE_TYPES[type].name}.`);
    state.cash-=cost;receipt(`Upgraded ${STANDS[state.active].label}: ${type}`,-cost);
    state.upgrades[String(state.active)][type]++;state.slots=Array(maxSlots()).fill(null);
    toast(`${UPGRADE_TYPES[type].name} is now level ${level+1}!`,'good');ding('cash');persistRender();
  }
  function exportSave(){
    store();
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`burger-quest-day-${state.day}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('Save export started. Keep this JSON file as your backup.','good');
  }
  async function importSave(file){
    if(!file)return;
    if(file.size>2_000_000)return fail('Save file is too large.');
    try{
      const imported=sanitizeSave(JSON.parse(await file.text()));
      state=imported;store();closeModal();toast('Game imported. An active shift is paused so you can resume safely.','good');renderAll();
    }catch(err){fail(err?.message||'Save import failed.')}
  }
  function persistRender(){renderAll();store()}
  function renderHUD(){
    $('cashStat').textContent=money(state.cash);$('repStat').textContent='★'.repeat(Math.round(state.rep))+'☆'.repeat(5-Math.round(state.rep));
    $('repStat').title=state.rep.toFixed(2)+' / 5';$('servedStat').textContent=state.served.toLocaleString();
    $('dayStat').textContent=String(state.day).padStart(2,'0');
    const stand=STANDS[state.active];$('venueTitle').textContent=stand.name;$('venueSubtitle').textContent=stand.city;
    $('dayRevenue').textContent=money(state.shift.revenue);$('streakStat').textContent=state.streak;
    const nextStand=STANDS.findIndex((_,i)=>!state.owned.includes(i));
    let questTitle,questDetail,questProgress;
    if(nextStand>=0){
      const target=STANDS[nextStand];
      questTitle='OPEN '+target.name;
      questDetail=`${Math.min(state.served,target.sales)}/${target.sales} burgers sold · ${money(Math.min(state.cash,target.cost))}/${money(target.cost)} saved`;
      questProgress=50*Math.min(1,state.served/target.sales)+50*Math.min(1,state.cash/target.cost);
    }else{
      const goal=state.unlockedWealth?1000000:25000;
      questTitle=state.unlockedWealth?'THE MILLION-DOLLAR GRIND':'BECOME A BURGER MOGUL';
      questDetail=`Own all 5 stands. Bank ${money(goal)} (${money(state.cash)} saved).`;
      questProgress=Math.min(100,state.cash/goal*100);
    }
    $('questTitle').textContent=questTitle;$('questDetail').textContent=questDetail;$('questProgress').style.width=questProgress+'%';
    $('shiftStatus').textContent=state.shift.running?(state.shift.paused?'PAUSED · SAFE ON HOLD':'LIVE · CUSTOMERS WAITING'):'CLOSED · READY TO OPEN';
    $('timerText').textContent=String(Math.floor(state.shift.time/60)).padStart(2,'0')+':'+String(Math.ceil(state.shift.time%60)).padStart(2,'0');
    $('shiftBar').style.width=(state.shift.time/SHIFT_LENGTH*100)+'%';
    $('shiftButton').textContent=state.shift.running?'END TODAY’S SHIFT':'OPEN FOR BUSINESS';
    $('shiftButton').className='button '+(state.shift.running?'secondary':'primary');
    $('pauseButton').hidden=!state.shift.running;
    $('pauseButton').textContent=state.shift.paused?'RESUME':'PAUSE';
    $('soundButton').textContent=state.audio?'♫':'♪';$('soundButton').title=state.audio?'Sound on':'Sound off';
    $('cookedCount').textContent=state.cooked;$('rawCounter').textContent=`(${state.stock.raw} IN STOCK)`;
    $('addPatty').disabled=!state.shift.running||state.shift.paused||state.stock.raw<1;
    $('greaseValue').textContent=Math.round(state.grease)+'%';
    $('greaseFill').style.width=clamp(state.grease,0,100)+'%';
    $('greaseFill').className=state.grease>=70?'grease-danger':state.grease>=45?'grease-warning':'';
    $('cleanGrill').disabled=state.slots.some(Boolean)||state.grease<1||state.shift.paused;
    $('searReadout').textContent=state.grease>=70?'HIGH GREASE · CLEAN THE GRIDDLE':state.grillHeat>500?'HOT SEAR · FAST BURN RISK':state.grillHeat<375?'LOW HEAT · SLOW COOK':'SEAR ZONE · BALANCED';
    $('heatValue').textContent=state.grillHeat+'°F';
    window.Burger3D?.setGrillEnvironment?.(state.grillHeat,state.grease,state.shift.running);
  }
  function renderOrders(){
    $('queueCount').textContent=`${state.orders.length} / ${MAX_QUEUE}`;
    if(!state.orders.length){$('queue').innerHTML=`<div class="empty-state">${state.shift.running?'Next customer is on their way. Keep that grill hot.':'Open your stand to welcome your first customer.'}</div>`;return}
    $('queue').innerHTML=state.orders.map(o=>{
      const r=recipeOf(o),c=CUSTOMERS[o.customer],percent=clamp(o.remaining/o.patience,0,1)*100;
      const chips=Object.entries(r.req).map(([k,n])=>`<span class="mini-chip">${n}× ${e(INGREDIENTS[k].short)}</span>`).join('');
      return `<button class="order-card ${state.selected===o.id?'selected':''}" data-order="${o.id}" aria-label="Select order ${e(r.name)} for ${e(c.name)}"><div class="order-card-top"><span class="customer-avatar ${c.color}">${c.icon}</span><div><div class="customer-name">${e(c.name)}</div><div class="customer-want">${e(r.name)}</div></div><span class="price-tag">${money(priceAtStand(r))}</span></div><div class="order-mix">${chips}</div><div class="patience-line"><span class="patience-fill" style="width:${percent}%;background:${percent<28?'#f86658':percent<52?'#efb54a':'linear-gradient(90deg,#ffbe6a,#73d595)'}"></span></div><div class="patience-meta"><span>${percent<30?'HURRY!':'PATIENCE'}</span><b>${Math.ceil(o.remaining)}s</b></div></button>`;
    }).join('');
  }
  function renderGrill(){
    const labels={s1:'SEARING · SIDE A',flip:'FLIP NOW!',s2:'SEARING · SIDE B',ready:'READY · COLLECT',burnt:'BURNT · CLEAR'};
    $('grillSlots').innerHTML=state.slots.map((s,i)=>{
      const phase=s?.phase||'empty';const label=s?labels[phase]:'EMPTY BURNER';
      const elapsed=s?Math.max(0,state.clock-s.started):0;
      const time=phase==='s1'?`${Math.max(0,3.1*cookFactor()-elapsed).toFixed(1)}s until flip`:phase==='flip'?`${Math.max(0,4.8*cookFactor()-elapsed).toFixed(1)}s to burn`:phase==='s2'?`${Math.max(0,2.9*cookFactor()-elapsed).toFixed(1)}s to ready`:phase==='ready'?`${Math.max(0,5.7*cookFactor()-elapsed).toFixed(1)}s to burn`:phase==='burnt'?'Tap to remove':'Tap to drop a patty';
      return `<button class="grill-slot ${phase}" data-grill="${i}" aria-label="Burner ${i+1}: ${label}, ${time}" ${!state.shift.running||state.shift.paused?'disabled':''}><span class="grill-number">BURNER 0${i+1}</span>${s?'<span class="patty-drawing" aria-hidden="true"></span>':'<span class="patty-drawing" aria-hidden="true" style="opacity:.19;filter:grayscale(1)"></span>'}<span class="grill-status">${label}</span><span class="grill-time">${time}</span></button>`;
    }).join('');
    window.Burger3D?.setGrillSlots?.(state.slots);
  }
  function renderBuild(){
    const counts=buildCounts(),o=selectedOrder(),recipe=o?recipeOf(o):null;
    const chips=[];
    if(state.build.bun)chips.push('<span class="mini-chip matched">🥯 Bun pair</span>');
    for(const [k,n] of Object.entries(counts)){
      const wanted=recipe?.req?.[k]||0;const cl=n>wanted?'extra':wanted?'matched':'extra';
      chips.push(`<span class="mini-chip ${cl}">${n}× ${e(INGREDIENTS[k].short)}</span>`);
    }
    if(state.build.qualities.length){
      const grade=Math.round(state.build.qualities.reduce((a,b)=>a+b,0)/state.build.qualities.length);
      chips.push(`<span class="mini-chip ${grade>=80?'matched':'extra'}" title="Sear quality contributes to the customer's tip">SEAR ${grade}/100</span>`);
    }
    $('buildList').innerHTML=chips.length?chips.join(''):'Start with a toasted bun.';
    $('startBurger').disabled=state.build.bun||!state.shift.running||state.shift.paused||!o||state.stock.bun<=0;
    $('undoBurger').disabled=!state.build.bun||!state.shift.running||state.shift.paused;
    $('trashBurger').disabled=!state.build.bun||!state.shift.running||state.shift.paused;
    const match=matchBurger(o);
    $('serveBurger').disabled=!match||!state.shift.running||state.shift.paused;
    $('serveBurger').textContent=match?`SERVE FOR ${money(priceAtStand(recipe))}+ →`:'SERVE THIS BURGER →';
    $('buildStatus').className='status-tag'+(match?' ready':'');
    $('buildStatus').textContent=!state.build.bun?'EMPTY BOARD':match?'READY TO SERVE':`${state.build.layers.length} LAYERS STACKED`;
    if(!o)$('orderHint').textContent='Select a customer ticket to see its required ingredients.';
    else{
      const missing=Object.entries(recipe.req).filter(([k,n])=>(counts[k]||0)<n).map(([k,n])=>`${n-(counts[k]||0)}× ${INGREDIENTS[k].short}`);
      const extra=Object.entries(counts).filter(([k,n])=>n>(recipe.req[k]||0)).map(([k,n])=>`${n-(recipe.req[k]||0)}× extra ${INGREDIENTS[k].short}`);
      $('orderHint').textContent=match?`Perfect! ${CUSTOMERS[o.customer].name}'s ${recipe.name} is ready. Serve it while it's hot.`:!state.build.bun?'Start a fresh bun, then add: '+Object.entries(recipe.req).map(([k,n])=>`${n}× ${INGREDIENTS[k].short}`).join(' · '):[missing.length?'Still needed: '+missing.join(', '):'',extra.length?'Remove: '+extra.join(', '):''].filter(Boolean).join(' | ')||'Add the ingredients on the ticket.';
    }
    window.Burger3D?.setLayers(state.build.bun ? state.build.layers : [],state.build.bun);
    if (!window.Burger3D?.status().active) drawBurger();
  }
  function renderIngredients(){
    $('ingredientBar').innerHTML=Object.entries(INGREDIENTS).map(([k,i])=>{
      const count=k==='beef'?state.cooked:state.stock[k];
      const locked=i.tier>state.active;
      const disabled=locked||!state.build.bun||count===0||!state.shift.running||state.shift.paused;
      return `<button class="ingredient-button" data-ingredient="${k}" ${disabled?'disabled':''} aria-label="Add ${e(i.label)}. ${locked?'Locked':`${count} available`}"><span class="ingredient-icon">${i.icon}</span><strong>${e(i.short)}</strong><span>${locked?'LOCKED':`IN STOCK ${count}`}</span></button>`;
    }).join('');
    // Compact topping shelf is inside the viewport so touch users can drag into the plate
    // without needing to scroll from the separate topping station.
    $('dragDock').innerHTML=Object.entries(INGREDIENTS).map(([k,i])=>{
      const count=k==='beef'?state.cooked:state.stock[k];
      const locked=i.tier>state.active;
      const disabled=locked||!state.build.bun||count===0||!state.shift.running||state.shift.paused;
      const o=selectedOrder(),n=o?(recipeOf(o).req[k]||0):0;
      const need=n>(buildCounts()[k]||0);
      return `<button type="button" class="dock-ingredient ${need&&!disabled?'next-needed':''}" data-ingredient="${k}" ${disabled?'disabled':''} aria-label="Add ${e(i.label)}, ${count} available"><span>${i.icon}</span><b>${e(i.short)}</b><small>${locked?'🔒':count}</small></button>`;
    }).join('');
  }
  function renderManagement(){
    document.querySelectorAll('.tabs button').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===managementTab)));
    const cont=$('manageContent');
    if(managementTab==='supplies'){
      const rows=[['bun','Burger bun pairs','🥯',2,0],['raw','Raw beef patties','🥩',3,0],...Object.entries(INGREDIENTS).filter(([k])=>k!=='beef').map(([k,v])=>[k,v.label,v.icon,v.cost,v.tier])];
      cont.innerHTML=`<p class="management-intro">Buy supplies at wholesale cost. A 30-pack saves 8%. Purchased ingredients are shared across your locations.</p>`+rows.map(([k,label,icon,cost,tier])=>{
        if(tier>state.active)return `<div class="stock-row"><div class="stock-row-top"><span class="stock-row-title"><span class="stock-emoji">${icon}</span>${e(label)}</span><span class="stock-count">LOCKED</span></div><div class="stock-note">Unlock at ${STANDS[tier].label}.</div></div>`;
        const cost10=10*cost,cost30=Math.ceil(30*cost*.92);
        return `<div class="stock-row"><div class="stock-row-top"><span class="stock-row-title"><span class="stock-emoji">${icon}</span>${e(label)}</span><span class="stock-count ${state.stock[k]<=3?'stock-low':''}">×${state.stock[k]}</span></div><div class="stock-actions"><button class="button subdued small" data-buy="${k}:10" ${state.cash<cost10?'disabled':''}>+10 · ${money(cost10)}</button><button class="button subdued small" data-buy="${k}:30" ${state.cash<cost30?'disabled':''}>+30 · ${money(cost30)}</button></div></div>`;
      }).join('')+`<div class="tip-box"><strong>SUPPLIER CREDIT</strong><p>Running out of cash? Take $100 in inventory funding and repay $120 from later sales.</p><button class="button subdued small" style="width:100%;margin-top:9px" data-borrow="1" ${state.cash>=50||state.debt>0?'disabled':''}>BORROW $100</button><p>OUTSTANDING: ${money(state.debt)}</p></div>`;
    }else if(managementTab==='empire'){
      cont.innerHTML=`<p class="management-intro">Own all five burger stands. Your other locations earn daily revenue after each shift. Switch stands between shifts.</p>`+STANDS.map((s,i)=>{
        const owned=state.owned.includes(i),active=state.active===i,unlockable=state.owned.length===i;
        const button=active?'<button class="button subdued small" disabled>MANAGING THIS LOCATION</button>':owned?`<button class="button secondary small" data-travel="${i}" ${state.shift.running?'disabled':''}>MANAGE THIS STAND</button>`:`<button class="button primary small" data-stand="${i}" ${!unlockable||state.cash<s.cost||state.served<s.sales||state.shift.running?'disabled':''}>OPEN · ${money(s.cost)}</button>`;
        return `<div class="stand-row ${owned?'owned':''} ${active?'active':''}"><div class="stand-top"><h3>${e(s.label)}</h3><span class="stand-indicator">${active?'CURRENT':owned?'OWNED':unlockable?'NEXT UP':'LOCKED'}</span></div><p>${e(s.description)}</p><div class="stock-note">${owned?`Daily overhead ${money(s.rent)} · Base side revenue ${money(s.passive)}`:`Needs ${s.sales} lifetime sales (${state.served} achieved)`}</div><div style="margin-top:10px">${button}</div></div>`;
      }).join('');
    }else if(managementTab==='upgrades'){
      cont.innerHTML=`<p class="management-intro">Upgrades apply to <b>${e(STANDS[state.active].label)}</b>. Purchase between shifts; upgrades stay with their stand.</p>`+Object.entries(UPGRADE_TYPES).map(([k,u])=>{
        const lvl=getUpgrade(k),cost=lvl<3?Math.ceil(u.base[lvl]*(1+state.active*.3)):0;
        return `<div class="upgrade-row"><div class="up-row-top"><h3>${e(u.name)}</h3><span class="upgrade-level">LEVEL ${lvl}/3</span></div><p>${e(u.desc)}</p><button class="button ${lvl===3?'subdued':'primary'} small" data-upgrade="${k}" ${lvl>=3||state.cash<cost||state.shift.running?'disabled':''}>${lvl>=3?'MAXED OUT':`UPGRADE · ${money(cost)}`}</button></div>`;
      }).join('')+`<div class="tip-box"><strong>CURRENT EFFECTS</strong><p>Grill slots: ${maxSlots()} · Speed: ${Math.round((1-cookFactor())*100)}% faster · Patience: +${Math.round((staffPatience()-1)*100)}% · Tip boost: +${getUpgrade('brand')*25}%</p></div>`;
    }else{
      cont.innerHTML=`<div class="ledger-summary"><div class="eyebrow">LIFETIME SALES · CASH FLOW</div><strong>${money(state.lifetimeRevenue)}</strong><div class="stock-note">Lifetime spending ${money(state.lifetimeCosts)} · Current debt ${money(state.debt)} · Peak streak ${state.bestStreak} · Perfect flips ${state.perfectFlips} · Burnt patties ${state.burned}</div></div>`+(!state.ledger.length?'<div class="empty-state">Your first sale will appear here.</div>':state.ledger.map(x=>`<div class="ledger-row"><div><b>${e(x.label)}</b><time>DAY ${x.day}</time></div><strong class="${x.amount>=0?'money-positive':'money-negative'}">${x.amount>=0?'+':'−'}${money(Math.abs(x.amount))}</strong></div>`).join(''));
    }
  }
  /* Food illustration is drawn with native Canvas, with no external image or network dependency. */
  function drawBurger(){
    const canvas=$('burgerCanvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const W=620,H=380;ctx.clearRect(0,0,W,H);
    const x=310;
    const ellipse=(cx,cy,rx,ry,fill,stroke)=>{ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}};
    const rr=(x0,y,w,h,r,fill)=>{ctx.beginPath();ctx.roundRect(x0,y,w,h,r);ctx.fillStyle=fill;ctx.fill()};
    const gradient=(top,bottom,y1,y2)=>{let g=ctx.createLinearGradient(0,y1,0,y2);g.addColorStop(0,top);g.addColorStop(1,bottom);return g};
    ellipse(310,327,219,29,'#120c0b50');
    ellipse(310,329,203,30,'#fff3d7');ellipse(310,326,181,22,'#c6ab91');ellipse(310,326,172,20,'#ffe5c7');
    if(!state.build.bun){
      ctx.font='950 26px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffead8b9';ctx.fillText('YOUR NEXT MASTERPIECE',x,200);
      ctx.font='600 14px system-ui';ctx.fillStyle='#e4bca4';ctx.fillText('A toasted bun is where the magic begins.',x,225);return;
    }
    let y=303;
    // bottom toasted bun with front lip and highlight
    rr(172,y-21,276,36,17,gradient('#f4ac55','#a7562e',y-21,y+15));
    ellipse(x,y-19,135,17,'#f1bb73','#fff2bc');
    rr(180,y+4,260,10,5,'#a85a30');
    const thickness={beef:26,cheese:15,pickle:12,onion:14,tomato:15,lettuce:17,chili:12,garlic:17,bacon:16,sauce:11};
    function waveLayer(y0,h,fill,stroke){
      ctx.beginPath();ctx.moveTo(173,y0+6);
      for(let t=0;t<=20;t++){let xx=173+t*13.7,yy=y0+Math.sin(t*1.8)*4;ctx.lineTo(xx,yy)}
      ctx.lineTo(447,y0+h-4);
      for(let t=20;t>=0;t--){let xx=173+t*13.7,yy=y0+h+Math.sin(t*1.5+1)*4;ctx.lineTo(xx,yy)}
      ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();
    }
    for(let li=0;li<state.build.layers.length;li++){
      const key=state.build.layers[li],h=thickness[key];y-=h;
      if(key==='beef'){
        rr(171,y,278,h+4,14,gradient('#a15b32','#58251a',y,y+h+4));
        ellipse(x,y+7,136,7,'#bb7740');
        ctx.strokeStyle='#31140fb0';ctx.lineWidth=5;
        for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(207+j*34,y+6);ctx.lineTo(221+j*34,y+16);ctx.stroke()}
        ellipse(226,y+8,5,2,'#e7ac66');ellipse(393,y+5,7,2,'#b67d40');
      } else if(key==='cheese'){
        ctx.beginPath();ctx.moveTo(165,y);ctx.lineTo(444,y);ctx.lineTo(450,y+h*.55);ctx.lineTo(423,y+h*.78);ctx.lineTo(408,y+h+5);ctx.lineTo(393,y+h*.7);ctx.lineTo(250,y+h*.8);ctx.lineTo(222,y+h+6);ctx.lineTo(211,y+h*.65);ctx.lineTo(171,y+h);ctx.closePath();ctx.fillStyle=gradient('#ffe879','#edb83c',y,y+h+4);ctx.fill();
      }else if(key==='pickle'){
        waveLayer(y,h,'#628e38','#aaca55');for(let j=0;j<5;j++)ellipse(200+j*52,y+5,19,5,'#b3d46d','#315b27');
      }else if(key==='onion'){
        waveLayer(y,h,'#c99457','#f3be74');ctx.strokeStyle='#ffe0ab';ctx.lineWidth=3;for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(194+j*56,y+7,27,5,.12,0,Math.PI*2);ctx.stroke()}
      }else if(key==='tomato'){
        waveLayer(y,h,'#a93027','#f56c45');for(let j=0;j<5;j++)ellipse(202+j*51,y+5,23,6,'#e94c38','#ffd0a0');
      }else if(key==='lettuce'||key==='garlic'){
        waveLayer(y,h,key==='garlic'?'#679d38':'#5f9c43',key==='garlic'?'#e7dd7b':'#9ce56d');
        for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(177+j*43,y+6);ctx.quadraticCurveTo(188+j*43,y-6,203+j*43,y+6);ctx.strokeStyle=key==='garlic'?'#b7d66b':'#c1ed81';ctx.lineWidth=2;ctx.stroke();}
        if(key==='garlic')for(let j=0;j<8;j++)ellipse(185+j*35,y+7+(j%2)*3,5,2,'#ffe36d');
      }else if(key==='chili'){
        waveLayer(y,h,'#ae392c','#f37844');for(let j=0;j<9;j++)ellipse(178+j*30,y+5,10,4,j%2?'#b9b834':'#ee5d32');
      }else if(key==='bacon'){
        waveLayer(y,h,'#8b332c','#ec9360');ctx.strokeStyle='#f0b78b';ctx.lineWidth=4;for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(183,y+j*3);ctx.bezierCurveTo(240,y+9,308,y-4,438,y+j*3);ctx.stroke()}
      }else if(key==='sauce'){
        waveLayer(y,h,'#e8ae76','#ffd7a1');ctx.strokeStyle='#f8d19e';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(173,y+2);for(let j=0;j<20;j++)ctx.lineTo(185+j*13,y+4+Math.sin(j*2)*5);ctx.stroke();
      }
    }
    y-=12;
    // toasted bun top: dramatic dome and sesame seeds
    ctx.beginPath();ctx.moveTo(173,y+23);ctx.bezierCurveTo(183,y-55,232,y-72,309,y-76);ctx.bezierCurveTo(394,y-75,434,y-46,447,y+23);ctx.closePath();
    ctx.fillStyle=gradient('#ffe099','#ce7b38',y-80,y+25);ctx.fill();ctx.strokeStyle='#995326';ctx.lineWidth=4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(189,y+12);ctx.bezierCurveTo(210,y-31,252,y-47,301,y-50);ctx.strokeStyle='#fff0a370';ctx.lineWidth=10;ctx.stroke();
    for(let i=0;i<28;i++){
      const xx=202+((i*47)%208),arc=(xx-310)/135, maxTop=-60+arc*arc*30;
      const yy=y+maxTop+((i*29)%31)-4;
      ellipse(xx,yy,4.3,2.1,'#fff0ba');
    }
    // glistening sauce drops near the burger
    if(state.build.layers.includes('garlic')){
      ellipse(440,Math.min(320,y+18),5,10,'#ffc56c');ellipse(180,Math.min(321,y+9),4,7,'#f6cf6d');
    }
    ctx.font='900 13px system-ui';ctx.fillStyle='#ffebd7';ctx.textAlign='center';ctx.fillText(`${state.build.layers.length} HAND-STACKED LAYERS`,x,359);
  }
  function renderLiveTicket(){
    const root=$('liveTicket');if(!root)return;
    const o=selectedOrder(),r=o?recipeOf(o):null;
    $('ticketNext').disabled=state.orders.length<2;
    $('ticketNext').title=state.orders.length<2?'Only one customer ticket':'Switch to next customer';
    if(!r){
      $('liveTicketLabel').textContent=state.shift.running?'AWAITING NEXT CUSTOMER':'LIVE PREP TICKET';
      $('liveTicketName').textContent=state.shift.running?'NEXT ORDER INCOMING':'OPEN YOUR BURGER STAND';
      $('liveTicketTimer').textContent='—';$('liveTicketChips').textContent=state.shift.running?'Keep the grill ready.':'Open a shift to start serving.';
      $('liveTicketBar').style.width='0%';$('liveTicketProgress').setAttribute('aria-valuenow','0');
      $('liveTicketAction').textContent=state.shift.running?'A new ticket will appear soon.':'Tap START to open for business.';
      root.dataset.ready='false';return;
    }
    const counts=buildCounts(),req=Object.entries(r.req);
    const done=req.reduce((sum,[k,n])=>sum+Math.min(n,counts[k]||0),0),total=req.reduce((sum,[k,n])=>sum+n,0);
    const extras=Object.entries(counts).filter(([k,n])=>n>(r.req[k]||0));
    const ready=state.build.bun&&done===total&&extras.length===0;
    const progress=Math.round((done+(state.build.bun?1:0))/(total+1)*100);
    $('liveTicketLabel').textContent='CUSTOMER '+CUSTOMERS[o.customer].name.toUpperCase()+' · '+money(priceAtStand(r));
    $('liveTicketName').textContent=r.name;
    $('liveTicketTimer').textContent=Math.ceil(o.remaining)+'s';
    $('liveTicketTimer').className=o.remaining<18?'time-critical':o.remaining<35?'time-warning':'';
    $('liveTicketChips').innerHTML='<span class="recipe-token '+(state.build.bun?'complete':'needed')+'">'+(state.build.bun?'✓':'○')+' Bun</span>'+req.map(([k,n])=>{
      const c=counts[k]||0;
      return '<span class="recipe-token '+(c>=n?'complete':'needed')+'">'+(c>=n?'✓':'○')+' '+e(INGREDIENTS[k].short)+' '+Math.min(c,n)+'/'+n+'</span>';
    }).join('')+extras.map(([k,n])=>'<span class="recipe-token excess">! Extra '+e(INGREDIENTS[k].short)+' ×'+(n-(r.req[k]||0))+'</span>').join('');
    $('liveTicketBar').style.width=progress+'%';$('liveTicketProgress').setAttribute('aria-valuenow',String(progress));
    $('liveTicketAction').textContent=ready?'READY — PRESS SERVE TO COLLECT '+money(priceAtStand(r)):
      !state.build.bun?'START WITH A BUN':extras.length?'REMOVE EXTRA INGREDIENTS WITH UNDO':
      req.find(([k,n])=>(counts[k]||0)<n)?.[0]==='beef'&&state.cooked<=0?'GRILL AND COLLECT YOUR BEEF':
      'ADD THE HIGHLIGHTED INGREDIENTS';
    root.dataset.ready=String(ready);
  }
  function renderAll(){renderHUD();renderOrders();renderGrill();renderBuild();renderIngredients();renderManagement();renderLiveTicket()}
  function onClick(event){
    const target=event.target.closest('[data-order],[data-grill],[data-ingredient],[data-buy],[data-borrow],[data-stand],[data-travel],[data-upgrade],[data-modal]');if(!target)return;
    if(target.disabled)return;
    if(!$('modalRoot').hidden&&!target.closest('#modalRoot'))return;
    if(target.dataset.order){state.selected=Number(target.dataset.order);renderAll();return}
    if(target.dataset.grill!==undefined)return tapGrill(Number(target.dataset.grill));
    if(target.dataset.ingredient)return addIngredient(target.dataset.ingredient);
    if(target.dataset.buy){const [k,q]=target.dataset.buy.split(':');return buyStock(k,Number(q))}
    if(target.dataset.borrow)return borrow();
    if(target.dataset.stand!==undefined)return buyStand(Number(target.dataset.stand));
    if(target.dataset.travel!==undefined)return travel(Number(target.dataset.travel));
    if(target.dataset.upgrade)return upgrade(target.dataset.upgrade);
    if(target.dataset.modal){
      const action=target.dataset.modal;
      if(action==='close'||action==='gotit'||action==='closeday')return closeModal();
      if(action==='help')return showHowTo();
      if(action==='privacy')return displayModal('<span class="eyebrow">DATA AND PRIVACY</span><h2>YOUR GAME, YOUR DEVICE</h2><p>This release uses no accounts, analytics, advertising trackers or online payments. Progress is stored in your browser. You can export or reset it from the Save / Menu screen. Clearing browser/site data can delete progress.</p><p>The game loads its resources from the same website origin and is designed to work offline after its assets are cached. Hosting companies may collect ordinary web-server access logs under their own policies.</p><p><a class="policy-link" href="privacy.html" target="_blank" rel="noopener noreferrer">Full privacy notice</a></p><div class="modal-actions"><button class="button primary" data-modal="close">CLOSE</button></div>');
      if(action==='save'){store();toast('Game saved.','good');return closeModal()}
      if(action==='export')return exportSave();
      if(action==='import')return $('importInput').click();
      if(action==='reset')return showConfirmReset();
      if(action==='confirmreset'){state=freshGame();store();closeModal();managementTab='supplies';renderAll();return showHowTo()}
    }
  }
  function attachDragDrop(){
    const bars=[$('ingredientBar'),$('dragDock')],stage=$('burgerStage');
    let drag=null,ghost=null,ignoreClickUntil=0;
    document.addEventListener('click',ev=>{if(performance.now()<ignoreClickUntil && ev.target.closest('[data-ingredient]')){ev.stopImmediatePropagation();ev.preventDefault();ignoreClickUntil=0;}},true);
    const moveGhost=(x,y)=>{if(ghost){ghost.style.left=x+'px';ghost.style.top=y+'px'}};
    const clear=()=>{ghost?.remove();ghost=null;stage.classList.remove('drop-target');drag=null};
    for(const bar of bars){bar.addEventListener('pointerdown',ev=>{
      const btn=ev.target.closest('[data-ingredient]');if(!btn||btn.disabled||ev.button>0)return;
      drag={id:ev.pointerId,btn,key:btn.dataset.ingredient,x:ev.clientX,y:ev.clientY,moving:false};
      try{btn.setPointerCapture(ev.pointerId)}catch(_){}
    });
    bar.addEventListener('pointermove',ev=>{
      if(!drag||ev.pointerId!==drag.id)return;
      if(!drag.moving&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)>9){
        drag.moving=true;ghost=document.createElement('div');ghost.className='ingredient-drag-ghost';
        ghost.textContent=drag.btn.querySelector('strong')?.textContent||drag.key;document.body.appendChild(ghost);stage.classList.add('drop-target');
      }
      if(drag.moving){moveGhost(ev.clientX,ev.clientY);ev.preventDefault()}
    });
    bar.addEventListener('pointerup',ev=>{
      if(!drag||ev.pointerId!==drag.id)return;
      if(drag.moving){
        ignoreClickUntil=performance.now()+600;
        const r=stage.getBoundingClientRect(),x=ev.clientX,y=ev.clientY;
        if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
          const nx=clamp((x-r.left)/r.width,0,1),nz=clamp((y-r.top)/r.height,0,1);
          const key=drag.key;clear();addIngredient(key,{x:(nx-.5)*1.05,z:(nz-.5)*.83});return;
        }
      }
      clear();
    });
    bar.addEventListener('pointercancel',clear);}
  }
  function attachEvents(){
    document.addEventListener('click',onClick);
    $('shiftButton').addEventListener('click',openShift);
    $('ticketNext')?.addEventListener('click',()=>{
      const i=state.orders.findIndex(o=>o.id===state.selected);
      if(state.orders.length<2)return;
      state.selected=state.orders[(i+1)%state.orders.length].id;
      renderAll();store();
    });
    $('pauseButton').addEventListener('click',()=>{state.shift.paused=!state.shift.paused;lastFrame=performance.now();persistRender()});
    $('addPatty').addEventListener('click',dropPatty);
    $('heatRange').addEventListener('input',ev=>{updateHeat(ev.target.value);renderGrill()});
    $('heatRange').addEventListener('change',()=>{store();renderAll()});
    $('cleanGrill').addEventListener('click',cleanGriddle);
    $('startBurger').addEventListener('click',startBurger);
    $('undoBurger').addEventListener('click',undo);
    $('trashBurger').addEventListener('click',trash);
    $('serveBurger').addEventListener('click',serve);
    $('soundButton').addEventListener('click',()=>{state.audio=!state.audio;persistRender();ding()});
    $('helpButton').addEventListener('click',showHowTo);
    $('menuButton').addEventListener('click',showMenu);
    document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{managementTab=b.dataset.tab;renderManagement()}));
    $('importInput').addEventListener('change',async ev=>{await importSave(ev.target.files?.[0]);ev.target.value=''});
    $('modalRoot').addEventListener('click',event=>{if(event.target===$('modalRoot'))closeModal()});
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('modalRoot').hidden)closeModal()});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&&state.shift.running&&!state.shift.paused){state.shift.paused=true;store()}
      lastFrame=performance.now();
      if(!document.hidden)renderAll();
    });
    attachDragDrop();
    window.addEventListener('beforeunload',store);
  }
  function loop(now){
    const dt=Math.min(.5,(now-lastFrame)/1000);lastFrame=now;
    if(!document.hidden){tick(dt);renderWait+=dt;saveWait+=dt;
      if(renderWait>=.23){renderHUD();renderOrders();renderGrill();renderBuild();renderLiveTicket();renderWait=0}
      if(saveWait>=3){store();saveWait=0}
    }
    requestAnimationFrame(loop);
  }
  function init(){
    const loaded=load();state=loaded||freshGame();
    if(loaded&&state.shift.running){state.shift.paused=true;toast('Your saved shift is paused. Tap RESUME to continue.','good')}
    attachEvents();renderAll();
    updateHeat(state.grillHeat);
    if(!state.onboardingSeen){state.onboardingSeen=true;store()}
    else if(!loaded&&!storageAvailable)toast('Browser storage is limited. Export saves regularly.','bad');
    requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // Read-only diagnostics for browser smoke tests, not a gameplay cheat interface.
  window.BurgerQuestDiagnostics=Object.freeze({snapshot:()=>({cash:state?.cash,day:state?.day,served:state?.served,shift:state?.shift,orders:state?.orders?.length,stock:state?.stock,build:state?.build,slots:state?.slots,active:state?.active,owned:state?.owned,grillHeat:state?.grillHeat,grease:state?.grease,cookedQuality:state?.cookedQuality})});
})();