"use client";

import '@vidstack/react/player/styles/default/theme.css';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, Gesture, Poster, type MediaPlayerInstance } from '@vidstack/react';
import { Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react';
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
const CONTROLS_IDLE_TIMEOUT_MS = 2200;

type FlashFeedback =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'volume'; level: number; muted: boolean };

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
  const [flashFeedback, setFlashFeedback] = useState<FlashFeedback | null>(null);
  const [showInitialFlashIcon, setShowInitialFlashIcon] = useState(true);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEndedPoster, setShowEndedPoster] = useState(false);
  const flashIconRef = useRef<HTMLDivElement | null>(null);
  const flashTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const playbackSessionIdRef = useRef<string>("");
  const hasRecordedPlayStartRef = useRef(false);
  const progressCheckpointRef = useRef(0);
  const seekStartRef = useRef<number | null>(null);
  const didEndRef = useRef(false);
  const controlsHideTimeoutRef = useRef<number | null>(null);

  // 同一页面会话内复用 sessionId，用于关联播放、暂停、拖动等事件。
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

  // 播放器事件只做轻量上报，失败时静默丢弃，避免统计接口影响用户看视频。
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

  const clearControlsHideTimeout = () => {
    if (controlsHideTimeoutRef.current !== null) {
      window.clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  };

  // 播放时短暂隐藏控制栏；暂停、聚焦或结束时保持可见。
  const scheduleControlsHide = (playing = isPlaying) => {
    if (typeof window === "undefined") {
      return;
    }

    clearControlsHideTimeout();

    if (!playing || didEndRef.current) {
      return;
    }

    controlsHideTimeoutRef.current = window.setTimeout(() => {
      setAreControlsVisible(false);
      controlsHideTimeoutRef.current = null;
    }, CONTROLS_IDLE_TIMEOUT_MS);
  };

  const showControls = (persist = false, playing = isPlaying) => {
    setAreControlsVisible(true);

    if (persist) {
      clearControlsHideTimeout();
      return;
    }

    scheduleControlsHide(playing);
  };

  const hideControlsImmediately = () => {
    clearControlsHideTimeout();
    setAreControlsVisible(false);
  };

  const triggerFlashFeedback = (feedback: FlashFeedback) => {
    setShowInitialFlashIcon(false);
    setFlashFeedback(feedback);
  };

  // 播放、暂停、音量变化时的中心提示仅负责视觉反馈。
  useEffect(() => {
    if (!flashFeedback) {
      return;
    }

    if (!flashIconRef.current) {
      return;
    }

    flashTimelineRef.current?.kill();

    flashTimelineRef.current = gsap.timeline({
      onComplete: () => {
        setFlashFeedback(null);
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
  }, [flashFeedback]);

  // 切换到另一条视频时清空上一条视频的播放状态，避免进度和结束封面串到新视频。
  useEffect(() => {
    clearControlsHideTimeout();
    flashTimelineRef.current?.kill();
    flashTimelineRef.current = null;
    setFlashFeedback(null);
    setShowInitialFlashIcon(true);
    setAreControlsVisible(true);
    setIsPlaying(false);
    setShowEndedPoster(false);
    hasRecordedPlayStartRef.current = false;
    progressCheckpointRef.current = 0;
    seekStartRef.current = null;
    didEndRef.current = false;
  }, [src]);

  useEffect(() => {
    return () => {
      clearControlsHideTimeout();
      flashTimelineRef.current?.kill();
      flashTimelineRef.current = null;
    };
  }, []);

  // 评论时间戳点击后派发该事件，播放器统一处理跳转。
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

  // 按固定间隔上报观看增量，而不是每一帧都写库，兼顾统计可用性和接口压力。
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

  // Vidstack 处理键盘播放逻辑，本组件补充控制栏显示和音量提示。
  const handlePlayerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === " " || event.key === "Spacebar" || event.key === "k" || event.key === "K") {
      showControls(true);
      return;
    }

    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    showControls();

    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const player = playerRef.current;

      if (!player) {
        return;
      }

      const volume = typeof player.volume === "number" && Number.isFinite(player.volume) ? player.volume : 0;
      triggerFlashFeedback({
        type: 'volume',
        level: Math.round((player.muted ? 0 : volume) * 100),
        muted: player.muted || volume === 0,
      });
    });
  };

  const renderCenterFeedback = () => {
    if (showInitialFlashIcon) {
      return (
        <Play
          className={`${compact ? 'size-9' : 'size-14'} text-white transition-colors duration-200 fill-transparent group-hover/player:fill-white`}
        />
      );
    }

    if (!flashFeedback) {
      return null;
    }

    if (flashFeedback.type === 'play') {
      return <Play className={`${compact ? 'size-9' : 'size-14'} fill-white text-white`} />;
    }

    if (flashFeedback.type === 'pause') {
      return <Pause className={`${compact ? 'size-9' : 'size-14'} fill-white text-white`} />;
    }

    const VolumeIcon =
      flashFeedback.muted || flashFeedback.level === 0
        ? VolumeX
        : flashFeedback.level <= 50
          ? Volume1
          : Volume2;

    return (
      <div className={`flex items-center justify-center text-white ${compact ? 'gap-2' : 'gap-3'}`}>
        <VolumeIcon className={compact ? 'size-8' : 'size-11'} />
        <span className={`font-semibold tabular-nums ${compact ? 'text-xl' : 'text-3xl'}`}>
          {flashFeedback.level}%
        </span>
      </div>
    );
  };

  if (!src) {
    return (
      <div className="w-full aspect-video rounded-xl bg-black flex items-center justify-center text-white">
        暂无可播放内容
      </div>
    );
  }

  const isCircularCenterFeedback =
    showInitialFlashIcon || flashFeedback?.type === 'play' || flashFeedback?.type === 'pause';

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
      tabIndex={0}
      onPointerEnter={() => {
        if (didEndRef.current) {
          setAreControlsVisible(true);
          return;
        }

        showControls(!isPlaying);
      }}
      onPointerMove={() => {
        if (!isPlaying || didEndRef.current) {
          return;
        }

        showControls(false, true);
      }}
      onPointerDownCapture={() => {
        showControls(true);
      }}
      onPointerUpCapture={() => {
        showControls();
      }}
      onPointerLeave={() => {
        if (!isPlaying || didEndRef.current) {
          setAreControlsVisible(true);
          return;
        }

        hideControlsImmediately();
      }}
      onFocus={() => {
        showControls(true);
      }}
      onBlur={() => {
        if (!isPlaying || didEndRef.current) {
          setAreControlsVisible(true);
          return;
        }

        scheduleControlsHide();
      }}
      onKeyDownCapture={handlePlayerKeyDown}
      onPlay={() => {
        didEndRef.current = false;
        setIsPlaying(true);
        setShowEndedPoster(false);
        showControls();

        if (!hasRecordedPlayStartRef.current) {
          hasRecordedPlayStartRef.current = true;
          progressCheckpointRef.current = playerRef.current?.currentTime ?? 0;
          submitPlaybackEvent("PLAY_START");
        } else {
          progressCheckpointRef.current = playerRef.current?.currentTime ?? 0;
          submitPlaybackEvent("RESUME");
        }

        // 首次播放后隐藏中心播放提示，后续再显示短暂的播放反馈。
        if (showInitialFlashIcon) {
          setShowInitialFlashIcon(false);
          return;
        }

        triggerFlashFeedback({ type: 'play' });
      }}
      onPause={() => {
        setIsPlaying(false);
        setAreControlsVisible(true);
        clearControlsHideTimeout();

        if (!didEndRef.current) {
          flushProgressEvent();
          submitPlaybackEvent("PAUSE");
        }

        if (showInitialFlashIcon) {
          return;
        }

        setShowInitialFlashIcon(false);
        triggerFlashFeedback({ type: 'pause' });
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
        // 记录拖动前的位置，拖动结束后再判断位移是否足够大，避免普通播放抖动被当成 SEEK。
        if (didEndRef.current) {
          setShowEndedPoster(false);
        }

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
        setIsPlaying(false);
        setAreControlsVisible(true);
        setShowEndedPoster(true);
        clearControlsHideTimeout();
        flashTimelineRef.current?.kill();
        flashTimelineRef.current = null;
        setFlashFeedback(null);
        flushProgressEvent();
        submitPlaybackEvent("ENDED");
      }}
      className={`group/player relative w-full aspect-video overflow-hidden rounded-xl text-white ring-media-focus data-focus:ring-4 ${className}`}
    >
      {/* Vidstack 根据 src 自动处理 HLS 播放；浏览器原生不支持时由库内部接管解码链路。 */}
      <MediaProvider>
        <Poster
          src={thumbnail}
          alt="视频封面"
          className="absolute inset-0 z-0 block h-full w-full bg-black opacity-0 transition-opacity data-visible:opacity-100 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
        />
      </MediaProvider>

      {/* 播放结束后重新展示封面，避免停在最后一帧影响内容观感。 */}
      {thumbnail && (
        <div
          className={`pointer-events-none absolute inset-0 z-20 overflow-hidden bg-black transition-opacity duration-300 ${showEndedPoster ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={!showEndedPoster}
        >
          <img src={thumbnail} alt="视频封面" className="h-full w-full object-cover" />
        </div>
      )}

      {(showInitialFlashIcon || flashFeedback) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            ref={flashIconRef}
            className={`rounded-full backdrop-blur-sm ${
              isCircularCenterFeedback
                ? `flex items-center justify-center ${compact ? 'size-14' : 'size-24'}`
                : compact
                  ? 'px-3 py-2.5'
                  : 'px-5 py-4'
            } ${showInitialFlashIcon ? 'bg-black/55 transition-colors duration-300 group-hover/player:bg-black/70' : 'bg-black/65'}`}
          >
            {renderCenterFeedback()}
          </div>
        </div>
      )}

      {/* 单击任意区域播放或暂停，贴近常见视频平台的操作习惯。 */}
      <Gesture className="absolute left-0 top-0 z-10 block h-full w-1/5" event="pointerup" action="toggle:paused" />
      <Gesture className="absolute left-1/5 top-0 z-10 block h-full w-3/5" event="pointerup" action="toggle:paused" />
      <Gesture className="absolute right-0 top-0 z-10 block h-full w-1/5" event="pointerup" action="toggle:paused" />
      {/* 双击左右两侧快退/快进，中间区域保留给全屏切换。 */}
      <Gesture className="absolute left-0 top-0 z-20 block h-full w-1/5" event="dblpointerup" action="seek:-10" />
      <Gesture className="absolute right-0 top-0 z-20 block h-full w-1/5" event="dblpointerup" action="seek:10" />
      {/* 双击中间切换全屏，避免和左右快进手势冲突。 */}
      <Gesture className="absolute left-1/5 top-0 z-20 block h-full w-3/5" event="dblpointerup" action="toggle:fullscreen" />

      <YoutubeControls compact={compact} visible={areControlsVisible} />
    </MediaPlayer>
  );
}
