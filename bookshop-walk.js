const walk = document.querySelector('.bookshop-walk');
const skip = walk.querySelector('.walk-skip');
const sound = walk.querySelector('.walk-sound');
const readerHeading = document.querySelector('#flip-heading');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sessionKey = 'neomgim-walk-seen';
const walkDuration = 4600;
const doorStart = 0.76;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);

let frame = 0;
let closingTimer = 0;
let progress = 0;
let doorAudio;
let doorBuffer;
let doorSource;
let soundEnabled = false;
let doorPlayed = false;

function seenSplash() {
  try { return sessionStorage.getItem(sessionKey) === 'yes'; }
  catch { return false; }
}

function closeSplash() {
  cancelAnimationFrame(frame);
  clearTimeout(closingTimer);
  if (!walk.open) return;
  walk.close();
  doorSource?.stop();
  try { sessionStorage.setItem(sessionKey, 'yes'); } catch {}
  readerHeading.focus({ preventScroll: true });
}

async function prepareDoorSound() {
  doorAudio ??= new AudioContext();
  await doorAudio.resume();
  doorBuffer ??= fetch(new URL('./audio/bookshop-door.wav', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Door sound unavailable');
      return response.arrayBuffer();
    })
    .then(bytes => doorAudio.decodeAudioData(bytes));
  await doorBuffer;
}

async function playDoorSound() {
  if (!soundEnabled || !doorBuffer || doorPlayed) return;
  const buffer = await doorBuffer.catch(() => null);
  if (!buffer || !walk.open || !soundEnabled || doorPlayed) return;
  doorPlayed = true;
  const source = doorAudio.createBufferSource();
  const volume = doorAudio.createGain();
  volume.gain.value = 0.62;
  source.buffer = buffer;
  source.connect(volume).connect(doorAudio.destination);
  source.onended = () => {
    source.disconnect();
    volume.disconnect();
    if (doorSource === source) doorSource = null;
  };
  doorSource = source;
  source.start();
}

function render() {
  const walking = clamp(progress / doorStart);
  const envelope = Math.sin(walking * Math.PI) ** 0.65;
  const cadence = walking * 5;
  const phase = cadence % 1;
  // The camera dips quickly on contact and rises more slowly as weight shifts.
  const impact = 1 - smooth(clamp(Math.abs(phase - 0.28) / 0.27));
  const sway = Math.sin(cadence * Math.PI);
  const pace = walking * 0.62 + smooth(walking) * 0.38;
  const approach = pace + Math.sin(cadence * Math.PI * 2) * envelope * 0.012;
  const near = 1 - (1 - approach) ** 2;
  const opening = smooth(clamp((progress - doorStart) / 0.19));
  const throughDoor = smooth(clamp((progress - 0.91) / 0.09));

  walk.style.setProperty('--flat-opacity', 1 - smooth(clamp(progress / 0.16)));
  walk.style.setProperty('--approach', approach + throughDoor * 0.11);
  walk.style.setProperty('--look-y', `${approach * 4.6 + impact * envelope * 0.64 + throughDoor * 0.7}%`);
  walk.style.setProperty('--sway', `${sway * envelope * 0.23}%`);
  walk.style.setProperty('--tilt', `${sway * envelope * 0.18}deg`);
  walk.style.setProperty('--floor-y', `${near * 9 + impact * envelope * 0.20}%`);
  walk.style.setProperty('--pot-left-x', `${near * -6.5}%`);
  walk.style.setProperty('--pot-right-x', `${near * 6.5}%`);
  walk.style.setProperty('--pot-y', `${near * 5.4}%`);
  walk.style.setProperty('--canopy-x', `${near * -2.5}%`);
  walk.style.setProperty('--canopy-y', `${near * -6}%`);
  walk.style.setProperty('--door-angle', `${-78 * opening}deg`);
  walk.style.setProperty('--door-visible', smooth(clamp(opening * 10)));
  walk.style.setProperty('--door-glow', opening * 0.18);
}

function startWalk() {
  const startTime = performance.now();
  const advance = now => {
    const previous = progress;
    progress = clamp((now - startTime) / walkDuration);
    render();
    if (previous < doorStart && progress >= doorStart) void playDoorSound();
    if (progress < 1) {
      frame = requestAnimationFrame(advance);
      return;
    }
    walk.classList.add('is-exiting');
    closingTimer = setTimeout(closeSplash, 470);
  };
  frame = requestAnimationFrame(advance);
}

async function showSplash() {
  const force = new URLSearchParams(location.search).get('intro') === '1';
  if (reducedMotion.matches || document.hidden || typeof walk.showModal !== 'function') return;
  if (!force && (seenSplash() || location.hash || window.scrollY > 0)) return;

  skip.addEventListener('click', closeSplash);
  walk.addEventListener('cancel', event => {
    event.preventDefault();
    closeSplash();
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) closeSplash();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) closeSplash();
  });
  sound.addEventListener('click', async () => {
    soundEnabled = !soundEnabled;
    sound.setAttribute('aria-pressed', String(soundEnabled));
    if (!soundEnabled) {
      doorSource?.stop();
      return;
    }
    try {
      await prepareDoorSound();
      if (progress >= doorStart) void playDoorSound();
    } catch {
      soundEnabled = false;
      sound.setAttribute('aria-pressed', 'false');
    }
  });
  walk.showModal();

  walk.querySelector('.walk-clean').decode()
    .then(() => walk.classList.add('walk-layers-ready')).catch(() => {});
  walk.querySelector('.walk-doorway img').decode()
    .then(() => walk.classList.add('walk-door-ready')).catch(() => {});

  let imageDeadline;
  const loaded = await Promise.race([
    walk.querySelector('.walk-flat').decode().then(() => true, () => false),
    new Promise(resolve => { imageDeadline = setTimeout(() => resolve(false), 1200); }),
  ]);
  clearTimeout(imageDeadline);
  if (!walk.open) return;
  if (loaded) startWalk();
  else closeSplash();
}

void showSplash();
