import {paperFrame,projectPaper,paperNormal,paperFacing} from './curl-geometry.js';
import {RecordedPage} from './page-audio.js';

const canvas=document.querySelector('#demo-book'),ctx=canvas.getContext('2d');
const prev=document.querySelector('#demo-prev'),next=document.querySelector('#demo-next'),soundButton=document.querySelector('#demo-sound'),status=document.querySelector('#demo-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let spread=0,turn=null,drag=null,raf=0,pages=[],W=1,H=1,pw=1,ph=1,left=0,top=0,soundOn=true,audio,recorded,output,visible=false;
const clamp=x=>Math.max(0,Math.min(1,x));
function prepareAudio(){try{if(!audio){audio=new AudioContext();output=audio.createGain();output.gain.value=.42;output.connect(audio.destination);recorded=new RecordedPage(audio,output);}recorded.prepare().catch(()=>{});}catch{soundButton.setAttribute('aria-label','소리 사용 불가');soundButton.disabled=true;}}
function unlock(){prepareAudio();if(soundOn&&audio)audio.resume().catch(()=>{});}
function soundStart(){if(soundOn&&recorded){recorded.begin();if(turn)turn.sounded=true;}}
soundButton.onclick=()=>{soundOn=!soundOn;soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.title=soundOn?'종이 소리 끄기':'종이 소리 켜기';if(soundOn)unlock();else recorded?.end();};

function makePages(){pages=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=480;c.height=680;const g=c.getContext('2d');g.fillStyle=i===0?'#49604f':'#f4eddb';g.fillRect(0,0,480,680);g.strokeStyle=i===0?'#b5bd92':'#c6b795';g.strokeRect(25,25,430,630);g.textAlign='center';g.fillStyle=i===0?'#f3e7cd':'#564634';g.font='14px Pretendard';g.fillText(i===0?'넘김':'CAT BOOKSHOP',240,65);
 const titles=['딱 한권만.','문을 열면','내 책, 내 자리','스륵.','읽던 곳부터','한 권 더?'];
 g.font='40px Bookshop';g.fillText(titles[i],240,158);
 const lines=[['잠깐 들렀다가','조금 오래 머무는 곳.'],['계단을 내려오면','불 켜진 책방이 있어요.'],['좋아하는 책을 꽂아두고','천천히 골라보세요.'],['손끝을 따라 휘는 종이,','한 장 넘어가는 소리.'],['책갈피를 꽂아두었어요.','이어서 읽으면 돼요.'],['음...','딱 한권만...']][i];
 g.font='22px Bookshop';lines.forEach((t,j)=>g.fillText(t,240,485+j*40));
 // Original line illustration, drawn directly into the sample page.
 g.strokeStyle=i===0?'#ded3af':'#947958';g.fillStyle=i===0?'#ded3af':'#947958';g.lineWidth=3;
 if(i%3===0){g.beginPath();g.moveTo(170,369);g.quadraticCurveTo(145,333,176,296);g.lineTo(177,263);g.lineTo(201,281);g.quadraticCurveTo(229,268,252,283);g.lineTo(276,261);g.lineTo(280,302);g.quadraticCurveTo(310,350,277,378);g.quadraticCurveTo(219,399,170,369);g.stroke();g.beginPath();g.moveTo(277,377);g.bezierCurveTo(345,409,349,348,319,352);g.stroke();g.beginPath();g.arc(205,313,2,0,7);g.arc(251,313,2,0,7);g.fill();}
 else if(i%3===1){g.strokeRect(145,250,190,145);g.beginPath();g.moveTo(240,250);g.lineTo(240,395);g.moveTo(160,273);g.lineTo(218,273);g.moveTo(160,290);g.lineTo(218,290);g.moveTo(263,273);g.lineTo(320,273);g.stroke();}
 else {for(let k=0;k<7;k++){g.strokeRect(130+k*33,275+(k%3)*12,25,110-(k%3)*12);}g.fillRect(120,388,246,7);}
 g.font='14px Pretendard';g.fillText(String(i+1).padStart(2,'0'),240,624);return c;});render();}
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ph=Math.min(H*.82,W*.64);pw=ph*480/680;left=(W-pw*2)/2;top=(H-ph)/2;render();}
function page(i,x){ctx.drawImage(pages[i],x,top,pw,ph);}
function triangle(img,s,a,b,c){ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();const [u,v,w]=s;const den=u.x*(v.y-w.y)+v.x*(w.y-u.y)+w.x*(u.y-v.y);if(Math.abs(den)>1e-6){const ax=(a.x*(v.y-w.y)+b.x*(w.y-u.y)+c.x*(u.y-v.y))/den,bx=(a.y*(v.y-w.y)+b.y*(w.y-u.y)+c.y*(u.y-v.y))/den,cx=(a.x*(w.x-v.x)+b.x*(u.x-w.x)+c.x*(v.x-u.x))/den,dx=(a.y*(w.x-v.x)+b.y*(u.x-w.x)+c.y*(v.x-u.x))/den,ex=(a.x*(v.x*w.y-w.x*v.y)+b.x*(w.x*u.y-u.x*w.y)+c.x*(u.x*v.y-v.x*u.y))/den,fx=(a.y*(v.x*w.y-w.x*v.y)+b.y*(w.x*u.y-u.x*w.y)+c.y*(u.x*v.y-v.x*u.y))/den;ctx.transform(ax,bx,cx,dx,ex,fx);ctx.drawImage(img,0,0);}ctx.restore();}
function render(){if(!pages.length)return;ctx.clearRect(0,0,W,H);ctx.save();ctx.shadowColor='#0006';ctx.shadowBlur=20;ctx.shadowOffsetY=10;ctx.fillStyle='#dbc9a5';ctx.fillRect(left-3,top+3,pw*2+6,ph+3);ctx.restore();
 if(!turn){page(spread*2,left);page(spread*2+1,left+pw);}else{const forward=turn.dir===1;page(forward?spread*2:spread*2-2,left);page(forward?spread*2+3:spread*2+1,left+pw);}
 const gutter=ctx.createLinearGradient(left+pw-16,0,left+pw+16,0);gutter.addColorStop(0,'#241b1300');gutter.addColorStop(.5,'#241b1345');gutter.addColorStop(1,'#241b1300');ctx.fillStyle=gutter;ctx.fillRect(left+pw-16,top,32,ph);
 if(!turn)return;const p=turn.p,side=turn.dir,front=spread*2+(side===1?1:0),back=front+side;const surface=paperFrame({x:side===1?left+pw:left,y:top,w:pw,h:ph},side,p,0,false,32,6),points=surface.points;
 ctx.save();ctx.fillStyle=`rgba(25,18,10,${.17*Math.sin(p*Math.PI)})`;ctx.beginPath();const boundary=[...points.map(col=>col[0]),...points.slice().reverse().map(col=>col[6])];boundary.forEach((v,i)=>{const x=v.x+v.z*.48,y=v.y+v.z*.32;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();ctx.restore();
 const cells=[];for(let i=0;i<32;i++)for(let j=0;j<6;j++){const a=points[i][j],b=points[i+1][j],c=points[i+1][j+1],d=points[i][j+1];const normal=paperNormal(a,b,c,d,side),center={x:(a.x+b.x+c.x+d.x)/4,y:(a.y+b.y+c.y+d.y)/4,z:(a.z+b.z+c.z+d.z)/4};cells.push({i,j,a,b,c,d,normal,center});}
 cells.sort((a,b)=>a.center.z-b.center.z);for(const cell of cells){const {i,j,normal,center}=cell,isBack=paperFacing(normal,center,surface.camera)<0,flip=isBack?side>0:side<0,tx=u=>(flip?1-u:u)*480,ty=v=>v*680,s=[{x:tx(i/32),y:ty(j/6)},{x:tx((i+1)/32),y:ty(j/6)},{x:tx((i+1)/32),y:ty((j+1)/6)},{x:tx(i/32),y:ty((j+1)/6)}],v=[cell.a,cell.b,cell.c,cell.d].map(q=>projectPaper(q,surface.camera)),img=pages[isBack?back:front];triangle(img,[s[0],s[1],s[2]],v[0],v[1],v[2]);triangle(img,[s[0],s[2],s[3]],v[0],v[2],v[3]);const lighting=Math.max(0,(isBack?-1:1)*(-.3*normal.x-.4*normal.y+normal.z)/Math.sqrt(1.25));ctx.fillStyle=`rgba(36,27,19,${Math.sin(p*Math.PI)*(.09+.25*(1-lighting))})`;ctx.beginPath();v.forEach((q,k)=>k?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();}}
function update(){prev.disabled=spread===0||!!turn;next.disabled=spread===2||!!turn;status.textContent=`${spread*2+1}–${spread*2+2} / 6쪽`;}
function start(dir){if(turn||spread+dir<0||spread+dir>2)return false;turn={dir,p:0,sounded:false};update();return true;}
function settle(commit){if(!turn)return;cancelAnimationFrame(raf);const from=turn.p,target=commit?1:0,startAt=performance.now(),duration=reduced.matches?0:Math.max(150,480*Math.abs(target-from));if(commit&&!turn.sounded)soundStart();const tick=now=>{if(!turn)return;const t=duration?clamp((now-startAt)/duration):1;turn.p=from+(target-from)*(1-Math.pow(1-t,3));if(soundOn)recorded?.motion(Math.abs(target-from)*1.5);render();if(t<1)raf=requestAnimationFrame(tick);else{if(commit){spread+=turn.dir;document.querySelector('#try-book').classList.add('has-turned');}turn=null;raf=0;recorded?.end(commit&&soundOn);render();update();}};raf=requestAnimationFrame(tick);}
function flip(dir){unlock();if(start(dir))settle(true);}
prev.onclick=()=>flip(-1);next.onclick=()=>flip(1);
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();flip(e.key==='ArrowRight'?1:-1);}});
canvas.addEventListener('pointerdown',e=>{if(turn||!e.isPrimary||e.button!==0)return;unlock();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(x<left||x>left+2*pw||y<top||y>top+ph)return;const dir=x>left+pw?1:-1;if(spread+dir<0||spread+dir>2)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dir,last:e.clientX,time:e.timeStamp,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}if(!drag.moved&&Math.abs(dx)>5){drag.moved=true;start(drag.dir);}if(turn){turn.p=clamp(-dx*drag.dir/(pw*1.5));if(turn.p>.015&&!turn.sounded)soundStart();if(soundOn)recorded?.motion(Math.abs(e.clientX-drag.last)/Math.max(1,e.timeStamp-drag.time));drag.last=e.clientX;drag.time=e.timeStamp;render();}});
canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(!d.moved)flip(d.dir);else settle(!!turn&&turn.p>.22);});
function cancel(){drag=null;if(turn)settle(false);}
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;turn=null;drag=null;recorded?.end();render();update();}});
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){if(!pages.length){makePages();document.fonts.ready.then(makePages);}prepareAudio();}else{cancelAnimationFrame(raf);raf=0;turn=null;drag=null;recorded?.end();render();update();}},{rootMargin:'180px'}).observe(canvas);
update();

new IntersectionObserver(([entry])=>document.body.classList.toggle('past-first-book',!entry.isIntersecting),{threshold:0}).observe(document.querySelector('#try-book'));
