"use client";

const SOUND_URLS = {
  keyTap: "/sounds/key-tap.mp3",
  revealFlip: "/sounds/reveal-flip.mp3",
  modeSwitch: "/sounds/mode-switch.mp3",
} as const;

type SoundName = keyof typeof SOUND_URLS;

let audioContext: AudioContext | null = null;
const bufferCache: Partial<Record<SoundName, AudioBuffer>> = {};
const loadingPromises: Partial<Record<SoundName, Promise<AudioBuffer>>> = {};

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function loadBuffer(name: SoundName): Promise<AudioBuffer> {
  const cached = bufferCache[name];
  if (cached) return Promise.resolve(cached);

  const existing = loadingPromises[name];
  if (existing) return existing;

  const promise = fetch(SOUND_URLS[name])
    .then((res) => res.arrayBuffer())
    .then((data) => getAudioContext().decodeAudioData(data))
    .then((buffer) => {
      bufferCache[name] = buffer;
      return buffer;
    });

  loadingPromises[name] = promise;
  return promise;
}

/** Sesleri sayfa yüklenir yüklenmez indirip çözer (decode) — HTMLAudioElement
 * her çalışta yeniden yükleme/çözme gecikmesi yaşıyordu, bu görsel animasyonla
 * senkronize sesler için fark edilir bir kaymaya yol açıyordu. */
export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  (Object.keys(SOUND_URLS) as SoundName[]).forEach((name) => {
    loadBuffer(name).catch(() => {});
  });
}

/** Web Audio API ile çalar: ses önceden çözülmüş olduğu için start() neredeyse
 * anlık gerçekleşiyor (HTMLAudioElement.play()'deki gecikme yok), ve her çağrı
 * kendi bağımsız node'unu kullandığı için hızlı art arda çalmada hiçbiri
 * diğerini kesmiyor/kaybolmuyor. */
export function playSound(name: SoundName): void {
  if (typeof window === "undefined") return;

  loadBuffer(name)
    .then((buffer) => {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    })
    .catch(() => {
      // Web Audio API kullanılamıyorsa sessizce geç.
    });
}
