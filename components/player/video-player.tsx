"use client";

import '@vidstack/react/player/styles/default/theme.css';
import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, Gesture, Poster, type MediaPlayerInstance } from '@vidstack/react';
import { Pause, Play } from 'lucide-react';
import gsap from 'gsap';
import { YoutubeControls } from './player-controls';
import { apiRequest } from "@/lib/api-client";
import { PLAYER_SEEK_EVENT, type PlayerSeekDetail } from "@/lib/player-timestamps";

type PlaybackEventType =
  | "PLAY_START"
  | "PLAY_PROGRESS"
  | "PAUSE"
  | "RESUME"
  | "SEEK"
  | "ENDED";

const FLASH_FEEDBACK_CONFIG = {
  fromScale: 0.84,
  enterScale: 1,
  exitScale: 0.92,
  enterDuration: 0.16,
  holdDuration: 0.2,
  exitDuration: 0.22,
  ease: 'expo.out',
} as const;

const PROGRESS_EVENT_INTERVAL_SECONDS = 10;

export function VideoPlayer({
  shortCode,
  src,
  thumbnail,
  className,
  compact = false,
}: {
  shortCode?: string;
  src: string;
  thumbnail?: string | undefined;
  className?: string;
  compact?: boolean;
}) {
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
  const [showInitialFlashIcon, setShowInitialFlashIcon] = useState(true);
  const flashIconRef = useRef<HTMLDivElement | null>(null);
  const flashTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const playbackSessionIdRef = useRef<string>("");
  const hasRecordedPlayStartRef = useRef(false);
  const progressCheckpointRef = useRef(0);
  const seekStartRef = useRef<number | null>(null);
  const didEndRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !shortCode) {
      return;
    }

    const storageKey = `vod-playback-session:${shortCode}`;
    const existingSessionId = window.sessionStorage.getItem(storageKey);
    const sessionId = existingSessionId || crypto.randomUUID();

    if (!existingSessionId) {
      window.sessionStorage.setItem(storageKey, sessionId);
    }

    playbackSessionIdRef.current = sessionId;
    hasRecordedPlayStartRef.current = false;
  }, [shortCode]);

  const submitPlaybackEvent = (
    eventType: PlaybackEventType,
    extra?: {
      watchDeltaMs?: number;
    },
  ) => {
    if (!shortCode) {
      return;
    }

    const sessionId = playbackSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    const player = playerRef.current;
    const currentTimeValue = player?.currentTime;
    const durationValue = player?.duration;
    const playbackRateValue = player?.playbackRate;
    const mutedValue = player?.muted;
    const volumeValue = player?.volume;
    const currentTime = typeof currentTimeValue === "number" ? Math.floor(currentTimeValue) : undefined;
    const duration = typeof durationValue === "number" ? Math.floor(durationValue) : undefined;
    const playbackRate =
      typeof playbackRateValue === "number" && Number.isFinite(playbackRateValue)
        ? playbackRateValue
        : undefined;
    const isMuted = typeof mutedValue === "boolean" ? mutedValue : undefined;
    const volume =
      typeof volumeValue === "number" && Number.isFinite(volumeValue)
        ? Math.round(volumeValue * 100)
        : undefined;

    void apiRequest(`/api/videos/${shortCode}/playback-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        eventType,
        positionSeconds: currentTime,
        durationSeconds: duration,
        watchDeltaMs: extra?.watchDeltaMs,
        playbackRate,
        isMuted,
        volume,
      }),
    }).catch(() => undefined);
  };

  const triggerFlashIcon = (type: 'play' | 'pause') => {
    setShowInitialFlashIcon(false);
    setFlashIcon(type);
  };

  useEffect(() => {
    if (!flashIcon) {
      return;
    }

    if (!flashIconRef.current) {
      return;
    }

    flashTimelineRef.current?.kill();

    flashTimelineRef.current = gsap.timeline({
      onComplete: () => {
        setFlashIcon(null);
      },
    });

    flashTimelineRef.current
      .set(flashIconRef.current, {
        opacity: 0,
        scale: FLASH_FEEDBACK_CONFIG.fromScale,
      })
      .to(flashIconRef.current, {
        opacity: 1,
        scale: FLASH_FEEDBACK_CONFIG.enterScale,
        duration: FLASH_FEEDBACK_CONFIG.enterDuration,
        ease: FLASH_FEEDBACK_CONFIG.ease,
      })
      .to(flashIconRef.current, {
        opacity: 0,
        scale: FLASH_FEEDBACK_CONFIG.exitScale,
        duration: FLASH_FEEDBACK_CONFIG.exitDuration,
        ease: FLASH_FEEDBACK_CONFIG.ease,
        delay: FLASH_FEEDBACK_CONFIG.holdDuration,
      });

    return () => {
      flashTimelineRef.current?.kill();
      flashTimelineRef.current = null;
    };
  }, [flashIcon]);

  useEffect(() => {
    flashTimelineRef.current?.kill();
    flashTimelineRef.current = null;
    setFlashIcon(null);
    setShowInitialFlashIcon(true);
    hasRecordedPlayStartRef.current = false;
    progressCheckpointRef.current = 0;
    seekStartRef.current = null;
    didEndRef.current = false;
  }, [src]);

  useEffect(() => {
    return () => {
      flashTimelineRef.current?.kill();
      flashTimelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleSeekRequest = (event: Event) => {
      const customEvent = event as CustomEvent<PlayerSeekDetail>;
      const player = playerRef.current;
      const nextSeconds = customEvent.detail?.seconds;

      if (!player || typeof nextSeconds !== "number" || Number.isNaN(nextSeconds)) {
        return;
      }

      player.currentTime = Math.max(0, nextSeconds);
      progressCheckpointRef.current = Math.max(0, nextSeconds);
    };

    window.addEventListener(PLAYER_SEEK_EVENT, handleSeekRequest as EventListener);

    return () => {
      window.removeEventListener(PLAYER_SEEK_EVENT, handleSeekRequest as EventListener);
    };
  }, []);

  const flushProgressEvent = () => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const currentTime = player.currentTime;

    if (typeof currentTime !== "number" || Number.isNaN(currentTime)) {
      return;
    }

    const watchDeltaSeconds = currentTime - progressCheckpointRef.current;

    if (watchDeltaSeconds < 3) {
      return;
    }

    submitPlaybackEvent("PLAY_PROGRESS", {
      watchDeltaMs: Math.round(watchDeltaSeconds * 1000),
    });
    progressCheckpointRef.current = currentTime;
  };

  if (!src) {
    return (
      <div className="w-full aspect-video rounded-xl bg-black flex items-center justify-center text-white">
        暂无可播放内容
      </div>
    );
  }

  return (
    <MediaPlayer
      ref={playerRef}
      title="Video Player"
      src={src}
      poster={thumbnail}
      logLevel="silent"
      data-transition-keep-visible="video"
      aspectRatio="16 / 9"
      playsInline
      onPlay={() => {
        didEndRef.current = false;

        if (!hasRecordedPlayStartRef.current) {
          hasRecordedPlayStartRef.current = true;
          progressCheckpointRef.current = playerRef.current?.currentTime ?? 0;
          submitPlaybackEvent("PLAY_START");
        } else {
          progressCheckpointRef.current = playerRef.current?.currentTime ?? 0;
          submitPlaybackEvent("RESUME");
        }

        // Initial center play hint should disappear immediately on first play.
        if (showInitialFlashIcon) {
          setShowInitialFlashIcon(false);
          return;
        }

        triggerFlashIcon('play');
      }}
      onPause={() => {
        if (!didEndRef.current) {
          flushProgressEvent();
          submitPlaybackEvent("PAUSE");
        }

        if (showInitialFlashIcon) {
          return;
        }

        setShowInitialFlashIcon(false);
        triggerFlashIcon('pause');
      }}
      onTimeUpdate={() => {
        const currentTime = playerRef.current?.currentTime;

        if (typeof currentTime !== "number" || Number.isNaN(currentTime)) {
          return;
        }

        if (currentTime - progressCheckpointRef.current >= PROGRESS_EVENT_INTERVAL_SECONDS) {
          flushProgressEvent();
        }
      }}
      onSeeking={() => {
        seekStartRef.current = playerRef.current?.currentTime ?? null;
      }}
      onSeeked={() => {
        const currentTime = playerRef.current?.currentTime;
        const seekStart = seekStartRef.current;

        if (
          typeof currentTime === "number" &&
          !Number.isNaN(currentTime) &&
          typeof seekStart === "number" &&
          Math.abs(currentTime - seekStart) >= 2
        ) {
          submitPlaybackEvent("SEEK");
          progressCheckpointRef.current = currentTime;
        }

        seekStartRef.current = null;
      }}
      onEnded={() => {
        didEndRef.current = true;
        flushProgressEvent();
        submitPlaybackEvent("ENDED");
      }}
      className={`group/player relative w-full aspect-video overflow-hidden rounded-xl text-white ring-media-focus data-focus:ring-4 ${className}`}
    >
      <MediaProvider>
        <Poster
          src={thumbnail}
          alt="视频封面"
          className="absolute inset-0 z-0 block h-full w-full bg-black opacity-0 transition-opacity data-visible:opacity-100 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
        />
      </MediaProvider>

      {(showInitialFlashIcon || flashIcon) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            ref={flashIconRef}
            className={`rounded-full backdrop-blur-sm ${compact ? 'p-2.5' : 'p-4'} ${showInitialFlashIcon ? 'bg-black/55 transition-colors duration-300 group-hover/player:bg-black/70' : 'bg-black/65'}`}
          >
            {(showInitialFlashIcon || flashIcon === 'play') ? (
              <Play
                className={`${compact ? 'size-9' : 'size-14'} text-white transition-colors duration-200 ${showInitialFlashIcon ? 'fill-transparent group-hover/player:fill-white' : 'fill-white'}`}
              />
            ) : (
              <Pause className={`${compact ? 'size-9' : 'size-14'} fill-white text-white`} />
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

      <YoutubeControls compact={compact} />
    </MediaPlayer>
  );
}
