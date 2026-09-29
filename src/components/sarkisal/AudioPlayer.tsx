"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface AudioPlayerProps {
  src?: string;
  maxSeconds: number;
  disabled?: boolean;
  /** Çalarken her karede geçen saniyeyi bildirir (video/audio player'daki gibi
   * gerçek zamanlı ilerleyen bir çubuk çizmek için) — durunca 0 ile çağrılır. */
  onProgress?: (seconds: number) => void;
}

export interface AudioPlayerHandle {
  /** Tahmin gönderilince (sunucu cevabı beklenmeden) çalan sesi hemen durdurur VE
   * pozisyonu sıfırlar — yeni deneme/aşama baştan dinlenir. Pas geç bunu ÇAĞIRMAZ,
   * bkz. SarkisalGame.tsx: skip sırasında ses kesilmeden devam etmesi isteniyor. */
  stop: () => void;
}

// Native <audio> elementinin currentTime/pause() zamanlaması JS event loop'una
// bağlı olduğu için 0.2sn gibi çok kısa klipler her basışta farklı uzunlukta
// kesiliyordu (Kelimesel'in ses efektlerinde yaşanan aynı gecikme sorunu — bkz.
// src/lib/sound.ts). Web Audio API'de dosya baştan tamamen decode edilip
// AudioBufferSourceNode.start(0, 0, maxSeconds) ile çalınıyor: kesme noktası JS'in
// pause() çağırmasına değil, ses motorunun kendi sample-doğru saatine bağlı oluyor.
/**
 * iOS'ta yandaki fiziksel sessize alma anahtarı açıkken Web Audio sesi DUYULMUYOR
 * (HTML <audio> elementleri duyuluyor ama Şarkısal bilerek Web Audio kullanıyor —
 * yukarıdaki nota bkz, kısa kliplerin kesme hassasiyeti buna bağlı).
 *
 * Safari 16.4 ile gelen Audio Session API'de kategori "playback" yapılınca ses
 * "içerik oynatma" sayılıyor ve sessiz moddan etkilenmiyor — yani klip kesme
 * hassasiyetinden ödün vermeden sessizdeyken de çalıyor. Desteklemeyen
 * tarayıcılarda (Android/masaüstü ve eski iOS) alan hiç bulunmuyor, sessizce
 * atlanıyor; oralarda zaten böyle bir kısıt yok.
 */
interface AudioSessionNavigator extends Navigator {
  audioSession?: { type: string };
}

function preferPlaybackAudioSession(): void {
  const nav = navigator as AudioSessionNavigator;
  if (nav.audioSession) nav.audioSession.type = "playback";
}

let audioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioContext) {
    preferPlaybackAudioSession();
    audioContext = new AudioContext();
  }
  return audioContext;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();
