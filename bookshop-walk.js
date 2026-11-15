const walk = document.querySelector('.bookshop-walk');
const stage = walk.querySelector('.walk-stage');
const enter = walk.querySelector('.walk-enter');
const reader = document.querySelector('#try-book');
const readerHeading = reader.querySelector('h1');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);

let renderFrame = 0;
let walkFrame = 0;
let doorAudio;
let doorBuffer;
let doorSource;
let playDoorOnApproach = false;

walk.classList.add('walk-enabled');
walk.querySelector('.walk-clean').decode()
  .then(() => walk.classList.add('walk-layers-ready'))
  .catch(() => {});
walk.querySelector('.walk-doorway img').decode()
  .then(() => walk.classList.add('walk-door-ready'))
  .catch(() => {});

async function prepareDoorSound() {
  try {
    doorAudio ??= new AudioContext();
    await doorAudio.resume();
    doorBuffer ??= fetch(new URL('./audio/bookshop-door.wav', import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error('Door sound unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => doorAudio.decodeAudioData(bytes))
      .catch(() => null);
  } catch {
    // The walk is still interactive when the browser cannot play audio.
  }
}

async function playDoorSound() {
  const buffer = await doorBuffer;
  if (!buffer || !walkFrame) return;
  const source = doorAudio.createBufferSource();
  const volume = doorAudio.createGain();
  volume.gain.value = 0.65;
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
  renderFrame = 0;
  const distance = walk.offsetHeight - stage.offsetHeight;
  const progress = distance > 0 ? clamp(-walk.getBoundingClientRect().top / distance) : 0;
  const approach = smooth(clamp(progress / 0.91));
  const near = Math.min(1, approach * 1.8);
  const opening = smooth(clamp((progress - 0.79) / 0.21));
  const step = Math.sin(approach * Math.PI * 8) * Math.sin(approach * Math.PI) * 0.29;

  walk.style.setProperty('--flat-opacity', 1 - smooth(clamp(progress / 0.18)));
  walk.style.setProperty('--approach', approach);
  walk.style.setProperty('--look-y', `${approach * 4.6 + step}%`);
  walk.style.setProperty('--floor-y', `${near * 9}%`);
  walk.style.setProperty('--pot-left-x', `${near * -6.5}%`);
  walk.style.setProperty('--pot-right-x', `${near * 6.5}%`);
  walk.style.setProperty('--pot-y', `${near * 5.4}%`);
  walk.style.setProperty('--canopy-x', `${near * -2.5}%`);
  walk.style.setProperty('--canopy-y', `${near * -6}%`);
  walk.style.setProperty('--door-angle', `${-78 * opening}deg`);
  walk.style.setProperty('--door-visible', smooth(clamp(opening * 10)));
  walk.style.setProperty('--action-opacity', Math.max(0.38, 1 - approach * 0.62));

  if (playDoorOnApproach && progress >= 0.79) {
    playDoorOnApproach = false;
    void playDoorSound();
  }
}

function queueRender() {
  if (!renderFrame) renderFrame = requestAnimationFrame(render);
}

function stopWalk() {
  cancelAnimationFrame(walkFrame);
  walkFrame = 0;
  playDoorOnApproach = false;
  doorSource?.stop();
  doorSource = null;
}

enter.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (reducedMotion.matches) return;
  event.preventDefault();
  stopWalk();
  void prepareDoorSound();
  playDoorOnApproach = true;

  const startY = window.scrollY;
  const endY = startY + reader.getBoundingClientRect().top;
  const thresholdY = endY - stage.offsetHeight;
  const approachEndY = Math.max(startY, thresholdY);
  const approachDistance = approachEndY - startY;
  const scrollDistance = walk.offsetHeight - stage.offsetHeight;
  const approachDuration = 4200 * clamp(approachDistance / scrollDistance);
  const exitDistance = endY - approachEndY;
  const exitDuration = Math.max(300, 780 * clamp(exitDistance / stage.offsetHeight));
  const duration = approachDuration + exitDuration;
  const startTime = performance.now();
  const advance = now => {
    const elapsed = now - startTime;
    const top = elapsed < approachDuration
      ? startY + approachDistance * smooth(clamp(elapsed / approachDuration))
      : approachEndY + exitDistance * smooth(clamp((elapsed - approachDuration) / exitDuration));
    window.scrollTo({ top, behavior: 'instant' });
    queueRender();
    if (elapsed < duration) {
      walkFrame = requestAnimationFrame(advance);
    } else {
      walkFrame = 0;
      playDoorOnApproach = false;
      readerHeading.focus({ preventScroll: true });
    }
  };
  walkFrame = requestAnimationFrame(advance);
});

window.addEventListener('scroll', queueRender, { passive: true });
window.addEventListener('resize', queueRender);
window.addEventListener('wheel', stopWalk, { passive: true });
window.addEventListener('touchstart', stopWalk, { passive: true });
window.addEventListener('keydown', event => {
  if (['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) stopWalk();
});
reducedMotion.addEventListener('change', () => {
  stopWalk();
  queueRender();
});
queueRender();
