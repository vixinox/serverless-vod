"use client";

import '@vidstack/react/player/styles/default/theme.css';
import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, Gesture } from '@vidstack/react';
import { Pause, Play } from 'lucide-react';
import { YoutubeControls } from './player-controls';

export function VideoPlayer({ src, thumbnail }: { src: string; thumbnail?: string | undefined }) {
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
  const [isFlashExiting, setIsFlashExiting] = useState(false);
  const flashExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlashIcon = (type: 'play' | 'pause') => {
    if (flashExitTimerRef.current) {
      clearTimeout(flashExitTimerRef.current);
      flashExitTimerRef.current = null;
    }

    if (flashCleanupTimerRef.current) {
      clearTimeout(flashCleanupTimerRef.current);
      flashCleanupTimerRef.current = null;
    }

    setIsFlashExiting(false);
    setFlashIcon(type);

    // Keep icon visible for a short hold, then fade out to match YouTube-like feedback.
    flashExitTimerRef.current = setTimeout(() => {
      setIsFlashExiting(true);
      flashExitTimerRef.current = null;
    }, 720);

    flashCleanupTimerRef.current = setTimeout(() => {
      setFlashIcon(null);
      setIsFlashExiting(false);
      flashCleanupTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (flashExitTimerRef.current) {
        clearTimeout(flashExitTimerRef.current);
      }

      if (flashCleanupTimerRef.current) {
        clearTimeout(flashCleanupTimerRef.current);
      }
    };
  }, []);

  if (!src) {
    return (
      <div className="w-full aspect-video rounded-xl bg-black flex items-center justify-center text-white">
        暂无可播放内容
      </div>
    );
  }

  return (
    <MediaPlayer
      title="Video Player"
      src={src}
      poster={thumbnail}
      aspectRatio="16 / 9"
      playsInline
      onPlay={() => triggerFlashIcon('play')}
      onPause={() => triggerFlashIcon('pause')}
      className="group/player relative w-full aspect-video overflow-hidden rounded-lg bg-black text-white ring-media-focus data-focus:ring-4 sm:rounded-xl"
    >
      <MediaProvider />

      {flashIcon && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            className={`rounded-full bg-black/65 p-4 backdrop-blur-sm transition-all duration-300 ${isFlashExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          >
            {flashIcon === 'play' ? (
              <Play className="size-10 fill-white text-white" />
            ) : (
              <Pause className="size-10 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* Click to play / pause (all zones) */}
      <Gesture className="absolute left-0 top-0 z-10 block h-full w-1/5" event="pointerup" action="toggle:paused" />
      <Gesture className="absolute left-1/5 top-0 z-10 block h-full w-3/5" event="pointerup" action="toggle:paused" />
      <Gesture className="absolute right-0 top-0 z-10 block h-full w-1/5" event="pointerup" action="toggle:paused" />
      {/* Double-click side zones to seek */}
      <Gesture className="absolute left-0 top-0 z-20 block h-full w-1/5" event="dblpointerup" action="seek:-10" />
      <Gesture className="absolute right-0 top-0 z-20 block h-full w-1/5" event="dblpointerup" action="seek:10" />
      {/* Double-click center to toggle fullscreen */}
      <Gesture className="absolute left-1/5 top-0 z-20 block h-full w-3/5" event="dblpointerup" action="toggle:fullscreen" />

      <YoutubeControls />
    </MediaPlayer>
  );
}