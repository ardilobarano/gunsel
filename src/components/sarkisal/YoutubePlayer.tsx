"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";

interface YTPlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, number>;
  events?: { onReady?: () => void };
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface YoutubePlayerProps {
  videoId?: string;
  maxSeconds: number;
  disabled?: boolean;
}

export default function YoutubePlayer({ videoId, maxSeconds, disabled }: YoutubePlayerProps) {
  const containerId = `yt-player-${useId()}`;
  const playerRef = useRef<YTPlayer | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickLockRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    loadYoutubeApi().then(() => {
      if (cancelled) return;
      playerRef.current = new window.YT!.Player(containerId, {
        videoId,
        width: "160",
        height: "90",
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
        events: { onReady: () => !cancelled && setReady(true) },
      });
    });

    return () => {
      cancelled = true;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
      setIsPlaying(false);
    };
  }, [videoId, containerId]);

  function handlePlay() {
    // isPlaying state'i butonu devre dışı bırakana kadar React'in render alması gereken
    // an var — hızlı art arda tıklamada aynı anda birden fazla playVideo/timer tetiklenmesin
    // diye senkron bir kilit (ref, state değil — render'ı beklemiyor).
    if (clickLockRef.current) return;
    const player = playerRef.current;
    if (!player || disabled || !ready) return;

    clickLockRef.current = true;
    setTimeout(() => {
      clickLockRef.current = false;
    }, 500);

    player.seekTo(0, true);
    player.playVideo();
    setIsPlaying(true);

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      player.pauseVideo();
      setIsPlaying(false);
    }, maxSeconds * 1000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[90px] w-[160px] overflow-hidden rounded-lg bg-card">
        <div id={containerId} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background">
          <Music2 className="h-8 w-8 text-text-muted" />
        </div>
      </div>

      <p className="text-xs text-text-muted">YouTube&apos;dan çalınıyor</p>

      <button
        type="button"
        onClick={handlePlay}
        disabled={disabled || !ready || isPlaying}
        aria-label="Çal"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green text-black transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
      </button>
    </div>
  );
}
