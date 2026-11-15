const walk = document.querySelector('.bookshop-walk');
const skip = walk.querySelector('.walk-skip');
const sound = walk.querySelector('.walk-sound');
const readerHeading = document.querySelector('#flip-heading');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sessionKey = 'neomgim-walk-seen';
const walkDuration = 4600;
const doorStart = 0.76;
const stepCount = 5;
const stepContact = 0.28;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);

let frame = 0;
let closingTimer = 0;
let progress = 0;
let doorAudio;
let doorBuffer;
let footsteps = [];
const playing = new Set();
let soundEnabled = false;
let doorPlayed = false;

function seenSplash() {
  try { return sessionStorage.getItem(sessionKey) === 'yes'; }
  catch { return false; }
}

function stopSounds() {
  for (const source of playing) source.stop();
  playing.clear();
}

function closeSplash(natural = false) {
  cancelAnimationFrame(frame);
  clearTimeout(closingTimer);
  if (!walk.open) return;
  walk.close();
  if (natural !== true) stopSounds();
  try { sessionStorage.setItem(sessionKey, 'yes'); } catch {}
  readerHeading.focus({ preventScroll: true });
}

async function prepareDoorSound() {
  doorAudio ??= new AudioContext();
  if (!footsteps.length) {
    footsteps = Array.from({ length: stepCount }, (_, index) => makeFootstep(doorAudio, index));
  }
  await doorAudio.resume();
  doorBuffer ??= fetch(new URL('./audio/bookshop-door.wav', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Door sound unavailable');
      return response.arrayBuffer();
    })
    .then(bytes => doorAudio.decodeAudioData(bytes));
  await doorBuffer;
}

function makeFootstep(context, index) {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(0.21 * rate), rate);
  const samples = buffer.getChannelData(0);
  let seed = 719 + index * 7919;
  let low = 0;
  let grit = 0;
  const pitch = 71 + (index % 3) * 7;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += 0.035 * (noise - low);
    grit += 0.12 * (noise - grit);
    const heel = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 49);
    const stone = low * Math.exp(-t * 30);
    const scrape = (grit - low) * Math.exp(-t * 21);
    samples[i] = (heel * 0.27 + stone * 0.44 + scrape * 0.12)
      * Math.min(1, t / 0.004) * Math.min(1, (0.21 - t) / 0.04);
  }
  return buffer;
}

function playBuffer(buffer, gain) {
  const source = doorAudio.createBufferSource();
  const volume = doorAudio.createGain();
  volume.gain.value = gain;
  source.buffer = buffer;
  source.connect(volume).connect(doorAudio.destination);
  source.onended = () => {
    source.disconnect();
    volume.disconnect();
    playing.delete(source);
  };
  playing.add(source);
  source.start();
}

async function playDoorSound() {
  if (!soundEnabled || !doorBuffer || doorPlayed) return;
  const buffer = await doorBuffer.catch(() => null);
  if (!buffer || !walk.open || !soundEnabled || doorPlayed) return;
  doorPlayed = true;
  playBuffer(buffer, 0.62);
}

function cadenceAt(value) {
  return clamp(value / doorStart) * stepCount;
}

function render() {
  const walking = clamp(progress / doorStart);
  const envelope = Math.sin(walking * Math.PI) ** 0.65;
  const cadence = cadenceAt(progress);
  const phase = cadence % 1;
  // The camera dips quickly on contact and rises more slowly as weight shifts.
  const impact = 1 - smooth(clamp(Math.abs(phase - stepContact) / 0.27));
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
  walk.style.setProperty('--canopy-y', `${near * -8}%`);
  walk.style.setProperty('--rail-x', `${approach * 2.1}%`);
  walk.style.setProperty('--rail-y', `${approach * 1.2}%`);
  walk.style.setProperty('--door-angle', `${-78 * opening}deg`);
  walk.style.setProperty('--door-visible', smooth(clamp(opening * 10)));
  walk.style.setProperty('--door-glow', opening * 0.18);
  walk.style.setProperty('--room-pan', `${opening * -2.3 - throughDoor * 1.5}%`);
}

function startWalk() {
  const startTime = performance.now();
  const advance = now => {
    const previous = progress;
    progress = clamp((now - startTime) / walkDuration);
    render();
    const previousStep = Math.floor(cadenceAt(previous) - stepContact);
    const currentStep = Math.floor(cadenceAt(progress) - stepContact);
    if (currentStep > previousStep && progress < doorStart && soundEnabled && doorAudio?.state === 'running') {
      playBuffer(footsteps[currentStep], 0.082 + currentStep * 0.006);
    }
    if (previous < doorStart && progress >= doorStart) void playDoorSound();
    if (progress < 1) {
      frame = requestAnimationFrame(advance);
      return;
    }
    walk.classList.add('is-exiting');
    closingTimer = setTimeout(() => closeSplash(true), 470);
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
      stopSounds();
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
  walk.querySelector('.walk-rail-wall').decode()
    .then(() => walk.classList.add('walk-rail-ready')).catch(() => {});
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
