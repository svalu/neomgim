'use strict';
const REPO='svalu/paperbook-releases';
let release={version:'0.6.47',url:'https://github.com/svalu/paperbook-releases/releases/download/v0.6.47/paperbook-0.6.47.apk',page:'https://github.com/svalu/paperbook-releases/releases/tag/v0.6.47',bytes:33971410};
const dialog=document.querySelector('#guide-dialog');
const guideStep=dialog.querySelector('#guide-step');
const guideTitle=dialog.querySelector('#dialog-title');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let mode='install',step=0,opener,guideMessage='';
let stepMotion, guideRevision=0;
let toastTimer;
function toast(text){const node=document.querySelector('#toast');node.textContent=text;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),5000);}
const steps={install:[
 {title:'먼저, 설치 파일을 받아요.',copy:'아래 버튼을 누르면 GitHub에서 Android 설치 파일을 내려받아요. 받은 뒤 다음 단계로 이동해 주세요.',note:'다운로드한 파일: {file}\n책 파일은 포함되어 있지 않아요.',action:'설치 파일 다운로드',type:'download',next:'다운로드했어요'},
 {title:'받은 파일을 열어주세요.',copy:'휴대폰의 ‘내 파일’ 또는 ‘파일’ 앱을 열고\n다운로드 폴더에서 {file}를 눌러주세요.',note:'‘이 출처의 앱 설치 허용’이 나오면 GitHub 배포 파일인지 확인한 뒤, Android가 안내하는 해당 앱의 설치 허용을 진행해 주세요.',action:'파일을 열었어요'},
 {title:'Android에서 설치를 확인해요.',copy:'휴대폰의 설치 화면에서 ‘설치’를 누르고,\n완료되면 ‘열기’를 눌러 넘김으로 들어가세요.',note:'이 홈페이지는 설치 완료 여부를 확인할 수 없어요. 설치 화면에서 완료를 확인해 주세요.',action:'안내 닫기',type:'close'}
],update:[
 {title:'앱은 지우지 마세요.',copy:'앱의 버전 번호를 누른 뒤 ‘업데이트 확인’을 선택해 주세요. 직접 설치판 0.6.41부터 홈페이지 없이 다운로드·설치 화면까지 이어져요.\n\n이 페이지에서도 새 설치 파일을 받을 수 있어요.',note:'기존 앱을 그대로 둔 채 업데이트 설치하면 책장·독서 기록·메모를 유지할 수 있어요. 앱 삭제나 데이터 초기화는 하지 마세요.',action:'새 버전 파일 다운로드',type:'download',next:'새 파일을 받았어요'},
 {title:'새 파일을 열어 업데이트해요.',copy:'다운로드 폴더에서 {file}를 열고, Android 설치 화면에서 ‘업데이트’ 또는 ‘설치’를 눌러주세요.',note:'설치 오류가 나도 기존 앱부터 삭제하지 마세요. 앱 버전·배포 출처·저장 공간을 확인한 뒤 다시 시도해 주세요.',action:'업데이트 화면을 확인했어요'},
 {title:'앱에서 버전을 확인해요.',copy:'설치가 끝나면 넘김을 열어 버전 번호와 기존 책장·독서 기록을 확인해 주세요.',note:'이번 안내의 배포 버전은 v{version}예요. 실제 설치 완료는 Android와 앱에서 확인해 주세요.',action:'안내 닫기',type:'close'}
]};
function fill(s){return s.replaceAll('{file}',`paperbook-${release.version}.apk`).replaceAll('{version}',release.version);}
function appendIcon(control,name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('ui-icon');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const use=document.createElementNS(svg.namespaceURI,'use');
  use.setAttribute('href',`assets/hugeicons.svg#${name}`);
  svg.append(use);
  control.append(svg);
}

function actionButton(label,fn,secondary=false,icon='next'){
  const button=document.createElement('button');
  button.className=`button ${secondary?'secondary':'primary'}`;
  button.textContent=label;
  appendIcon(button,icon);
  button.addEventListener('click',fn);
  return button;
}
function downloadAnchor(label){
  const link=document.createElement('a');
  link.className='button primary';
  link.textContent=label;
  appendIcon(link,'download');
  link.href=release.url;
  link.dataset.guideDownload='';
  link.addEventListener('click',()=>{
    const revision=guideRevision;
    setTimeout(()=>{
      if(!dialog.open||revision!==guideRevision)return;
      guideMessage='다운로드를 요청했어요. 휴대폰의 다운로드 목록을 확인해 주세요.';
      if(step===0)changeStep(1);
      else updateGuideFeedback();
    },150);
  });
  return link;
}

function updateGuideRelease(){
  const data=steps[mode][step];
  dialog.querySelector('#step-copy').textContent=fill(data.copy);
  dialog.querySelector('#step-note').textContent=fill(data.note);
  dialog.querySelectorAll('[data-guide-download]').forEach(link=>link.href=release.url);
}

function updateGuideFeedback(){
  const feedback=dialog.querySelector('#guide-feedback');
  feedback.textContent=guideMessage;
  feedback.hidden=!guideMessage;
}

