/* Burger Quest: Restaurant Empire Public Release 6.0. Self-contained WebGL 1 kitchen renderer.
 * No third-party runtime, network calls, tracking, WebGL readbacks or eval.
 * Physics uses fixed-timestep sphere/disc support collision with restitution,
 * gravity, lateral friction and angular damping. Not a deformable/fluid solver. */
(() => {
'use strict';
const canvas=document.getElementById('burger3D');
const fallback=document.getElementById('burgerCanvas');
const badge=document.getElementById('engineBadge');
const msg=document.getElementById('labMessage');
const layerInspector=document.getElementById('layerInspector');
const explodeInput=document.getElementById('explodeRange');
const explodeLabel=document.getElementById('explodePercent');
const modes=document.querySelectorAll('[data-3d-mode]');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let gl=null,canvasW=0,canvasH=0,program=null,pointProgram=null,tex=null,valid=false;
let u={},a={},pu={},pa={},resources=[];
const MAT={bun:[0,0],beef:[1,0],cheese:[2,0],lettuce:[3,0],tomato:[0,1],pickle:[1,1],onion:[2,1],chili:[3,1],griddle:[0,2],steel:[1,2],wood:[2,2],tile:[3,2]};
const shades={bun:[1,1,1],beef:[1,1,1],cheese:[1,1,1],lettuce:[1,1,1],tomato:[1,1,1],pickle:[1,1,1],onion:[1,1,1],chili:[1,1,1],griddle:[.78,.8,.85],steel:[.85,.89,.99],wood:[.85,.7,.57],tile:[.82,.9,.91]};
let mode='showcase',cam='hero',fx='high',explode=0,showcase=['beef','cheese','beef','cheese','pickle','onion','tomato','lettuce','chili','garlic'];
let currentLayers=[],currentHasBun=false,burgerBodies=[],grillSlots=[],selected=-1,yaw=.45,pitch=.34,zoom=1;
let orbitInertia=0,particles=[],hitBursts=[],timePrev=0,physAccum=0,menuPaused=false,drawCount=0,contextsLost=0;
let pendingDrop=null, grillHeat=425, grease=0, shiftOpen=false, turntable=false,lastDraw=0;
const heights={bottom:.33,top:.66,beef:.30,cheese:.12,pickle:.12,onion:.10,tomato:.13,lettuce:.18,chili:.09,garlic:.18,bacon:.13,sauce:.08};
const foodLabel={bottom:'Toasted bottom bun',top:'Glazed sesame crown',beef:'Griddle-smashed beef',cheese:'Melting cheddar',pickle:'Dill pickle chips',onion:'Caramelized onions',tomato:'Tomato slices',lettuce:'Crisp romaine',chili:'Chopped chili peppers',garlic:'Garlic-butter romaine',bacon:'Smoked bacon',sauce:'House sauce'};
const plate={x:1.45,y:.34,z:.45};
const seed=(n)=>{const x=Math.sin(n*127.1+78.233)*43758.5453123;return x-Math.floor(x)};
const v3=(x=0,y=0,z=0)=>[x,y,z];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{let d=Math.hypot(...v)||1;return v.map(n=>n/d)};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function identity(){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])}
function scaleMat(x,y,z){let m=identity();m[0]=x;m[5]=y;m[10]=z;return m}
function translateMat(x,y,z){let m=identity();m[12]=x;m[13]=y;m[14]=z;return m}
function rotateYMat(r){let m=identity(),c=Math.cos(r),s=Math.sin(r);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
function rotateZMat(r){let m=identity(),c=Math.cos(r),s=Math.sin(r);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m}
function mul(a,b){const r=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)r[j*4+i]+=a[k*4+i]*b[j*4+k];return r}
function place(x,y,z,rot=0,sx=1,sy=1,sz=1){return mul(mul(translateMat(x,y,z),rotateYMat(rot)),scaleMat(sx,sy,sz))}
function lookAt(e,t){let z=norm(sub(e,t)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}
function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*near*far/(near-far),0])}
class Builder{
 constructor(){this.out=[]}
 tri(a,b,c,uvA=[0,0],uvB=[1,0],uvC=[0,1],flip=false){let n=norm(cross(sub(b,a),sub(c,a)));if(flip)n=n.map(x=>-x);for(const [p,uv] of [[a,uvA],[b,uvB],[c,uvC]])this.out.push(...p,...n,...uv);return this}
 quad(a,b,c,d,uv=[[0,0],[1,0],[1,1],[0,1]]){this.tri(a,b,c,uv[0],uv[1],uv[2]);this.tri(a,c,d,uv[0],uv[2],uv[3]);return this}
 box(x,y,z,w,h,d){let x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
  this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]);this.quad([x1,y0,z1],[x0,y0,z1],[x0,y0,z0],[x1,y0,z0]);
  this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]);
  this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]);this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);return this}
 lathe(profile,segments=42,rough=0,seedBase=0){let maxY=Math.max(...profile.map(p=>p[1])),minY=Math.min(...profile.map(p=>p[1])),ySpan=maxY-minY||1;
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
   let angle=i/segments*Math.PI*2,angle2=(i+1)/segments*Math.PI*2;
   let wob=(k,q)=>1+rough*(seed(seedBase+q*13+k*5)-.5);
   let r1=profile[j][0]*wob(i,j),r2=profile[j+1][0]*wob(i,j+1),r3=profile[j][0]*wob(i+1,j),r4=profile[j+1][0]*wob(i+1,j+1);
   let a=[Math.cos(angle)*r1,profile[j][1],Math.sin(angle)*r1],b=[Math.cos(angle2)*r3,profile[j][1],Math.sin(angle2)*r3],c=[Math.cos(angle2)*r4,profile[j+1][1],Math.sin(angle2)*r4],d=[Math.cos(angle)*r2,profile[j+1][1],Math.sin(angle)*r2];
   this.quad(a,d,c,b,[[i/segments,(profile[j][1]-minY)/ySpan],[i/segments,(profile[j+1][1]-minY)/ySpan],[(i+1)/segments,(profile[j+1][1]-minY)/ySpan],[(i+1)/segments,(profile[j][1]-minY)/ySpan]])
  }return this}
 disk(radius,thickness=.09,count=28,wave=0){const n=count;for(let i=0;i<n;i++){
   const p=i/n*6.283,q=(i+1)/n*6.283,rp=radius*(1+wave*Math.sin(i*5.27)),rq=radius*(1+wave*Math.sin((i+1)*5.27));
   let a=[Math.cos(p)*rp,thickness/2,Math.sin(p)*rp],b=[Math.cos(q)*rq,thickness/2,Math.sin(q)*rq],c=[Math.cos(p)*rp,-thickness/2,Math.sin(p)*rp],d=[Math.cos(q)*rq,-thickness/2,Math.sin(q)*rq];
   this.tri([0,thickness/2,0],b,a,[.5,.5],[.5+b[0]/(2*radius),.5+b[2]/(2*radius)],[.5+a[0]/(2*radius),.5+a[2]/(2*radius)]);
   this.tri([0,-thickness/2,0],c,d);this.quad(a,b,d,c)
  }return this}
 ellipsoid(cx,cy,cz,rx,ry,rz,steps=10,rounds=14){for(let j=0;j<steps;j++){
  let v=j/steps*Math.PI,v2=(j+1)/steps*Math.PI;
  for(let i=0;i<rounds;i++){
   let u=i/rounds*6.283,u2=(i+1)/rounds*6.283;
   let point=(theta,phi)=>[cx+rx*Math.sin(phi)*Math.cos(theta),cy+ry*Math.cos(phi),cz+rz*Math.sin(phi)*Math.sin(theta)];
   this.quad(point(u,v),point(u2,v),point(u2,v2),point(u,v2),[[i/rounds,j/steps],[(i+1)/rounds,j/steps],[(i+1)/rounds,(j+1)/steps],[i/rounds,(j+1)/steps]]);
  }
 }return this}
 ribbon(len,width,rows=22,offset=0,drop=.02){for(let i=0;i<rows;i++){
 let t=i/rows,t2=(i+1)/rows;
 const pt=(q,side)=>[ (q-.5)*len, Math.sin(q*19+offset)*.045 + Math.cos(q*11+offset)*.032-drop*Math.pow(Math.abs(q-.5)*2,3), Math.sin(q*9+offset)*.20+side*width/2 ];
 this.quad(pt(t,-1),pt(t,1),pt(t2,1),pt(t2,-1),[[t,0],[t,1],[t2,1],[t2,0]])
 }return this}
 leaf(len,width,index=0){for(let j=0;j<14;j++){
   const t=j/14,n=(j+1)/14;
   function pos(u,side){let taper=Math.sin(Math.PI*u)**.65;return [Math.cos(index)*(.25+len*u)+Math.cos(index+Math.PI/2)*side*width*taper*.5,
    .06+Math.sin(u*12+index)*.055+Math.abs(side)*Math.sin(u*16+index)*.10,
    Math.sin(index)*(.25+len*u)+Math.sin(index+Math.PI/2)*side*width*taper*.5]}
   this.quad(pos(t,-1),pos(t,1),pos(n,1),pos(n,-1),[[t,0],[t,1],[n,1],[n,0]])
 }return this}
 data(){return new Float32Array(this.out)}
}
function compile(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader: '+gl.getShaderInfoLog(s));return s}
function makeProgram(vs,fs){let p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const vs=`attribute vec3 aPos;attribute vec3 aNorm;attribute vec2 aUV;uniform mat4 uVP;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;void main(){vec4 p=uModel*vec4(aPos,1.);vWorld=p.xyz;vNormal=normalize(mat3(uModel)*aNorm);vUV=aUV;gl_Position=uVP*p;}`;
const fs=`precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;uniform sampler2D uTex;uniform vec2 uCell;uniform vec3 uTint;uniform float uTexture;uniform float uMetal;uniform float uGlow;uniform float uAlpha;uniform float uRough;uniform float uTime;uniform float uHeat;
void main(){vec2 uv=(vec2(uCell.x,3.-uCell.y)+vec2(.012,.012)+clamp(vUV,.0,1.)*vec2(.976,.976))/vec2(4.,4.);vec3 base=mix(uTint,texture2D(uTex,uv).rgb*uTint,uTexture);float noise=fract(sin(dot(vUV*200.,vec2(12.9898,78.233)))*43758.5453);
vec3 N=normalize(vNormal);if(uTexture>.5){float bump=(texture2D(uTex,uv+vec2(.003,0.)).r-texture2D(uTex,uv-vec2(.003,0.)).r);N=normalize(N+vec3(bump*.16,0.,-bump*.12));}
vec3 L1=normalize(vec3(-.43,.88,.32));vec3 L2=normalize(vec3(.52,.63,-.63));vec3 V=normalize(vec3(4.,7.,12.)-vWorld);float d1=max(dot(N,L1),.0),d2=max(dot(N,L2),.0);
vec3 H=normalize(L1+V);float shin=pow(max(dot(N,H),0.),mix(10.,76.,1.-uRough));float edge=pow(1.-max(dot(N,V),0.),3.);
float micro=fract(sin(dot(vUV*1180.,vec2(53.37,17.91)))*58754.2);
vec3 lit=base*(.27+.88*d1+.27*d2)+vec3(1.,.81,.63)*shin*(.11+(1.-uRough)*.47+uMetal*.6)+vec3(.30,.37,.46)*edge*.12;
lit+=base*(micro-.5)*.026;lit+=vec3(1.,.30,.06)*uHeat*.065*max(0.,N.y)*(.65+.35*sin(uTime*6.));
lit=mix(lit,lit*vec3(1.4,.71,.37),clamp(uGlow,0.,1.));lit+=base*uGlow*.24;lit=pow(max(lit,vec3(0.)),vec3(.90));gl_FragColor=vec4(lit,uAlpha);}`;
const particleVS=`attribute vec3 aParticle;attribute vec4 aPartColor;uniform mat4 uVP;uniform float uPixel;varying vec4 vCol;void main(){vec4 p=uVP*vec4(aParticle,1.);vCol=aPartColor;gl_Position=p;gl_PointSize=clamp(uPixel/max(2.,-p.w),2.,42.);}`;
const particleFS=`precision mediump float;varying vec4 vCol;void main(){vec2 d=gl_PointCoord-vec2(.5);float s=1.-smoothstep(.12,.5,length(d));gl_FragColor=vec4(vCol.rgb,vCol.a*s);}`;
function geom(fn){let b=new Builder();fn(b);let data=b.data(),vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);resources.push(vbo);return {buffer:vbo,count:data.length/8};}
let meshes={},objects=[];
function mat(cell=null,tint=[1,1,1],rough=.65,metal=0,glow=0,alpha=1){return {cell,tint,rough,metal,glow,alpha}}
function add(mesh,m,model,layer='room'){objects.push({mesh,m,model,layer})}
function colored(b,colour,model,layer='room',rough=.65,metal=0,glow=0){add(b,mat(null,colour,rough,metal,glow),model,layer)}
function texture(b,material,model,layer='room',tint=[1,1,1],rough=.68,metal=0,glow=0){add(b,mat(material,tint,rough,metal,glow),model,layer)}
function initMeshes(){
 meshes.cube=geom(b=>b.box(0,0,0,1,1,1));
 meshes.plane=geom(b=>b.quad([-1,0,1],[1,0,1],[1,0,-1],[-1,0,-1]));
 meshes.sphere=geom(b=>b.ellipsoid(0,0,0,1,1,1));
 meshes.disc=geom(b=>b.disk(1,.1,48));
 meshes.cylinder=geom(b=>b.lathe([[0,0],[1,0],[1,1],[0,1]],28));
 meshes.bottom=geom(b=>b.lathe([[0,0],[1.18,.02],[1.42,.045],[1.62,.11],[1.61,.22],[1.48,.28],[.8,.32],[0,.32]],54,.025,17));
 meshes.top=geom(b=>b.lathe([[0,0],[1.50,0],[1.60,.09],[1.55,.24],[1.34,.45],[1.08,.57],[.7,.65],[.3,.69],[0,.70]],62,.02,21));
 meshes.beef=geom(b=>b.lathe([[0,0],[1.46,0],[1.66,.025],[1.68,.10],[1.63,.21],[1.48,.26],[.5,.28],[0,.27]],64,.083,24));
 meshes.cheese=geom(b=>{
  b.quad([-1.42,.07,1.42],[1.42,.07,1.42],[1.42,.07,-1.42],[-1.42,.07,-1.42]);
  for(let i=0;i<4;i++){
   let a=i*Math.PI/2,x=Math.cos(a)*1.42,z=Math.sin(a)*1.42;
   for(let j=0;j<5;j++){
    let t=j/5,t2=(j+1)/5;const drop=.13+.10*(i%2);
    let pt=(q,dy)=>[x+Math.sin(a)*(.55-q*1.1),.06-dy*drop*Math.sin(Math.PI*q),z-Math.cos(a)*(.55-q*1.1)];
    b.quad(pt(t,0),pt(t2,0),pt(t2,1),pt(t,1));
   }
  }
 });
 meshes.lettuce=geom(b=>{for(let i=0;i<12;i++)b.leaf(1.76,.60,i/12*6.283)});
 meshes.garlic=meshes.lettuce;
 meshes.tomato=geom(b=>b.disk(.58,.09,40,.018));
 meshes.pickle=geom(b=>b.disk(.37,.08,34,.012));
 meshes.onion=geom(b=>b.ribbon(1.5,.16,25,2));
 meshes.chili=geom(b=>b.ellipsoid(0,0,0,.12,.075,.19,6,8));
 meshes.bacon=geom(b=>b.ribbon(2.7,.29,26,5,.08));
 meshes.sauce=geom(b=>b.disk(1.38,.047,40,.04));
 meshes.seed=geom(b=>b.ellipsoid(0,0,0,.048,.015,.095,6,8));
 meshes.grease=geom(b=>b.ellipsoid(0,0,0,.07,.10,.06,7,9));
 meshes.fan=geom(b=>b.disk(.3,.025,22));
 meshes.topSeeds=geom(b=>{for(let i=0;i<76;i++){
  let r=Math.sqrt(seed(i*3+8))*1.35,ang=seed(i*5+19)*6.283;
  let h=.71-.18*(r/1.35)**2-.31*(r/1.35)**4;
  b.ellipsoid(Math.cos(ang)*r,h+.018,Math.sin(ang)*r,.048,.015,.095,6,8);
 }});
 meshes.crust=geom(b=>{for(let i=0;i<23;i++){
  let theta=i*2.399,r=Math.sqrt(seed(i+4))*1.48;
  b.ellipsoid(Math.cos(theta)*r,.264,Math.sin(theta)*r,.07,.018,.06,5,8);
 }});
 meshes.choppedChili=geom(b=>{for(let i=0;i<42;i++){
  let t=seed(i*7)*6.283,r=Math.sqrt(seed(i*13+10))*1.48;
  b.ellipsoid(Math.cos(t)*r,.04,Math.sin(t)*r,.07,.06,.11,5,7);
 }});
 meshes.garlicButter=geom(b=>{for(let i=0;i<33;i++){
  let theta=seed(i*11)*6.283,r=Math.sqrt(seed(i*29+2))*1.32;
  b.ellipsoid(Math.cos(theta)*r,.08,Math.sin(theta)*r,.047,.022,.044,5,7);
 }});

}
function room(){objects=[];
 // Background room with a tile backsplash, side wall, and floor.
 texture(meshes.cube,'tile',place(0,2.15,-3.15,0,12.8,4.3,.11),'room',[.64,.68,.71],.9);
 texture(meshes.cube,'tile',place(-6.35,1.9,-.10,0,.1,4.3,7),'room',[.55,.61,.64],.9);
 texture(meshes.cube,'wood',place(0,-.83,0,0,13.5,.10,7),'room',[.20,.19,.20],.95);
 texture(meshes.cube,'steel',place(0,-.38,.22,0,11,.45,5.5),'room',[.66,.72,.79],.34,.8);
 texture(meshes.cube,'steel',place(0,-.09,.22,0,11,.14,5.5),'room',[.9,.93,1],.25,.7);
 // griddle and heated platen.
 colored(meshes.cube,[.11,.13,.15],place(-2.65,.10,-.37,0,4.15,.32,2.45),'room',.65,.72);
 texture(meshes.cube,'griddle',place(-2.65,.28,-.37,0,3.75,.07,2.1),'room',[.69,.68,.65],.25,.4);
 for(let i=0;i<4;i++)colored(meshes.cube,[.10,.13,.16],place(-4.52+i*1.23,.29,-1.53,0,.042,.10,2.05),'room',.4,.7);
 // control front with amber power indicators and grill knobs.
 colored(meshes.cube,[.13,.17,.19],place(-2.65,-.10,1.06,0,4.1,.29,.13));
 for(let i=0;i<4;i++){
  colored(meshes.cylinder,[.16,.17,.19],place(-4.28+i*1.07,-.13,1.16,0,.15,.04,.15));
  colored(meshes.disc,i<2?[.99,.34,.06]:[.18,.57,.26],place(-4.28+i*1.07,-.04,1.17,0,.05,.02,.05),'fx',.4,0,.7);
 }
 // ventilation hood, backsplash trim, exhaust vents.
 texture(meshes.cube,'steel',place(-2.65,3.3,-2.83,0,5.2,.72,.84),'room',[.72,.78,.84],.35,.9);
 texture(meshes.cube,'steel',place(-2.65,2.92,-2.58,0,5.65,.20,1.13),'room',[.65,.72,.80],.30,.85);
 for(let i=0;i<12;i++)colored(meshes.cube,[.12,.15,.17],place(-5.02+i*.43,2.88,-1.98,0,.17,.04,.42));
 // plating counter & wood chopping surface.
 texture(meshes.cube,'wood',place(1.55,.07,.45,0,3.85,.14,3.10),'room',[.95,.74,.62],.7);
 colored(meshes.cube,[.48,.27,.13],place(1.55,-.015,.45,0,3.99,.06,3.20));
 // tray plate and rim beneath burger.
 colored(meshes.disc,[.07,.12,.14],place(plate.x,.19,plate.z,0,2.21,.28,2.21),'room',.25,.8);
 colored(meshes.disc,[.84,.84,.78],place(plate.x,.30,plate.z,0,2.03,.28,2.03),'room',.24,.23);
 colored(meshes.disc,[.97,.93,.80],place(plate.x,.37,plate.z,0,1.83,.13,1.83),'room',.21,.16);
 // stainless mise en place, ingredient trays, food tins, condiment bottles.
 for(let j=0;j<5;j++){
  let x=-.45+j*.71,z=-2.27;
  colored(meshes.cube,[.44,.52,.55],place(x,.12,z,0,.61,.25,.58),'room',.32,.9);
  texture(meshes.cube,['cheese','tomato','pickle','lettuce','onion'][j],place(x,.267,z,0,.55,.04,.51),'room',[1,1,1],.44);
  colored(meshes.cube,[.81,.86,.88],place(x,.23,z-.28,0,.64,.075,.05),'room',.29,.7);
 }
 for(let i=0;i<3;i++){
  colored(meshes.cylinder,['#e4b233','#b92d25','#e6b18b'].map(h=>hex(h))[i],place(4+i*.44,.19,-1.6,0,.17,.60,.17),'room',.3);
  colored(meshes.cylinder,[.92,.88,.81],place(4+i*.44,.74,-1.6,0,.07,.20,.07));
 }
 // Brushed-steel spatula and scraper on the worktop, with a real modeled blade.
 colored(meshes.cube,[.58,.64,.71],place(-.4,.55,1.28,.28,.86,.035,.34),'room',.15,.92);
 colored(meshes.cube,[.18,.14,.13],place(-.10,.52,1.34,.28,.46,.08,.13),'room',.65,.14);
 colored(meshes.cube,[.78,.79,.81],place(-.30,.51,1.30,.28,.10,.06,.17),'room',.24,.75);
 // Warm reflections and grease beads across the cooking surface.
 for(let j=0;j<12;j++){const px=-4.35+(j%6)*.56,pz=-1.15+Math.floor(j/6)*1.28;
  colored(meshes.disc,[.28,.19,.11],place(px,.325,pz,0,.13,.025,.06),'room',.12,.75);}
 // wall menu and warm practical strip lighting.
 colored(meshes.cube,[.07,.09,.11],place(2.6,2.27,-3.00,0,4.3,1.20,.14),'room',.9);
 for(let k=0;k<5;k++){
   colored(meshes.cube,k===0?[1,.55,.20]:[.74,.78,.74],place(.82,2.66-k*.20,-2.90,0,1.4-k*.12,.035,.04),'fx',.64,0,k===0?.56:.02);
   colored(meshes.cube,[.93,.69,.29],place(3.68,2.66-k*.20,-2.90,0,.65,.03,.03),'fx',.5,0,.2);
 }
 colored(meshes.cube,[1,.66,.29],place(0,3.42,-3.04,0,10.4,.056,.13),'fx',.5,0,.45);
 // warm ceiling light bars, shelf, ladle-ish cookware.
 texture(meshes.cube,'steel',place(2.6,3.69,-2.44,0,5.3,.08,.80),'room',[.63,.67,.73],.30,.8);
 for(let i=0;i<3;i++){
  colored(meshes.cylinder,[.69,.71,.73],place(4.6,3-i*.02,-2.2,0,.11,.48,.11),'room',.32,.75);
  colored(meshes.disc,[.14,.17,.20],place(4.6,2.57-i*.02,-2.2,0,.45,.10,.45),'room',.4,.67);
 }
}
function hex(h){return [parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]}
function ingredients(){let parts={};
 for(const k of ['bottom','top','beef','cheese','lettuce','garlic','tomato','pickle','onion','chili','bacon','sauce']){
  let pieces=[];const p=(mesh,material,model,tint=[1,1,1],rough=.58,metal=0,glow=0)=>pieces.push({mesh,material,model,tint,rough,metal,glow});
  if(k==='bottom'){p(meshes.bottom,'bun',identity(),[1,1,1],.63);}
  if(k==='top'){
   p(meshes.top,'bun',identity(),[1.05,1,.92],.38);
   p(meshes.topSeeds,null,identity(),[.98,.88,.61],.78);
  }
  if(k==='beef'){
   p(meshes.beef,'beef',identity(),[.98,.85,.73],.35);
   // Scorched grilled craggy crust and sizzling rendered fat.
   p(meshes.crust,'beef',identity(),[.63,.48,.36],.26);
  }
  if(k==='cheese')p(meshes.cheese,'cheese',identity(),[1,1,.98],.21);
  if(k==='lettuce'||k==='garlic'){
   p(meshes.lettuce,'lettuce',identity(),k==='garlic'?[.94,1,.62]:[.92,1,.83],.42);
   if(k==='garlic')p(meshes.garlicButter,null,identity(),[.96,.71,.21],.16);
  }
  if(k==='tomato'||k==='pickle'){
   let count=k==='tomato'?4:7;
   for(let i=0;i<count;i++){
    let t=i/count*6.283,r=k==='tomato'?.64:.92;
    p(meshes[k],k,place(Math.sin(t)*r,.06+(i%2)*.025,Math.cos(t)*r,seed(i)*6.283),[1,1,1],.25);
   }
  }
  if(k==='onion')for(let i=0;i<8;i++)p(meshes.onion,'onion',place(Math.cos(i*1.55)*.60,.06+(i%3)*.03,Math.sin(i*1.55)*.57,i*.81,.78,1,.7),[.96,.84,.68],.30);
  if(k==='chili')p(meshes.choppedChili,'chili',identity(),[1,.93,.89],.27);
  if(k==='bacon')for(let i=0;i<5;i++)p(meshes.bacon,'beef',place(0,.08,0,i*Math.PI/5),[1.12,.8,.73],.27);
  if(k==='sauce')p(meshes.sauce,'onion',identity(),[.91,.65,.43],.18);
  parts[k]=pieces;
 }
 return parts;
}
let foodParts={};
function resetPhysics(layers,animate=false){
 const old=burgerBodies;
 const oldTypes=old.map(b=>b.type);
 const target=['bottom',...layers,'top'];
 let n=0;while(n<old.length&&n<target.length&&oldTypes[n]===target[n])n++;
 if(!animate)n=0;
 burgerBodies=old.slice(0,n);
 const heightBefore=(i)=>target.slice(0,i).reduce((a,t)=>a+(heights[t]||.15),0);
 for(let i=n;i<target.length;i++){
   const type=target[i],h=heights[type]||.14,base=plate.y+.12+heightBefore(i);
   const dropped=pendingDrop&&animate&&i===n?pendingDrop:null;
  const r= type==='top'?1.6:type==='bottom'?1.6:type==='beef'?1.68:1.4;
  burgerBodies.push({type,i,h,r,x:plate.x+(dropped?dropped.x:animate?((seed(i*19+timePrev)-.5)*.32):0),z:plate.z+(dropped?dropped.z:animate?((seed(i*23+timePrev)-.5)*.20):0),y:animate?base+1.9+i*.05:base,vy:animate?0:0,vx:0,vz:0,rot:0,vr:animate?(seed(i*5)-.5)*.9:0,rest:!animate});
 }
 pendingDrop=null;
}
function simulateStep(dt){
 const gravity=13.5;
 for(let i=0;i<burgerBodies.length;i++){
  const b=burgerBodies[i];if(i===0){b.y=plate.y+.12;b.x=plate.x;b.z=plate.z;continue;}
  const prev=burgerBodies[i-1], supportY=prev.y+prev.h*.53+b.h*.46;
  b.vy-=gravity*dt;b.y+=b.vy*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;
  const dist=Math.hypot(b.x-prev.x,b.z-prev.z);
  if(b.y<supportY && dist<(b.r+prev.r)*.72){
   const impact=-b.vy;b.y=supportY;b.vy=impact>.17?impact*.17:0;
   b.vx*=.62;b.vz*=.62;b.vr*=.7;
   if(impact>2.8&&i>1){const rng=seed(timePrev*9+i)-.5;b.vx+=rng*.12;b.vz-=rng*.11;}
   if(impact>.8&&fx!=='off'){hitBursts.push({x:b.x,y:b.y,z:b.z,t:0,s:Math.min(1,impact/11)})}
  }
  if(b.y<plate.y+.06){b.y=plate.y+.06;b.vy=Math.abs(b.vy)*.12;}
  let attract=2.9; b.vx+=(plate.x-b.x)*dt*attract;b.vz+=(plate.z-b.z)*dt*attract;
  b.vx*=.987;b.vz*=.987;b.rot+=b.vr*dt;b.vr*=.975;
  if(Math.abs(b.vy)<.01 && Math.abs(b.vx)<.03 && Math.abs(b.vz)<.03) b.rest=true;
 }
}
let liveTextureLoaded=false;
function loadAtlas(){const img=new Image();img.onload=()=>{if(!gl)return;gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);liveTextureLoaded=true;};img.onerror=()=>{msg.textContent='Textures unavailable: host the complete folder over HTTPS. 3D geometry is still active.'};img.src='assets/material-atlas.jpg'}
function initGL(){
 try{
  gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:true,powerPreference:'default'})||canvas.getContext('experimental-webgl');if(!gl)throw Error('WebGL disabled');
  program=makeProgram(vs,fs);pointProgram=makeProgram(particleVS,particleFS);
  for(let n of ['uVP','uModel','uTex','uCell','uTint','uTexture','uMetal','uGlow','uAlpha','uRough','uTime','uHeat'])u[n]=gl.getUniformLocation(program,n);
  for(let n of ['aPos','aNorm','aUV'])a[n]=gl.getAttribLocation(program,n);
  for(let n of ['uVP','uPixel'])pu[n]=gl.getUniformLocation(pointProgram,n);
  for(let n of ['aParticle','aPartColor'])pa[n]=gl.getAttribLocation(pointProgram,n);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  gl.clearColor(.045,.063,.082,1);tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([168,153,121]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  loadAtlas();initMeshes();foodParts=ingredients();room();resetPhysics(showcase);valid=true;
  badge.textContent='LIVE 3D · TEXTURED · PHYSICS';
  msg.textContent='DRAG TO ORBIT · PINCH TO ZOOM · TAP AN INGREDIENT · EXPLODE THE LAYERS';
  if(fallback)fallback.hidden=true;canvas.hidden=false;
  let ptBuffer=gl.createBuffer();resources.push(ptBuffer);meshes.particleBuffer=ptBuffer;
 }catch(err){console.error('Burger Quest Restaurant WebGL error:',err);valid=false;canvas.hidden=true;if(fallback)fallback.hidden=false;badge.textContent='2D FALLBACK · WEBGL UNAVAILABLE';msg.textContent='3D requires WebGL in Safari/Chrome. Use an HTTPS hosted web app.';}
}
function drawMesh(mesh,material,model){if(!mesh)return;
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
 gl.enableVertexAttribArray(a.aPos);gl.vertexAttribPointer(a.aPos,3,gl.FLOAT,false,32,0);
 gl.enableVertexAttribArray(a.aNorm);gl.vertexAttribPointer(a.aNorm,3,gl.FLOAT,false,32,12);
 gl.enableVertexAttribArray(a.aUV);gl.vertexAttribPointer(a.aUV,2,gl.FLOAT,false,32,24);
 gl.uniformMatrix4fv(u.uModel,false,model);
 gl.uniform3fv(u.uTint,material.tint);
 gl.uniform2fv(u.uCell,MAT[material.cell]||[0,0]);
 gl.uniform1f(u.uTexture,material.cell?1:0);
 gl.uniform1f(u.uRough,material.rough);
 gl.uniform1f(u.uMetal,material.metal);
 gl.uniform1f(u.uGlow,material.glow);
 gl.uniform1f(u.uAlpha,material.alpha);
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);drawCount++;
}
function drawParts(body,model){const ps=foodParts[body.type]||[];
 for(const p of ps){const m=mul(model,p.model);drawMesh(p.mesh,mat(p.material,p.tint,p.rough,p.metal,p.glow),m)}
}
function foodLayerY(i){let yy=plate.y+.12;for(let j=0;j<i;j++)yy+=burgerBodies[j]?.h||.1;return yy}
function drawBurger(){
 const gap=(explode/100)*.49;
 for(let i=0;i<burgerBodies.length;i++){
  const b=burgerBodies[i];let y=exploded()?foodLayerY(i)+gap*i:b.y;
  const pick=selected===i?.15:0;
  const where=place(b.x,y+pick,b.z,b.rot,1,1,1);
  drawParts(b,where);
  if(i===burgerBodies.length-1&&fx!=='off'&&Math.sin(timePrev*.004)>-2){}
 }
}
const exploded=()=>explode>0;
function drawGrill(){
 for(let i=0;i<4;i++){
  const s=grillSlots[i];if(!s)continue;
  const x=-4.22+i*1.04, y=.37, z=-.42;
  const cooked=['s2','ready','burnt'].includes(s.phase);
  const darkness=s.phase==='burnt'?[.22,.21,.20]:s.phase==='ready'?[.93,.85,.70]:cooked?[1.01,.89,.77]:[1.32,.87,.82];
  drawMesh(meshes.beef,mat('beef',darkness,.42),place(x,y,z,0,.38,.45,.40));
  if(s.phase==='ready')drawMesh(meshes.disc,mat(null,[.89,.32,.12],.6,0,.14),place(x,.45,z,0,.27,.07,.27));
 }
}
function drawFlares(){
 if(!shiftOpen||grillHeat<375)return;
 for(let i=0;i<7;i++){
  let x=-4.55+i*.60;
  drawMesh(meshes.cube,mat(null,[1,.21,.015],.85,0,.12+.21*(grillHeat/550)*Math.sin(timePrev*.004+i)**2),place(x,.16,-.90,0,.42,.025,.11));
 }
}
function emitParticles(dt){if(fx==='off'||document.hidden||!valid)return;
 const busy=grillSlots.filter(Boolean).length;
 const heatScale=grillHeat/425;
 const count=shiftOpen?(fx==='high'?Math.min(8,2+busy+Math.floor(grease/35)):1+Math.min(2,busy)):0;
 for(let i=0;i<count;i++){
  const source=Math.random()<.76, x=source?-4.1+Math.random()*3.05:plate.x+(Math.random()-.5)*.7,z=source?-.45+(Math.random()-.5)*.9:plate.z;
  particles.push({x,y:source?.46:1.65,z,vx:(Math.random()-.5)*.25*heatScale,vy:(.36+Math.random()*.4)*heatScale,vz:(Math.random()-.5)*.18,life:1.5+Math.random()*1.6,age:0,size:source?8:5,dirty:source&&Math.random()<grease/135,hot:Math.random()>.88});
 }
 for(const p of particles){p.age+=dt;p.y+=p.vy*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.vx+=Math.sin(timePrev*.0008+p.y)*.002}
 particles=particles.filter(p=>p.age<p.life).slice(-85);
 hitBursts.forEach(b=>b.t+=dt);hitBursts=hitBursts.filter(b=>b.t<.45).slice(-12);
}
function drawParticles(vp,dimensions){if(!particles.length&&!hitBursts.length)return;
 let arr=[];for(const p of particles){let t=p.age/p.life;arr.push(p.x,p.y,p.z,p.dirty?.33:p.hot?1:.83,p.dirty?.29:p.hot?.49:.81,p.dirty?.25:p.hot?.20:.88,(1-t)*(p.dirty?.28:.17))}
 for(const p of hitBursts){for(let i=0;i<6;i++){let a=i/6*6.28,r=p.t*1.5;arr.push(p.x+Math.cos(a)*r,p.y+.05+p.t*.35,p.z+Math.sin(a)*r,1,.68,.22,(1-p.t/.45)*.34)}}
 const dat=new Float32Array(arr);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
 gl.useProgram(pointProgram);gl.uniformMatrix4fv(pu.uVP,false,vp);gl.uniform1f(pu.uPixel,canvas.height*.20);
 gl.bindBuffer(gl.ARRAY_BUFFER,meshes.particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,dat,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(pa.aParticle);gl.vertexAttribPointer(pa.aParticle,3,gl.FLOAT,false,28,0);
 gl.enableVertexAttribArray(pa.aPartColor);gl.vertexAttribPointer(pa.aPartColor,4,gl.FLOAT,false,28,12);
 gl.drawArrays(gl.POINTS,0,dat.length/7);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
 gl.useProgram(program);
}
function getCamera(){
 const isKitchen=cam==='kitchen';
 const target=isKitchen?[-.9,1.19,-.4]:cam==='exploded'?[1.32,1.52,.25]:cam==='macro'?[plate.x,1.50,plate.z]:[plate.x,1.50,plate.z];
 const aspectRatio=(canvas.clientWidth||innerWidth)/Math.max(1,(canvas.clientHeight||innerHeight));
 const portraitScale=aspectRatio<.75 ? (cam==='macro'?Math.min(1.6,.85/aspectRatio):Math.min(2.25,.96/aspectRatio)) : 1;
 const distance=(isKitchen?10.3:cam==='exploded'?7.5:cam==='macro'?4.7:6.2)*zoom*portraitScale;
 const cy=target[1]+Math.sin(pitch)*distance;
 const ey=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,cy,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
 let aspect=canvas.width/Math.max(1,canvas.height),fov=cam==='kitchen'?54:cam==='macro'?42:50;
 if(aspect<.8)fov=cam==='kitchen'?64:58;
 return {vp:mul(perspective(fov*Math.PI/180,aspect,.15,70),lookAt(ey,target)),eye:ey};
}
function draw(now){if(!valid||document.hidden)return;
 const css=canvas.getBoundingClientRect();if(css.width<1||css.height<1)return;
 const dpr=Math.min(devicePixelRatio||1, window.innerWidth<600?1.45:1.7);
 let w=Math.max(1,Math.floor(css.width*dpr)),h=Math.max(1,Math.floor(css.height*dpr));
 if(w!==canvasW||h!==canvasH){canvas.width=w;canvas.height=h;canvasW=w;canvasH=h;gl.viewport(0,0,w,h)}
 let {vp}=getCamera();drawCount=0;
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(program);gl.uniformMatrix4fv(u.uVP,false,vp);gl.uniform1i(u.uTex,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1f(u.uTime,now*.001);gl.uniform1f(u.uHeat,shiftOpen?Math.max(0,(grillHeat-350)/200):0);
 for(const ob of objects)drawMesh(ob.mesh,ob.m,ob.model);
 drawGrill();drawFlares();drawBurger();drawParticles(vp,[w,h]);
}
function inspect(){layerInspector.textContent='';for(let i=0;i<burgerBodies.length;i++){
 const b=burgerBodies[i],btn=document.createElement('button');btn.type='button';btn.className='layer-pill'+(selected===i?' is-selected':'');btn.textContent=String(i+1).padStart(2,'0')+' · '+(foodLabel[b.type]||b.type);
 btn.setAttribute('aria-pressed',String(selected===i));btn.addEventListener('click',()=>{selected=selected===i?-1:i;inspect()});layerInspector.appendChild(btn);
 }}
function setMode(next){mode=next==='build'?'build':'showcase';selected=-1;
 const types=mode==='showcase'?showcase:(currentHasBun?currentLayers:null);
 burgerBodies=types===null?[]:[];if(types!==null)resetPhysics(types,false);
 modes.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset['3dMode']===mode)));
 document.getElementById('labEmptyMessage').hidden=burgerBodies.length>0;inspect();
}
function setCam(c){cam=['kitchen','hero','macro','exploded'].includes(c)?c:'hero';
 document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===cam)));
 if(cam==='exploded'&&explode<25){explode=52;explodeInput.value=52;explodeLabel.textContent='52%'}
 if(cam==='kitchen'&&explode>0){explode=0;explodeInput.value=0;explodeLabel.textContent='0%'}
}
function projectedPoint(pos){
 const m=getCamera().vp,x=pos[0],y=pos[1],z=pos[2];
 const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];
 return cw>.01?{x:.5+cx/cw*.5,y:.5-cy/cw*.5}:null;
}
function pickLayer(sx,sy){
 let index=-1,best=.19;
 for(let i=burgerBodies.length-1;i>=0;i--){
  const body=burgerBodies[i];
  const height=exploded()?foodLayerY(i)+(explode/100)*.49*i:body.y;
  const point=projectedPoint([body.x,height,body.z]);if(!point)continue;
  const dx=(point.x-sx)*1.2,dy=(point.y-sy),dist=Math.hypot(dx,dy);
  if(dist<best){best=dist;index=i;}
 }
 return index;
}
function tapGrill(sx,sy){
 if(cam!=='kitchen')return false;
 let best=null,dist=.12;
 for(let i=0;i<4;i++){
  let p=projectedPoint([-4.22+i*1.04,.42,-.42]);if(!p)continue;
  let d=Math.hypot((p.x-sx)*1.4,p.y-sy);
  if(d<dist){dist=d;best=i}
 }
 if(best===null)return false;
 const slot=document.querySelector(`[data-grill="${best}"]`);
 if(slot&&!slot.disabled && grillSlots[best])slot.click();
 else{const add=document.getElementById('addPatty');if(add&&!add.disabled)add.click()}
 return true;
}
const pointers=new Map();let prevPinch=0,down=null;
function input(){
 canvas.style.touchAction='none';
 canvas.addEventListener('pointerdown',ev=>{turntable=false;const sb=document.getElementById('spinButton');if(sb){sb.textContent='TURNTABLE: OFF';sb.setAttribute('aria-pressed','false')}canvas.setPointerCapture(ev.pointerId);pointers.set(ev.pointerId,[ev.clientX,ev.clientY]);down={x:ev.clientX,y:ev.clientY,t:performance.now()}});
 canvas.addEventListener('pointermove',ev=>{
  if(!pointers.has(ev.pointerId))return;
  let old=pointers.get(ev.pointerId);pointers.set(ev.pointerId,[ev.clientX,ev.clientY]);
  if(pointers.size===2){const [[x,y],[x2,y2]]=[...pointers.values()];let d=Math.hypot(x-x2,y-y2);if(prevPinch)zoom=clamp(zoom*prevPinch/Math.max(4,d),.67,1.75);prevPinch=d;return}
  yaw+=(ev.clientX-old[0])*.008;pitch=clamp(pitch+(ev.clientY-old[1])*.006,-.02,.98);
 });
 canvas.addEventListener('pointerup',ev=>{let old=pointers.get(ev.pointerId);pointers.delete(ev.pointerId);prevPinch=0;if(down&&Math.hypot(ev.clientX-down.x,ev.clientY-down.y)<8&&performance.now()-down.t<500&&burgerBodies.length){
  const rect=canvas.getBoundingClientRect(),x=(ev.clientX-rect.left)/rect.width,y=(ev.clientY-rect.top)/rect.height;
  if(cam==='kitchen')tapGrill(x,y);else{const hit=pickLayer(x,y);if(hit>=0){selected=selected===hit?-1:hit;inspect()}}
 }down=null});
 canvas.addEventListener('pointercancel',ev=>{pointers.delete(ev.pointerId);prevPinch=0});
 canvas.addEventListener('wheel',ev=>{ev.preventDefault();zoom=clamp(zoom+(ev.deltaY>0?.07:-.07),.65,1.8)},{passive:false});
 document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCam(b.dataset.camera)));
 const fxButton=document.getElementById('fxButton');if(fxButton)fxButton.addEventListener('click',()=>{fx=fx==='high'?'low':fx==='low'?'off':'high';fxButton.textContent='FX: '+fx.toUpperCase();fxButton.setAttribute('aria-pressed',String(fx!=='off'))});
 const sb=document.getElementById('spinButton');if(sb)sb.addEventListener('click',()=>{turntable=!turntable;sb.textContent='TURNTABLE: '+(turntable?'ON':'OFF');sb.setAttribute('aria-pressed',String(turntable))});
 const jiggle=document.getElementById('jiggleBurger');if(jiggle)jiggle.addEventListener('click',()=>{if(explode>0){explode=0;explodeInput.value=0;explodeLabel.textContent='0%'}burgerBodies.forEach((b,i)=>{if(i===0)return;b.vx+=(seed(i+timePrev)-.5)*5.8;b.vz+=(seed(i*13+timePrev)-.5)*3.7;b.vy+=.8;b.vr+=(seed(i*27+timePrev)-.5)*1.2});});
 const snap=document.getElementById('photoButton');if(snap)snap.addEventListener('click',()=>{
  if(!valid)return;canvas.toBlob(blob=>{if(!blob)return;let url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='BurgerQuest-Kitchen.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000)},'image/png');
 });
 explodeInput.value='0';explodeLabel.textContent='0%';explodeInput.addEventListener('input',ev=>{explode=clamp(Number(ev.target.value)||0,0,100);explodeLabel.textContent=explode+'%';if(explode>0){cam='exploded';document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===cam)))} });
 modes.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset['3dMode'])));
 document.getElementById('reset3D').addEventListener('click',()=>{yaw=.45;pitch=.34;zoom=1;selected=-1;explode=0;explodeInput.value=0;explodeLabel.textContent='0%';setCam('hero');inspect()});
}
function tick(now){const dt=clamp((now-timePrev)/1000||0,.0,.05);timePrev=now;
 if(turntable&&cam!=='kitchen'&&pointers.size===0)yaw+=dt*.28;
 if(valid){if(!exploded()){physAccum+=dt;for(let i=0;i<4&&physAccum>=1/90;i++,physAccum-=1/90)simulateStep(1/90)}else physAccum=0;
 emitParticles(dt);
 // On phone-sized viewports LOW/OFF FX also caps rasterization around 30fps.
 // Simulation timing still uses frame delta; this lowers GPU overhead without changing game speed.
 const targetInterval=(window.innerWidth<700&&fx!=='high')?33.3:16;
 if(now-lastDraw>=targetInterval){draw(now);lastDraw=now;}
 }
 requestAnimationFrame(tick);
}
initGL();input();inspect();setCam('hero');requestAnimationFrame(tick);
canvas.addEventListener('webglcontextlost',ev=>{ev.preventDefault();valid=false;contextsLost++;badge.textContent='3D CONTEXT LOST';if(fallback)fallback.hidden=false});
canvas.addEventListener('webglcontextrestored',()=>{resources=[];initGL();setMode(mode)});
window.Burger3D={
 setLayers(layers,hasBun=false){const next=Array.isArray(layers)?layers.filter(k=>Object.hasOwn(heights,k)).slice(0,18):[];if(JSON.stringify(next)!==JSON.stringify(currentLayers)||!!hasBun!==currentHasBun){currentLayers=next;currentHasBun=!!hasBun;if(hasBun&&mode==='showcase')setMode('build');else if(mode==='build'){if(hasBun)resetPhysics(next,true);else burgerBodies=[];document.getElementById('labEmptyMessage').hidden=burgerBodies.length>0;inspect()}}},
 setGrillSlots(slots){grillSlots=Array.isArray(slots)?slots.slice(0,4):[]},
 setGrillEnvironment(heat,oil,running){grillHeat=clamp(Number(heat)||425,325,550);grease=clamp(Number(oil)||0,0,100);shiftOpen=!!running},
 setNextDrop(x,z){pendingDrop={x:clamp(Number(x)||0,-.58,.58),z:clamp(Number(z)||0,-.5,.5)}},
 setMode,setCamera:setCam,
 setExplode(n){explode=clamp(Number(n)||0,0,100);explodeInput.value=String(explode);explodeLabel.textContent=explode+'%'},
 status(){return {webgl:valid,software:false,active:valid,mode,camera:cam,turntable,grillHeat,grease,shiftOpen,exploded:explode,parts:burgerBodies.length,rotation:yaw,zoom,drawCalls:drawCount,selectedPart:selected,atlasLoaded:liveTextureLoaded,particles:particles.length,contextLosses:contextsLost,physics:'disc rigid-body support collisions 90Hz',movingBodies:burgerBodies.filter(b=>Math.abs(b.vy)>.1||Math.abs(b.vx)>.1).length,physicsBodies:burgerBodies.map(b=>({type:b.type,y:Number(b.y.toFixed(2)),vy:Number(b.vy.toFixed(2))}))}},
 invalidate(){}
};
})();