function loadBuffer(src: string): Promise<AudioBuffer> {
  let promise = bufferCache.get(src);
  if (!promise) {
    promise = fetch(src)
      .then((res) => res.arrayBuffer())
      .then((data) => getAudioContext().decodeAudioData(data));
    bufferCache.set(src, promise);
  }
  return promise;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { src, maxSeconds, disabled, onProgress },
  ref
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Şu an çalan (ya da en son duraklatılan) segmentin muhasebesi — Pas Geç ile
  // maxSeconds büyüyünce aynı düğümün durma zamanını yeniden programlayıp kesintisiz
  // devam ettirmek, ya da kullanıcı elle duraklatıp geri döndüğünde kaldığı yerden
  // başlatmak için gerekiyor.
  const elapsedRef = useRef(0);
  const startedAtRef = useRef(0);
  const fromOffsetRef = useRef(0);
  const maxSecondsRef = useRef(maxSeconds);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      sourceRef.current?.stop();
    };
  }, []);

  // Pas Geç ile bir sonraki (daha uzun) aşamaya geçilince maxSeconds artıyor —
  // o an çalmakta olan düğümü durdurup yeniden başlatmak yerine, zaten çalmakta
  // olan düğümün planlı durma zamanını (ve fade-out'unu) yeni süreye göre
  // yeniden programlıyoruz: ses hiç kesilmeden, aynı akış olarak devam ediyor.
  useEffect(() => {
    const previous = maxSecondsRef.current;
    maxSecondsRef.current = maxSeconds;
    if (!isPlaying || maxSeconds === previous || !sourceRef.current || !gainRef.current) return;

    const ctx = getAudioContext();
    const newRemaining = maxSeconds - fromOffsetRef.current;
    const newStopAt = startedAtRef.current + newRemaining;

    gainRef.current.gain.cancelScheduledValues(ctx.currentTime);
    gainRef.current.gain.setValueAtTime(1, ctx.currentTime);
    const fade = Math.min(0.03, newRemaining / 3);
    if (fade > 0 && newStopAt - fade > ctx.currentTime) {
      gainRef.current.gain.setValueAtTime(1, newStopAt - fade);
      gainRef.current.gain.linearRampToValueAtTime(0, newStopAt);
    }

    try {
      sourceRef.current.stop(newStopAt);
    } catch {
      // Düğüm zaten durmuşsa (nadiren, tam bu anda doğal bitişle çakışırsa) yoksay.
    }
  }, [maxSeconds, isPlaying]);

  function handlePlay() {
    if (disabled || !src || isPlaying) return;
    setIsPlaying(true);

    loadBuffer(src).then(
      (buffer) => {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") void ctx.resume();

        const fromOffset = elapsedRef.current;
        const remaining = maxSecondsRef.current - fromOffset;

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // duration parametresi süre dolunca sesi dalga formunun ortasında aniden
        // kesiyor — özellikle uzun klip lerde duyulabilir bir "cırt/pop" sesine yol
        // açıyordu. Kısa bir gain fade-out (AudioParam otomasyonu, yine sample-doğru)
        // bu tık sesini gideriyor.
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        sourceRef.current = source;
        gainRef.current = gain;

        const startedAt = ctx.currentTime;
        startedAtRef.current = startedAt;
        fromOffsetRef.current = fromOffset;

        const fade = Math.min(0.03, remaining / 3);
        gain.gain.setValueAtTime(1, startedAt);
        if (fade > 0) {
          gain.gain.setValueAtTime(1, startedAt + remaining - fade);
          gain.gain.linearRampToValueAtTime(0, startedAt + remaining);
        }

        // AudioBufferSourceNode gerçek pause/resume desteklemiyor (bir kez stop
        // edilince o node bir daha kullanılamıyor) — bu yüzden her Çal'da buffer'ın
        // fromOffset noktasından itibaren YENİ bir source başlatıyoruz; "duraklatma"
        // aslında elapsedRef'i koruyup bir sonrakinde oradan yeniden başlatmak. Süre
        // limiti start()'a sabit verilmiyor, ayrı bir stop() çağrısıyla planlanıyor —
        // bu, Pas Geç sonrası yukarıdaki efektte yeniden programlanabilmesini sağlıyor.
        source.start(startedAt, fromOffset);
        source.stop(startedAt + remaining);

        function tick() {
          const elapsed = fromOffsetRef.current + (ctx.currentTime - startedAtRef.current);
          if (elapsed >= maxSecondsRef.current) {
            sourceRef.current = null;
            gainRef.current = null;
            elapsedRef.current = 0;
            setIsPlaying(false);
            onProgress?.(0);
            return;
          }
          elapsedRef.current = elapsed;
          onProgress?.(elapsed);
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      },
      () => setIsPlaying(false)
    );
  }

  function stopSource(resetPosition: boolean) {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.stop();
    } catch {
      // Süre dolup kendiliğinden bittiyse tekrar stop() çağırmak hata fırlatır — yoksay.
    }
    sourceRef.current = null;
    gainRef.current = null;
    setIsPlaying(false);
    if (resetPosition) {
      elapsedRef.current = 0;
      onProgress?.(0);
    }
  }

  function handleToggle() {
    if (isPlaying) {
      stopSource(false); // kullanıcı elle duraklattı — pozisyonu koru, sonra oradan devam etsin
    } else {
      handlePlay();
    }
  }

  useImperativeHandle(ref, () => ({ stop: () => stopSource(true) }));

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || !src}
        aria-label={isPlaying ? "Durdur" : "Çal"}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green text-black transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
      </button>
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