function renderStep(direction=0){
  guideRevision++;
  const data=steps[mode][step];
  dialog.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  dialog.querySelectorAll('.step-indicator i').forEach((bar,index)=>bar.classList.toggle('current',index<=step));
  dialog.querySelector('#step-label').textContent=`${mode==='install'?'처음 설치':'업데이트'} · ${step+1} / 3`;
  guideTitle.textContent=data.title;
  updateGuideFeedback();

  const actions=dialog.querySelector('#step-actions');
  actions.replaceChildren();
  if(data.type==='download'){
    actions.append(downloadAnchor(data.action),actionButton(data.next,()=>changeStep(step+1),true));
  }else{
    actions.append(actionButton(data.action,()=>data.type==='close'?dialog.close():changeStep(step+1),false,data.type==='close'?'close':'next'));
  }
  if(step===1){
    const retry=downloadAnchor('파일을 다시 다운로드');
    retry.className='button secondary';
    actions.append(retry);
  }
  dialog.querySelector('#previous-step').hidden=step===0;
  updateGuideRelease();

  stepMotion?.cancel();
  if(direction&&!reducedMotion.matches){
    stepMotion=guideStep.animate(
      [{opacity:.4,translate:`${direction*9}px 0`},{opacity:1,translate:'0 0'}],
      {duration:180,easing:'ease-out'}
    );
  }
  dialog.scrollTop=0;
  guideTitle.focus({preventScroll:true});
}

function changeStep(target){
  const direction=Math.sign(target-step);
  step=target;
  renderStep(direction);
}

function openGuide(kind,start=0,message='',trigger=document.activeElement){
  if(!dialog.open)opener=trigger;
  mode=kind;
  step=start;
  guideMessage=message;
  if(!dialog.open)dialog.showModal();
  renderStep();
}

function closeOnBackdrop(modal){
  modal.addEventListener('click',event=>{
    if(event.target!==modal)return;
    const bounds=modal.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)modal.close();
  });
}

document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openGuide(button.dataset.open)));
dialog.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  const selected=button.dataset.mode;
  if(selected===mode)return;
  mode=selected;
  guideMessage='';
  step=0;
  renderStep(selected==='update'?1:-1);
}));
dialog.querySelector('#close-guide').addEventListener('click',()=>dialog.close());
dialog.querySelector('#previous-step').addEventListener('click',()=>changeStep(Math.max(0,step-1)));
dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  stepMotion?.cancel();
  opener?.focus({preventScroll:true});
});
closeOnBackdrop(dialog);
document.querySelectorAll('.download').forEach(link=>link.addEventListener('click',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  openGuide('install',1,'다운로드를 요청했어요. 휴대폰의 다운로드 목록을 확인해 주세요.',link);
}));
document.querySelectorAll('[data-share]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);toast('페이지 링크를 복사했어요. 휴대폰으로 보내주세요.');}catch{toast('주소창의 페이지 주소를 복사해 주세요.');}}));
if(!/Android/i.test(navigator.userAgent))document.querySelector('.desktop-hint').hidden=false;
async function refreshRelease(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{signal:controller.signal,headers:{Accept:'application/vnd.github+json'}});if(!response.ok)throw new Error('release unavailable');const data=await response.json();if(data.draft||data.prerelease||typeof data.tag_name!=='string'||!/^v?\d+\.\d+\.\d+$/.test(data.tag_name))throw new Error('invalid release');const asset=data.assets?.find(a=>typeof a.name==='string'&&/^paperbook-[\d.]+\.apk$/.test(a.name));if(!asset)throw new Error('missing apk');const apk=new URL(asset.browser_download_url),page=new URL(data.html_url);if(apk.origin!=='https://github.com'||!apk.pathname.startsWith(`/${REPO}/releases/download/`)||page.origin!=='https://github.com'||!page.pathname.startsWith(`/${REPO}/releases/tag/`))throw new Error('unexpected source');release={version:data.tag_name.replace(/^v/,''),url:apk.href,page:page.href,bytes:asset.size};document.querySelectorAll('.download').forEach(a=>a.href=release.url);document.querySelectorAll('.version').forEach(n=>n.textContent=`v${release.version}`);document.querySelectorAll('.apk-name').forEach(n=>n.textContent=asset.name);document.querySelectorAll('.file-size').forEach(n=>n.textContent=`${(release.bytes/1048576).toFixed(1)} MB`);document.querySelector('#release-link').href=release.page;const date=new Date(data.published_at);document.querySelector('#release-date').textContent=Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);const bullets=String(data.body??'').split(/\r?\n/).filter(l=>/^[-*] /.test(l)).slice(0,5);if(bullets.length){const ul=document.querySelector('#release-notes');ul.replaceChildren(...bullets.map(s=>{const li=document.createElement('li');li.textContent=s.slice(2);return li;}));}document.querySelector('#release-status').textContent='Android 최신 배포 버전을 확인했어요.';if(dialog.open)updateGuideRelease();}catch{document.querySelector('#release-status').textContent='최신 정보 확인이 어려워요. 2026.11.25 확인한 버전이며, 전체 배포 기록에서 최신판을 확인해 주세요.';}finally{clearTimeout(timer);}}
void refreshRelease();

const playTestDialog=document.querySelector('#play-test-dialog');
const playTestButton=document.querySelector('#open-play-test');
playTestButton.addEventListener('click',()=>{
  playTestDialog.showModal();
  playTestDialog.querySelector('#play-test-title').focus({preventScroll:true});
});
playTestDialog.querySelector('#close-play-test').addEventListener('click',()=>playTestDialog.close());
closeOnBackdrop(playTestDialog);
playTestDialog.addEventListener('close',()=>{
  if(!dialog.open)playTestButton.focus({preventScroll:true});
});
playTestDialog.querySelector('#test-use-apk').addEventListener('click',()=>{
  playTestDialog.close();
  openGuide('install',0,'',playTestButton);
});
