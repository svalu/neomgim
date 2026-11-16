import {drawPaperLeaf} from './paper-leaf.js?v=3';
import {RecordedPage} from './page-audio.js';
import {storyLines} from './rion-story.js?v=1';

const canvas=document.querySelector('#demo-book'),ctx=canvas.getContext('2d');
const prev=document.querySelector('#demo-prev'),next=document.querySelector('#demo-next'),soundButton=document.querySelector('#demo-sound'),status=document.querySelector('#demo-status');
const loading=document.querySelector('#demo-loading');
const hint=document.querySelector('.turn-hint'),bookSection=document.querySelector('#try-book');
const storyDetails=document.querySelector('#demo-story'),storyText=document.querySelector('#demo-story-text');
const PAGE_WIDTH=480,PAGE_HEIGHT=720,PAGE_COUNT=22;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const compactPortrait=matchMedia('(max-width: 767px) and (orientation: portrait)');
let pageIndex=0,cover=null,ready=false,turn=null,drag=null,raf=0,pages=[],W=1,H=1,pw=1,ph=1,left=0,top=0,coverWidth=1,soundOn=true,audio,recorded,output;
const coverProgress=()=>turn?.target===-1?1-turn.p:pageIndex===-1?(turn?.p??0):1;
const coverShift=()=>-pw*.5*(1-coverProgress());
const coverScale=()=>1+(coverWidth/pw-1)*(1-coverProgress());
const nextPage=dir=>pageIndex===-1?0:Math.max(-1,pageIndex+dir*2);
const imageAt=index=>index===-1?cover:pages[index];
const clamp=x=>Math.max(0,Math.min(1,x));
function prepareAudio(){try{if(!audio){audio=new AudioContext();output=audio.createGain();output.gain.value=.42;output.connect(audio.destination);recorded=new RecordedPage(audio,output);}recorded.prepare().catch(()=>{});}catch{soundButton.setAttribute('aria-label','소리 사용 불가');soundButton.disabled=true;}}
function unlock(){prepareAudio();if(soundOn&&audio)audio.resume().catch(()=>{});}
function soundStart(){if(soundOn&&recorded){recorded.begin();if(turn)turn.sounded=true;}}
soundButton.onclick=()=>{soundOn=!soundOn;soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.title=soundOn?'종이 소리 끄기':'종이 소리 켜기';if(soundOn)unlock();else recorded?.end();};

