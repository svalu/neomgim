const splash = document.querySelector('.bookshop-splash');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sessionKey = 'neomgim-miniature-splash-seen';
const forceSplash = new URLSearchParams(location.search).get('intro') === '1';
const duration = 1500;

function seenSplash() {
  try { return sessionStorage.getItem(sessionKey) === 'yes'; }
  catch { return false; }
}

async function showSplash() {
  if (reducedMotion.matches || document.hidden || typeof splash.showModal !== 'function') return;
  if (!forceSplash && (seenSplash() || location.hash || window.scrollY > 0)) return;

  let artworkDeadline;
  const art = splash.querySelector('.splash-art');
  const loaded = await Promise.race([
    art.decode().then(() => true, () => false),
    new Promise(resolve => { artworkDeadline = setTimeout(() => resolve(false), 900); }),
  ]);
  clearTimeout(artworkDeadline);
  if (!loaded || reducedMotion.matches || document.hidden || window.scrollY > 0) return;

  let finishTimer;
  function closeSplash() {
    if (!splash.open) return;
    clearTimeout(finishTimer);
    splash.close();
    try { sessionStorage.setItem(sessionKey, 'yes'); } catch {}
    document.querySelector('#flip-heading').focus({ preventScroll: true });
  }

  splash.querySelector('.splash-skip').addEventListener('click', closeSplash, { once: true });
  splash.addEventListener('cancel', event => { event.preventDefault(); closeSplash(); });
  splash.addEventListener('animationend', event => {
    if (event.target === splash && event.animationName === 'splash-dismiss') closeSplash();
  });
  reducedMotion.addEventListener('change', event => { if (event.matches) closeSplash(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeSplash(); });

  splash.style.setProperty('--splash-duration', duration + 'ms');
  splash.showModal();
  finishTimer = setTimeout(closeSplash, duration + 45);
}

void showSplash();
