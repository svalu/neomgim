import {paperFrame,projectPaper,paperNormal,paperFacing} from './curl-geometry.js';
import {RecordedPage} from './page-audio.js';

const canvas=document.querySelector('#demo-book'),ctx=canvas.getContext('2d');
const prev=document.querySelector('#demo-prev'),next=document.querySelector('#demo-next'),soundButton=document.querySelector('#demo-sound'),status=document.querySelector('#demo-status');
const loading=document.querySelector('#demo-loading');
const PAGE_WIDTH=480,PAGE_HEIGHT=720,PAGE_COUNT=22;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let spread=0,turn=null,drag=null,raf=0,pages=[],W=1,H=1,pw=1,ph=1,left=0,top=0,soundOn=true,audio,recorded,output;
const clamp=x=>Math.max(0,Math.min(1,x));
function prepareAudio(){try{if(!audio){audio=new AudioContext();output=audio.createGain();output.gain.value=.42;output.connect(audio.destination);recorded=new RecordedPage(audio,output);}recorded.prepare().catch(()=>{});}catch{soundButton.setAttribute('aria-label','소리 사용 불가');soundButton.disabled=true;}}
function unlock(){prepareAudio();if(soundOn&&audio)audio.resume().catch(()=>{});}
function soundStart(){if(soundOn&&recorded){recorded.begin();if(turn)turn.sounded=true;}}
soundButton.onclick=()=>{soundOn=!soundOn;soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.title=soundOn?'종이 소리 끄기':'종이 소리 켜기';if(soundOn)unlock();else recorded?.end();};

