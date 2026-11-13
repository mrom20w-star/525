// Audio engine for exact VF-Cash notification chime + iOS DTMF keypad & keyboard clicks

let audioCtx: AudioContext | null = null;
let notificationAudio: HTMLAudioElement | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  getAudioContext();
  if (!notificationAudio) {
    notificationAudio = new Audio('/sounds/notification.mp3');
    notificationAudio.preload = 'auto';
  }
  if (!isAudioUnlocked && notificationAudio) {
    isAudioUnlocked = true;
    const prevVol = notificationAudio.volume;
    notificationAudio.volume = 0;
    const playPromise = notificationAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (notificationAudio) {
            notificationAudio.pause();
            notificationAudio.currentTime = 0;
            notificationAudio.volume = prevVol || 1;
          }
        })
        .catch(() => {
          if (notificationAudio) {
            notificationAudio.volume = 1;
          }
          isAudioUnlocked = false;
        });
    }
  }
}

export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;

  try {
    if (!notificationAudio) {
      notificationAudio = new Audio('/sounds/notification.mp3');
      notificationAudio.preload = 'auto';
    }
    notificationAudio.currentTime = 0;
    notificationAudio.volume = 1;
    const p = notificationAudio.play();
    if (p !== undefined) {
      p.catch(() => {
        playFallbackNotificationTone();
      });
    }
  } catch {
    playFallbackNotificationTone();
  }
}

// Fallback synthesized iOS "Note" chime if MP3 playback is blocked
function playFallbackNotificationTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(1174.66, now); // D6
  osc2.frequency.setValueAtTime(2349.32, now); // D7 harmonic

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.2);
  osc2.stop(now + 1.2);
}

const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '+': [941, 1336],
  '#': [941, 1477],
};

export function playDtmfTone(key: string): void {
  const freqs = DTMF_FREQS[key];
  if (!freqs) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freqs[0], now);
    osc2.frequency.setValueAtTime(freqs[1], now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
    gain.gain.setValueAtTime(0.08, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.14);
    osc2.stop(now + 0.14);
  } catch {
    // Ignore audio errors
  }
}

export function playKeyClick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.018);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  } catch {
    // Ignore audio errors
  }
}
