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
let pageIndex=0,cover=null,backCover=null,ready=false,turn=null,drag=null,raf=0,pages=[],W=1,H=1,pw=1,ph=1,left=0,top=0,coverWidth=1,soundOn=true,audio,recorded,output;
const FRONT_COVER=-1,BACK_COVER=PAGE_COUNT;
const isCover=index=>index===FRONT_COVER||index===BACK_COVER;
const coverSide=()=>pageIndex===BACK_COVER||turn?.target===BACK_COVER?-1:1;
const coverProgress=()=>isCover(turn?.target)?1-turn.p:isCover(pageIndex)?(turn?.p??0):1;
const coverShift=()=>-coverSide()*pw*.5*(1-coverProgress());
const coverScale=()=>1+(coverWidth/pw-1)*(1-coverProgress());
const nextPage=dir=>pageIndex===FRONT_COVER?0:Math.max(FRONT_COVER,pageIndex+dir*2);
const imageAt=index=>index===FRONT_COVER?cover:index===BACK_COVER?backCover:pages[index];
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
 void loadImage('back-cover').then(image=>{backCover=image;update();}).catch(()=>{});
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

function drawGutter(spine,stackLeft,stackRight,opacity){
 if(opacity<=0)return;
 const radius=Math.min(16,pw*.085);
 const gutter=ctx.createLinearGradient(spine-radius,0,spine+radius,0);
 gutter.addColorStop(0,'#241b1300');
 gutter.addColorStop(.5,'#241b1345');
 gutter.addColorStop(1,'#241b1300');
 const shadeLeft=Math.max(spine-radius,stackLeft);
 ctx.save();
 ctx.globalAlpha*=opacity;
 ctx.fillStyle=gutter;
 ctx.fillRect(shadeLeft,top,Math.min(spine+radius,stackRight)-shadeLeft,ph);
 ctx.restore();
}

function renderBook(){
 const coverIndex=isCover(pageIndex)?pageIndex:turn?.target;
 const turningCover=isCover(coverIndex);
 const side=coverSide();
 const progress=coverProgress();
 const spine=left+pw;
 const reveal=turningCover?Math.max(0,-Math.cos(progress*Math.PI)):1;
 const stackLeft=side===1?spine-pw*reveal:left;
 const stackRight=side<0?spine+pw*reveal:spine+pw;
 const coverX=side===1?spine:left;
 drawPaperStack(stackLeft,stackRight-stackLeft);
 const current=pageIndex;
 if(turningCover){
  if(progress===0){page(coverIndex,coverX);return;}
  page(side===1?1:PAGE_COUNT-2,coverX);
  if(reveal>0){
   ctx.save();
   ctx.beginPath();
   ctx.rect(side===1?stackLeft:spine,top,pw*reveal,ph);
   ctx.clip();
   page(side===1?0:PAGE_COUNT-1,side===1?left:spine);
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
 const strength=turningCover?progress:1;
 let contact=1;
 if(turn){
  // Blend the binding shadow onto the moving leaf as it meets the flat spread.
  const distance=clamp(Math.min(turn.p,1-turn.p)/.26);
  contact=1-distance*distance*(3-2*distance);
  drawGutter(spine,stackLeft,stackRight,strength*(1-contact));
  if(turningCover){
   renderLeaf(coverX,side,progress,imageAt(coverIndex));
  }else{
   const forward=turn.dir===1;
   const front=pages[current+(forward?1:0)];
   const back=pages[turn.target+(forward?0:1)];
   renderLeaf(forward?spine:left,turn.dir,turn.p,front,back);
  }
 }
 drawGutter(spine,stackLeft,stackRight,strength*contact);
}

function renderLeaf(x,dir,progress,front,back){
 drawPaperLeaf(ctx,{x,y:top,w:pw,h:ph},dir,progress,front,back);
}
function canTurn(dir){
 if(!ready||turn||(dir<0&&pageIndex===FRONT_COVER)||(dir>0&&pageIndex===BACK_COVER))return false;
 const target=nextPage(dir);
 return isCover(target)?!!imageAt(target):!!pages[target]&&!!pages[target+1];
}
function updateStoryText(){
 const first=pageIndex-2;
 const showsText=ready&&first>=0&&pageIndex<PAGE_COUNT;
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
 const closed=isCover(pageIndex);
 const current=pageIndex;
 prev.disabled=!canTurn(-1);
 prev.title=current===BACK_COVER?'책 다시 펼치기':current===0&&cover?'이전: 표지':'이전 두 쪽';
 prev.setAttribute('aria-label',prev.title);
 next.disabled=!canTurn(1);
 next.title=current===FRONT_COVER?'책 펼치기':current===PAGE_COUNT-2&&backCover?'다음: 뒤표지':'다음 두 쪽';
 next.setAttribute('aria-label',next.title);
 bookSection.toggleAttribute('data-cover',closed);
 updateStoryText();
 hint.textContent=closed
  ?current===BACK_COVER?'뒤표지를 누르거나 오른쪽으로 밀어봐.':'표지를 누르거나 왼쪽으로 밀어봐.'
  :'책장을 좌우로 밀어 넘겨봐.';
 if(!ready)return;
 const number=`${current+1}–${current+2}`;
 const label=closed?(current===BACK_COVER?'뒤표지':'표지'):`${number} / ${PAGE_COUNT}쪽`;
 if(status.textContent!==label)status.textContent=label;
}
function start(dir){if(!canTurn(dir))return false;turn={dir,target:nextPage(dir),p:0,sounded:false};update();return true;}
function settle(commit,focusOnCover=false){
 if(!turn)return;
 cancelAnimationFrame(raf);
 const from=turn.p,target=commit?1:0,startAt=performance.now();
 const duration=reduced.matches?0:Math.max(150,(isCover(pageIndex)||isCover(turn.target)?560:480)*Math.abs(target-from));
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
   bookSection.classList.toggle('has-turned',pageIndex>=2&&!isCover(pageIndex));
  }
  turn=null;
  raf=0;
  recorded?.end(commit&&soundOn);
  render();
  update();
  if(commit&&isCover(pageIndex)&&focusOnCover)(pageIndex===BACK_COVER?prev:next).focus({preventScroll:true});
 };
 raf=requestAnimationFrame(tick);
}
function flip(dir,focusOnCover=false){unlock();if(start(dir))settle(true,focusOnCover);}
prev.onclick=()=>flip(-1,true);
next.onclick=()=>flip(1,true);
canvas.addEventListener('keydown',e=>{
 if(isCover(pageIndex)&&(e.key==='Enter'||e.key===' ')){e.preventDefault();flip(coverSide());}
 else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(e.key==='ArrowRight')flip(1);else flip(-1);}
});
canvas.addEventListener('pointerdown',e=>{
 if(!ready||turn||drag||!e.isPrimary||e.button!==0)return;
 const rect=canvas.getBoundingClientRect(),scale=coverScale();
 const x=(e.clientX-rect.left-W/2)/scale+W/2-coverShift();
 const y=(e.clientY-rect.top-H/2)/scale+H/2;
 const first=pageIndex===FRONT_COVER?left+pw:left;
 const last=pageIndex===BACK_COVER?left+pw:left+2*pw;
 if(x<first||x>last||y<top||y>top+ph)return;
 const dir=isCover(pageIndex)?coverSide():x>left+pw?1:-1;
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