async function loadComic(){
 async function loadPage(index){
  const titlePages=['title-left','title-right'];
  const filename=titlePages[index]??String(index-1).padStart(2,'0');
  const page=new Image();
  page.src=new URL(`assets/rion-socks/${filename}.webp`,import.meta.url);
  await page.decode();
  return page;
 }
 try{
  pages=await Promise.all([loadPage(0),loadPage(1)]);
  loading.hidden=true;
  render();
  update();
 }catch{
  loading.textContent='책을 펼치지 못했어. 새로고침하거나 아래에서 샘플을 받아봐.';
  return;
 }
 for(let index=2;index<PAGE_COUNT;index+=2){
  try{
   pages.push(...await Promise.all([loadPage(index),loadPage(index+1)]));
   update();
  }catch{
   status.title='일부 페이지를 불러오지 못했어. 새로고침하거나 아래에서 샘플을 받아봐.';
   break;
  }
 }
}
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ph=Math.min(H*.94,(W-20)*PAGE_HEIGHT/(2*PAGE_WIDTH));pw=ph*PAGE_WIDTH/PAGE_HEIGHT;left=(W-pw*2)/2;top=(H-ph)/2;render();}
function page(i,x){ctx.drawImage(pages[i],x,top,pw,ph);}
function triangle(img,s,a,b,c){ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();const [u,v,w]=s;const den=u.x*(v.y-w.y)+v.x*(w.y-u.y)+w.x*(u.y-v.y);if(Math.abs(den)>1e-6){const ax=(a.x*(v.y-w.y)+b.x*(w.y-u.y)+c.x*(u.y-v.y))/den,bx=(a.y*(v.y-w.y)+b.y*(w.y-u.y)+c.y*(u.y-v.y))/den,cx=(a.x*(w.x-v.x)+b.x*(u.x-w.x)+c.x*(v.x-u.x))/den,dx=(a.y*(w.x-v.x)+b.y*(u.x-w.x)+c.y*(v.x-u.x))/den,ex=(a.x*(v.x*w.y-w.x*v.y)+b.x*(w.x*u.y-u.x*w.y)+c.x*(u.x*v.y-v.x*u.y))/den,fx=(a.y*(v.x*w.y-w.x*v.y)+b.y*(w.x*u.y-u.x*w.y)+c.y*(u.x*v.y-v.x*u.y))/den;ctx.transform(ax,bx,cx,dx,ex,fx);ctx.drawImage(img,0,0);}ctx.restore();}
function render(){if(!pages.length)return;ctx.clearRect(0,0,W,H);ctx.save();ctx.shadowColor='#0006';ctx.shadowBlur=20;ctx.shadowOffsetY=10;ctx.fillStyle='#dbc9a5';ctx.fillRect(left-3,top+3,pw*2+6,ph+3);ctx.restore();
 if(!turn){page(spread*2,left);page(spread*2+1,left+pw);}else{const forward=turn.dir===1;page(forward?spread*2:spread*2-2,left);page(forward?spread*2+3:spread*2+1,left+pw);}
 const gutter=ctx.createLinearGradient(left+pw-16,0,left+pw+16,0);gutter.addColorStop(0,'#241b1300');gutter.addColorStop(.5,'#241b1345');gutter.addColorStop(1,'#241b1300');ctx.fillStyle=gutter;ctx.fillRect(left+pw-16,top,32,ph);
 if(!turn)return;const p=turn.p,side=turn.dir,front=spread*2+(side===1?1:0),back=front+side;const surface=paperFrame({x:side===1?left+pw:left,y:top,w:pw,h:ph},side,p,0,false,32,6),points=surface.points;
 ctx.save();ctx.fillStyle=`rgba(25,18,10,${.17*Math.sin(p*Math.PI)})`;ctx.beginPath();const boundary=[...points.map(col=>col[0]),...points.slice().reverse().map(col=>col[6])];boundary.forEach((v,i)=>{const x=v.x+v.z*.48,y=v.y+v.z*.32;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();ctx.restore();
 const cells=[];for(let i=0;i<32;i++)for(let j=0;j<6;j++){const a=points[i][j],b=points[i+1][j],c=points[i+1][j+1],d=points[i][j+1];const normal=paperNormal(a,b,c,d,side),center={x:(a.x+b.x+c.x+d.x)/4,y:(a.y+b.y+c.y+d.y)/4,z:(a.z+b.z+c.z+d.z)/4};cells.push({i,j,a,b,c,d,normal,center});}
 cells.sort((a,b)=>a.center.z-b.center.z);for(const cell of cells){const {i,j,normal,center}=cell,isBack=paperFacing(normal,center,surface.camera)<0,flip=isBack?side>0:side<0,tx=u=>(flip?1-u:u)*PAGE_WIDTH,ty=v=>v*PAGE_HEIGHT,s=[{x:tx(i/32),y:ty(j/6)},{x:tx((i+1)/32),y:ty(j/6)},{x:tx((i+1)/32),y:ty((j+1)/6)},{x:tx(i/32),y:ty((j+1)/6)}],v=[cell.a,cell.b,cell.c,cell.d].map(q=>projectPaper(q,surface.camera)),img=pages[isBack?back:front];triangle(img,[s[0],s[1],s[2]],v[0],v[1],v[2]);triangle(img,[s[0],s[2],s[3]],v[0],v[2],v[3]);const lighting=Math.max(0,(isBack?-1:1)*(-.3*normal.x-.4*normal.y+normal.z)/Math.sqrt(1.25));ctx.fillStyle=`rgba(36,27,19,${Math.sin(p*Math.PI)*(.09+.25*(1-lighting))})`;ctx.beginPath();v.forEach((q,k)=>k?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();}}
function canTurn(dir){const target=spread+dir;return !turn&&target>=0&&target<pages.length/2;}
function update(){prev.disabled=!canTurn(-1);next.disabled=!canTurn(1);if(pages.length){const label=`${spread*2+1}–${spread*2+2} / ${PAGE_COUNT}쪽`;if(status.textContent!==label)status.textContent=label;}}
function start(dir){if(!canTurn(dir))return false;turn={dir,p:0,sounded:false};update();return true;}
function settle(commit){if(!turn)return;cancelAnimationFrame(raf);const from=turn.p,target=commit?1:0,startAt=performance.now(),duration=reduced.matches?0:Math.max(150,480*Math.abs(target-from));if(commit&&!turn.sounded)soundStart();const tick=now=>{if(!turn)return;const t=duration?clamp((now-startAt)/duration):1;turn.p=from+(target-from)*(1-Math.pow(1-t,3));if(soundOn)recorded?.motion(Math.abs(target-from)*1.5);render();if(t<1)raf=requestAnimationFrame(tick);else{if(commit){spread+=turn.dir;document.querySelector('#try-book').classList.add('has-turned');}turn=null;raf=0;recorded?.end(commit&&soundOn);render();update();}};raf=requestAnimationFrame(tick);}
function flip(dir){unlock();if(start(dir))settle(true);}
prev.onclick=()=>flip(-1);next.onclick=()=>flip(1);
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();flip(e.key==='ArrowRight'?1:-1);}});
canvas.addEventListener('pointerdown',e=>{if(!pages.length||turn||!e.isPrimary||e.button!==0)return;unlock();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(x<left||x>left+2*pw||y<top||y>top+ph)return;const dir=x>left+pw?1:-1;if(!canTurn(dir))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dir,last:e.clientX,time:e.timeStamp,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}if(!drag.moved&&Math.abs(dx)>5){drag.moved=true;start(drag.dir);}if(turn){turn.p=clamp(-dx*drag.dir/(pw*1.5));if(turn.p>.015&&!turn.sounded)soundStart();if(soundOn)recorded?.motion(Math.abs(e.clientX-drag.last)/Math.max(1,e.timeStamp-drag.time));drag.last=e.clientX;drag.time=e.timeStamp;render();}});
canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(!d.moved)flip(d.dir);else settle(!!turn&&turn.p>.22);});
function cancel(){drag=null;if(turn)settle(false);}
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;turn=null;drag=null;recorded?.end();render();update();}});
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(([entry])=>{if(entry.isIntersecting){prepareAudio();}else{cancelAnimationFrame(raf);raf=0;turn=null;drag=null;recorded?.end();render();update();}},{rootMargin:'180px'}).observe(canvas);
update();
void loadComic();

new IntersectionObserver(([entry])=>document.body.classList.toggle('past-first-book',!entry.isIntersecting),{threshold:0}).observe(document.querySelector('#try-book'));