async function loadComic(){
 async function loadImage(filename){
  const page=new Image();
  const path = /^\d{2}$/.test(filename) ? `story/${filename}` : filename;
  page.src=new URL(`assets/rion-socks/${path}.webp`,import.meta.url);
  await page.decode();
  return page;
 }
 async function loadSpread(index){
  if(pages[index])return;
  const filenames=index===0?['title-left','title-right']:[index-1,index].map(n=>String(n).padStart(2,'0'));
  const pair=await Promise.all(filenames.map(loadImage));
  pages[index]=pair[0];
  pages[index+1]=pair[1];
 }
 void loadImage('splash-cover-kotori-light').then(image=>{cover=image;update();}).catch(()=>{});
 try{
  await loadSpread(0);
  ready=true;
  loading.hidden=true;
  render();
  update();
 }catch{
  loading.textContent='책을 펼치지 못했어. 새로고침하거나 아래에서 샘플을 받아봐.';
  return;
 }
 for(let index=2;index<PAGE_COUNT;index+=2){
  try{
   await loadSpread(index);
   update();
  }catch{
   status.title='일부 페이지를 불러오지 못했어. 새로고침하거나 아래에서 샘플을 받아봐.';
   break;
  }
 }
}
function resize(){
 const rect=canvas.getBoundingClientRect();
 W=rect.width;
 H=rect.height;
 const dpr=Math.min(devicePixelRatio||1,1.75);
 canvas.width=Math.round(W*dpr);
 canvas.height=Math.round(H*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ph=Math.min(H*.94,Math.max(1,W-20)*PAGE_HEIGHT/(2*PAGE_WIDTH));
 pw=ph*PAGE_WIDTH/PAGE_HEIGHT;
 left=(W-pw*2)/2;
 coverWidth=compactPortrait.matches?Math.max(pw,Math.min(W-20,H*.94*PAGE_WIDTH/PAGE_HEIGHT)):pw;
 top=(H-ph)/2;
 render();
}
function page(index,x){ctx.drawImage(imageAt(index),x,top,pw,ph);}
function render(){
 if(!ready)return;
 ctx.clearRect(0,0,W,H);
 ctx.save();
 const scale=coverScale();
 ctx.translate(W/2,H/2);
 ctx.scale(scale,scale);
 ctx.translate(coverShift()-W/2,-H/2);
 renderBook();
 ctx.restore();
}
function drawPaperStack(x,width){
 ctx.save();
 ctx.shadowColor='#100902a8';
 ctx.shadowBlur=20;
 ctx.shadowOffsetY=8;
 ctx.fillStyle='#dbc9a5';
 ctx.fillRect(x,top+3,width+4,ph+3);
 ctx.restore();
 for(let layer=1;layer<=3;layer++){
  const offset=layer*1.25;
  ctx.strokeStyle=layer%2?'#816344':'#f0dfb9';
  ctx.lineWidth=.8;
  ctx.beginPath();
  ctx.moveTo(x+2,top+ph+offset);
  ctx.lineTo(x+width+offset,top+ph+offset);
  ctx.lineTo(x+width+offset,top+5);
  ctx.stroke();
 }
}

function renderBook(){
 const turningCover=pageIndex===-1||turn?.target===-1;
 const progress=coverProgress();
 const spine=left+pw;
 const leftReveal=turningCover?Math.max(0,-Math.cos(progress*Math.PI)):1;
 const stackLeft=spine-pw*leftReveal;
 drawPaperStack(stackLeft,left+2*pw-stackLeft);
 const current=pageIndex;
 if(turningCover){
  if(progress===0){page(-1,spine);return;}
  page(1,spine);
  if(leftReveal>0){
   ctx.save();
   ctx.beginPath();
   ctx.rect(stackLeft,top,spine-stackLeft,ph);
   ctx.clip();
   page(0,left);
   ctx.restore();
  }
 }else if(!turn){
  page(current,left);
  page(current+1,left+pw);
 }else{
  const forward=turn.dir===1;
  page(forward?current:turn.target,left);
  page(forward?turn.target+1:current+1,left+pw);
 }
 const gutter=ctx.createLinearGradient(left+pw-16,0,left+pw+16,0);
 gutter.addColorStop(0,'#241b1300');
 gutter.addColorStop(.5,'#241b1345');
 gutter.addColorStop(1,'#241b1300');
 ctx.fillStyle=gutter;
 const shadeLeft=Math.max(spine-16,stackLeft);
 ctx.fillRect(shadeLeft,top,spine+16-shadeLeft,ph);
 if(!turn)return;
 const forward=turn.dir===1;
 if(turningCover){
  renderLeaf(spine,1,progress,cover);
  return;
 }
 const front=pages[current+(forward?1:0)];
 const back=pages[turn.target+(forward?0:1)];
 renderLeaf(forward?left+pw:left,turn.dir,turn.p,front,back);
}

function renderLeaf(x,dir,progress,front,back){
 drawPaperLeaf(ctx,{x,y:top,w:pw,h:ph},dir,progress,front,back);
}
function canTurn(dir){
 if(!ready||turn||(dir<0&&pageIndex<0))return false;
 const target=nextPage(dir);
 return target===-1?!!cover:!!pages[target]&&!!pages[target+1];
}
function updateStoryText(){
 const first=pageIndex-2;
 const showsText=ready&&first>=0;
 storyDetails.hidden=!showsText;
 const key=String(first);
 if(!showsText||storyText.dataset.pages===key)return;
 const paragraphs = storyLines.slice(first, first + 2).map(lines => {
  const paragraph = document.createElement('p');
  paragraph.textContent = lines.join(' ');
  return paragraph;
 });
 storyText.replaceChildren(...paragraphs);
 storyText.dataset.pages=key;
}

function update(){
 const closed=pageIndex===-1;
 const current=pageIndex;
 prev.disabled=!canTurn(-1);
 prev.title=current===0&&cover?'이전: 표지':'이전 두 쪽';
 prev.setAttribute('aria-label',prev.title);
 next.disabled=!canTurn(1);
 next.title=closed?'책 펼치기':'다음 두 쪽';
 next.setAttribute('aria-label',next.title);
 bookSection.toggleAttribute('data-cover',closed);
 updateStoryText();
 hint.textContent=closed?'표지를 누르거나 왼쪽으로 밀어봐.':'책장을 좌우로 밀어 넘겨봐.';
 if(!ready)return;
 const number=`${current+1}–${current+2}`;
 const label=closed?'표지':`${number} / ${PAGE_COUNT}쪽`;
 if(status.textContent!==label)status.textContent=label;
}
function start(dir){if(!canTurn(dir))return false;turn={dir,target:nextPage(dir),p:0,sounded:false};update();return true;}
function settle(commit,focusNextOnCover=false){
 if(!turn)return;
 cancelAnimationFrame(raf);
 const from=turn.p,target=commit?1:0,startAt=performance.now();
 const duration=reduced.matches?0:Math.max(150,(pageIndex===-1||turn.target===-1?560:480)*Math.abs(target-from));
 if(commit&&!turn.sounded)soundStart();
 const tick=now=>{
  if(!turn)return;
  const t=duration?clamp((now-startAt)/duration):1;
  turn.p=from+(target-from)*(1-Math.pow(1-t,3));
  if(t<1){
   if(soundOn)recorded?.motion(Math.abs(target-from)*1.5);
   render();
   raf=requestAnimationFrame(tick);
   return;
  }
  if(commit){
   pageIndex=turn.target;
   bookSection.classList.toggle('has-turned',pageIndex>=2);
  }
  turn=null;
  raf=0;
  recorded?.end(commit&&soundOn);
  render();
  update();
  if(commit&&pageIndex===-1&&focusNextOnCover) next.focus({preventScroll:true});
 };
 raf=requestAnimationFrame(tick);
}
function flip(dir,focusNextOnCover=false){unlock();if(start(dir))settle(true,focusNextOnCover);}
prev.onclick=()=>flip(-1,true);
next.onclick=()=>flip(1);
canvas.addEventListener('keydown',e=>{
 if(pageIndex===-1&&(e.key==='Enter'||e.key===' ')){e.preventDefault();flip(1);}
 else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(e.key==='ArrowRight')flip(1);else flip(-1);}
});
canvas.addEventListener('pointerdown',e=>{
 if(!ready||turn||drag||!e.isPrimary||e.button!==0)return;
 const rect=canvas.getBoundingClientRect(),scale=coverScale();
 const x=(e.clientX-rect.left-W/2)/scale+W/2-coverShift();
 const y=(e.clientY-rect.top-H/2)/scale+H/2;
 const closed=pageIndex===-1;
 if(x<(closed?left+pw:left)||x>left+2*pw||y<top||y>top+ph)return;
 const dir=closed||x>left+pw?1:-1;
 if(!canTurn(dir))return;
 unlock();
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,dir,last:e.clientX,time:e.timeStamp,moved:false};
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}
 if(!drag.moved&&Math.abs(dx)>5){
  drag.moved=true;
  if(!start(drag.dir)){drag=null;return;}
 }
 if(!turn)return;
 turn.p=clamp(-dx*drag.dir/(pw*1.5));
 if(turn.p>.015&&!turn.sounded)soundStart();
 if(soundOn)recorded?.motion(Math.abs(e.clientX-drag.last)/Math.max(1,e.timeStamp-drag.time));
 drag.last=e.clientX;
 drag.time=e.timeStamp;
 render();
});
canvas.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const d=drag;
 drag=null;
 const dx=e.clientX-d.x,dy=e.clientY-d.y;
 if(!d.moved&&Math.hypot(dx,dy)<=5){flip(d.dir);return;}
 const progress=clamp(-dx*d.dir/(pw*1.5));
 const commit=progress>.22&&Math.abs(dx)>Math.abs(dy);
 if(!turn&&(!commit||!start(d.dir)))return;
 turn.p=progress;
 settle(commit);
});
function cancel(){drag=null;if(turn)settle(false);}
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
function resetTurn(){
 cancelAnimationFrame(raf);
 raf=0;
 turn=null;
 drag=null;
 recorded?.end();
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){resetTurn();render();update();}
});
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(([entry])=>{if(entry.isIntersecting){prepareAudio();}else{resetTurn();render();update();}},{rootMargin:'180px'}).observe(canvas);
update();
void loadComic();

new IntersectionObserver(([entry]) => {
 document.body.classList.toggle('past-first-book', entry.boundingClientRect.bottom <= 0);
}, { threshold: 0 }).observe(bookSection);
