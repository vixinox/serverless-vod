'use client';

import {
  Controls,
  FullscreenButton,
  MuteButton,
  PlayButton,
  Time,
  TimeSlider,
  VolumeSlider,
} from '@vidstack/react';
import {
  FullscreenExitIcon,
  FullscreenIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
} from '@vidstack/react/icons';

import { PlayerBtnOverlay, playerBtnCls } from './player-button';

// ─────────────────────────────────────────────
//  Shared icon size — adjust to taste
// ─────────────────────────────────────────────
const ICON_CLS = 'relative z-10 w-[18px] h-[18px]';

// ─────────────────────────────────────────────
//  Left-side button helpers
// ─────────────────────────────────────────────

function PlayBtn() {
  return (
    <PlayButton className={playerBtnCls}>
      <PlayerBtnOverlay />
      <PlayIcon className={`${ICON_CLS} hidden group-data-paused:block`} />
      <PauseIcon className={`${ICON_CLS} group-data-paused:hidden`} />
    </PlayButton>
  );
}

function VolumeBtn() {
  return (
    <MuteButton className={playerBtnCls}>
      <PlayerBtnOverlay />
      {/* show low-volume icon when muted or low volume */}
      <MuteIcon className={`${ICON_CLS} hidden group-data-muted:block`} />
      <VolumeLowIcon
        className={`${ICON_CLS} hidden group-data-[state='low']:block group-data-muted:hidden`}
      />
      <VolumeHighIcon
        className={`${ICON_CLS} group-data-muted:hidden group-data-[state='low']:hidden`}
      />
    </MuteButton>
  );
}

// ─────────────────────────────────────────────
//  Right pill helpers  (no gap between items)
// ─────────────────────────────────────────────

/** Inner button for use *inside* the right pill — no outer bg ring, inherit
 *  the pill background; only the inner overlay reacts on hover. */
const pillBtnCls =
  'group relative inline-flex items-center justify-center w-10 h-10 cursor-pointer select-none outline-none';

function FullscreenBtn() {
  return (
    <FullscreenButton className={pillBtnCls}>
      <PlayerBtnOverlay />
      <FullscreenIcon className={`${ICON_CLS} group-data-active:hidden`} />
      <FullscreenExitIcon className={`${ICON_CLS} hidden group-data-active:block`} />
    </FullscreenButton>
  );
}

// ─────────────────────────────────────────────
//  Seek / progress slider (full width row)
// ─────────────────────────────────────────────

function ProgressBar() {
  return (
    <TimeSlider.Root className="group/slider peer relative mx-3 flex h-5 w-full cursor-pointer touch-none select-none items-center outline-none">
      {/* Track */}
      <TimeSlider.Track className="relative h-1 w-full rounded-full bg-white/30 ring-sky-400 group-data-focus/slider:ring-[3px]">
        <TimeSlider.TrackFill className="absolute h-full rounded-full bg-white will-change-[width]" />
        <TimeSlider.Progress className="absolute h-full rounded-full bg-white/50 will-change-[width]" />
      </TimeSlider.Track>

      {/* Thumb */}
      <TimeSlider.Thumb className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 shadow ring-white/40 transition-opacity group-hover/slider:opacity-100 group-data-active/slider:opacity-100 will-change-[left]" />

      {/* Hover preview time */}
      <TimeSlider.Preview className="flex flex-col items-center opacity-0 transition-opacity duration-200 data-visible:opacity-100">
        <TimeSlider.Value className="rounded bg-black/70 px-1.5 py-0.5 text-xs text-white" />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}

// ─────────────────────────────────────────────
//  Volume slider (appears inline next to mute btn)
// ─────────────────────────────────────────────

function InlineVolumeSlider() {
  return (
    <VolumeSlider.Root className="group/vslider relative flex h-10 w-0 max-w-20 cursor-pointer touch-none select-none items-center overflow-hidden outline-none transition-[width] duration-200 hover:w-20 peer-hover:w-20">
      <VolumeSlider.Track className="relative h-0.75 w-full rounded-full bg-white/30">
        <VolumeSlider.TrackFill className="absolute h-full rounded-full bg-white will-change-[width]" />
      </VolumeSlider.Track>
      <VolumeSlider.Thumb className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow will-change-[left]" />
    </VolumeSlider.Root>
  );
}

// ─────────────────────────────────────────────
//  Main exported layout
// ─────────────────────────────────────────────

export function YoutubeControls() {
  return (
    <Controls.Root className="pointer-events-none absolute inset-0 z-10 flex h-full w-full flex-col justify-end opacity-0 transition-opacity duration-300 media-controls:opacity-100">
      {/* Bottom gradient */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-linear-to-t from-black/70 to-transparent" />

      {/* Progress bar row */}
      <Controls.Group className="pointer-events-auto relative flex w-full items-center pb-1">
        <ProgressBar />
      </Controls.Group>

      {/* Bottom controls row */}
      <Controls.Group className="pointer-events-auto relative flex w-full items-center justify-between px-3 pb-3">
        {/* ── Left cluster: play  volume  time ── */}
        <div className="flex items-center gap-3">
          <PlayBtn />

          {/* Volume: mute button + hover-revealed slider */}
          <div className="peer group relative flex items-center">
            <VolumeBtn />
            <InlineVolumeSlider />
          </div>

          {/* Time display */}
          <div className="flex select-none items-center gap-1 text-sm font-medium text-white/90 tabular-nums">
            <Time type="current" />
            <span className="text-white/50">/</span>
            <Time type="duration" />
          </div>
        </div>

        {/* ── Right cluster: pill containing remaining buttons ── */}
        <div className="flex items-center rounded-full bg-white/15">
          <FullscreenBtn />
        </div>
      </Controls.Group>
    </Controls.Root>
  );
}
