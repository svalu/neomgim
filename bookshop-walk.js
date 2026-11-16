import { drawPaperLeaf } from './paper-leaf.js?v=2';

const splash = document.querySelector('.bookshop-splash');
const sheet = splash.querySelector('.splash-page');
const art = sheet.querySelector('.splash-art');
const title = sheet.querySelector('.splash-title');
const leaf = sheet.querySelector('.splash-leaf');
const leafContext = leaf.getContext('2d');
const turnDelay = 780;
const replayControls = document.querySelectorAll('[data-splash-replay]');
const soundToggle = document.querySelector('#demo-sound');
const splashAudio = document.querySelector('#splash-audio');
const audioReplay = document.querySelector('[data-splash-audio-replay]');
const startButton = splash.querySelector('.splash-start');
const twoPageLayout = matchMedia('(min-width: 1000px), (min-width: 768px) and (min-height: 500px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload';
const forceSplash = new URLSearchParams(location.search).get('intro') === '1';
const duration = 1500;

let audioDeadline;
let finishTimer;
let turnTimer;
let frame;

function paintArt(ctx, width, height, single, scale = 1) {
  const fullWidth = single ? width : width * 2;
  const offset = fullWidth - width;
  const fit = Math.max(fullWidth / art.naturalWidth, height / art.naturalHeight) * scale;
  const w = art.naturalWidth * fit;
  const h = art.naturalHeight * fit;
  ctx.drawImage(art, (fullWidth - w) * .52 - offset, (height - h) / 2, w, h);
}

function makeFront(width, height, single) {
  const front = document.createElement('canvas');
  front.width = width;
  front.height = height;
  const ctx = front.getContext('2d');
  paintArt(ctx, width, height, single);
  if ('filter' in ctx) {
    const soft = document.createElement('canvas');
    soft.width = width;
    soft.height = height;
    const softContext = soft.getContext('2d');
    softContext.filter = 'blur(9px)';
    paintArt(softContext, width, height, single, 1.03);
    softContext.filter = 'none';
    softContext.globalCompositeOperation = 'destination-in';
    const mask = softContext.createLinearGradient(0, 0, 0, height);
    mask.addColorStop(.04, '#000');
    mask.addColorStop(.32, '#0000');
    mask.addColorStop(.52, '#0000');
    mask.addColorStop(.85, '#000');
    softContext.fillStyle = mask;
    softContext.fillRect(0, 0, width, height);
    ctx.drawImage(soft, 0, 0);
  }

  const center = single ? width / 2 : 0;
  const vignette = ctx.createRadialGradient(center, height / 2, 0, center, height / 2, Math.hypot(width - center, height / 2));
  vignette.addColorStop(0, '#1c110e18');
  vignette.addColorStop(1, '#24171083');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  if (!single) {
    const fold = ctx.createLinearGradient(0, 0, width, 0);
    fold.addColorStop(0, '#24160c9e');
    fold.addColorStop(.03, '#24160c38');
    fold.addColorStop(.08, '#fff0cf1b');
    fold.addColorStop(.22, 'transparent');
    ctx.fillStyle = fold;
    ctx.fillRect(0, 0, width, height);
  }
  paintTitle(ctx, width, height, single);
  return front;
}

function paintTitle(ctx, width, height, single) {
  const style = getComputedStyle(title);
  const scale = (single ? width : width * 2) / sheet.clientWidth;
  const fontSize = parseFloat(style.fontSize) * scale;
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${parseFloat(style.letterSpacing) * scale}px`;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#251206';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetY = 2 * scale;
  const center = single ? width / 2 : 0;
  ctx.fillText(title.textContent, center + .03 * fontSize, height / 2);
}

function syncLayout() {
  if (!sheet.classList.contains('is-turning')) {
    sheet.classList.toggle('is-single-page', !twoPageLayout.matches);
  }
}

function turnLeaf() {
  if (!splash.open || reducedMotion.matches || !leafContext || !art.naturalWidth) return;

  const width = sheet.clientWidth;
  const height = sheet.clientHeight;
  if (!width || !height) return;
  const scale = Math.min(devicePixelRatio || 1, 1.35, Math.sqrt(1600000 / (width * height)));
  const halfWidth = Math.max(1, Math.round(width * scale / 2));
  leaf.width = halfWidth * 2;
  leaf.height = Math.max(1, Math.round(height * scale));
  leafContext.setTransform(leaf.width / width, 0, 0, leaf.height / height, 0, 0);
  const single = sheet.classList.contains('is-single-page');
  const pageWidth = single ? width : width / 2;
  const front = makeFront(single ? leaf.width : halfWidth, leaf.height, single);
  const rect = { x: width - pageWidth, y: 0, w: pageWidth, h: height };
  const start = performance.now();
  const travel = duration - turnDelay;

  leafContext.drawImage(front, rect.x, 0, rect.w, rect.h);
  sheet.classList.add('is-turning');
  function tick(now) {
    const fraction = Math.min(1, (now - start) / travel);
    const progress = fraction * fraction * (3 - 2 * fraction);
    leafContext.clearRect(0, 0, width, height);
    drawPaperLeaf(leafContext, rect, 1, progress, front, null, { clipped: single, strips: 32, rows: 3 });
    if (fraction < 1) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
}

if (reloading) {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startTurn() {
  startButton.hidden = true;
  sheet.classList.add('is-playing');
  turnTimer = setTimeout(turnLeaf, turnDelay);
  finishTimer = setTimeout(closeSplash, duration + 60);
}

function playSound(allowPrompt) {
  if (audioDeadline !== undefined) return;
  splashAudio.currentTime = 0;
  const deadline = setTimeout(() => {
    splashAudio.pause();
    finish(new Error('Sound load timed out'));
  }, 900);
  audioDeadline = deadline;

  function finish(error) {
    if (audioDeadline !== deadline || !splash.open) return;
    clearTimeout(deadline);
    audioDeadline = undefined;

    if (error?.name === 'NotAllowedError' && allowPrompt) {
      startButton.hidden = false;
      startButton.focus({ preventScroll: true });
      return;
    }
    audioReplay.hidden = !error;
    startTurn();
  }

  splashAudio.play().then(() => finish(), finish);
}

function closeSplash() {
  if (!splash.open) return;
  clearTimeout(audioDeadline);
  audioDeadline = undefined;
  clearTimeout(finishTimer);
  clearTimeout(turnTimer);
  cancelAnimationFrame(frame);
  splashAudio.pause();
  splash.close();
  startButton.hidden = true;
  sheet.classList.remove('is-turning', 'is-playing');
  leaf.width = 1;
}

function showSplash(fromClick = false, forceSound = false) {
  if (splash.open || document.hidden) return;
  if (fromClick) window.scrollTo({ top: 0, behavior: 'instant' });
  syncLayout();
  splash.showModal();

  if (forceSound || soundToggle.getAttribute('aria-pressed') !== 'false') playSound(!fromClick);
  else startTurn();
}

if (typeof splash.showModal === 'function') {
  for (const control of replayControls) {
    if (control !== audioReplay) control.hidden = false;
    control.addEventListener('click', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      showSplash(true, control === audioReplay);
    });
  }
  startButton.addEventListener('click', () => playSound(false));
  splash.addEventListener('cancel', event => { event.preventDefault(); closeSplash(); });
  sheet.addEventListener('animationend', event => {
    if (event.target === sheet && event.animationName === 'splash-clear') closeSplash();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) closeSplash();
  });
  reducedMotion.addEventListener('change', closeSplash);
  twoPageLayout.addEventListener('change', syncLayout);
  if (reloading || forceSplash || !location.hash) showSplash();
}
