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

import { ReactNode, useState } from 'react';

const ICON_CLS = 'size-9 shrink-0';
const CONTROL_BTN_CLS =
  'group relative flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full bg-black/30 outline-none';
const INLINE_ICON_BTN_CLS =
  'group relative inline-flex h-full w-fit aspect-square cursor-pointer select-none items-center justify-center rounded-full outline-none';
const CONTROL_SURFACE_CLS =
  'pointer-events-none absolute inset-[10%] rounded-full bg-transparent transition duration-150 group-hover:bg-white/15';
const TIME_PILL_CLS =
  'group relative inline-flex h-10 w-fit select-none items-center rounded-full bg-black/30 p-1 text-sm font-medium text-white/90 tabular-nums';
const TIME_PILL_INNER_CLS =
  'inline-flex h-full items-center gap-0.5 rounded-full px-2 transition duration-150 group-hover:bg-white/15';
const VOLUME_CONTROL_CLS =
  'group/volume relative inline-flex h-10 select-none items-center rounded-full bg-black/30 p-1 gap-2 overflow-hidden transition-[width] duration-200 ease-out';

type ControlSurfaceProps = {
  children: ReactNode;
  innerClassName?: string;
};

function ControlSurface({ children, innerClassName }: ControlSurfaceProps) {
  return (
    <>
      <span className={CONTROL_SURFACE_CLS} />
      <span
        className={`relative z-10 inline-flex h-full w-full items-center justify-center ${innerClassName ?? ''}`}
      >
        {children}
      </span>
    </>
  );
}

// ─────────────────────────────────────────────
//  Left-side buttons
// ─────────────────────────────────────────────

function PlayBtn({ compact = false }: { compact?: boolean }) {
  const controlBtnCls = compact
    ? 'group relative flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-full bg-black/30 outline-none'
    : CONTROL_BTN_CLS;
  const iconCls = compact ? 'size-7 shrink-0' : ICON_CLS;

  return (
    <PlayButton className={controlBtnCls}>
      <ControlSurface>
        <PlayIcon className={`${iconCls} hidden group-data-paused:block`} />
        <PauseIcon className={`${iconCls} group-data-paused:hidden`} />
      </ControlSurface>
    </PlayButton>
  );
}

function VolumeBtn({ compact = false }: { compact?: boolean }) {
  const iconCls = compact ? 'size-7 shrink-0' : ICON_CLS;

  return (
    <MuteButton className={INLINE_ICON_BTN_CLS}>
      <MuteIcon className={`${iconCls} hidden group-data-muted:block`} />
      <VolumeLowIcon
        className={`${iconCls} hidden group-data-[state='low']:block group-data-muted:hidden`}
      />
      <VolumeHighIcon
        className={`${iconCls} group-data-muted:hidden group-data-[state='low']:hidden`}
      />
    </MuteButton>
  );
}

// ─────────────────────────────────────────────
//  Right pill helpers
// ─────────────────────────────────────────────

function FullscreenBtn({ compact = false }: { compact?: boolean }) {
  const controlBtnCls = compact
    ? 'group relative flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-full bg-black/30 outline-none'
    : CONTROL_BTN_CLS;
  const iconCls = compact ? 'size-7 shrink-0' : ICON_CLS;

  return (
    <FullscreenButton className={`${controlBtnCls} w-fit bg-transparent group/fullscreen`}>
      <div className='h-full w-full px-2 inline-flex rounded-full group-hover/fullscreen:bg-white/15 transition duration-150 p-0.5'>
        <FullscreenIcon className={`${iconCls} group-data-active:hidden`} />
        <FullscreenExitIcon className={`${iconCls} hidden group-data-active:block`} />
      </div>
    </FullscreenButton>
  );
}

function TimeDisplay({ compact = false }: { compact?: boolean }) {
  const timePillCls = compact
    ? 'group relative inline-flex h-8 w-fit select-none items-center rounded-full bg-black/30 p-1 text-xs font-medium text-white/90 tabular-nums'
    : TIME_PILL_CLS;

  return (
    <div className={timePillCls}>
      <div className={TIME_PILL_INNER_CLS}>
        <Time type="current" />
        <span className="text-white/50">/</span>
        <Time type="duration" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Seek / progress slider (full width row)
// ─────────────────────────────────────────────

function ProgressBar({ compact = false }: { compact?: boolean }) {
  const rootCls = compact
    ? 'group/slider peer relative mx-2 flex h-4 w-full cursor-pointer touch-none select-none items-center outline-none'
    : 'group/slider peer relative mx-3 flex h-5 w-full cursor-pointer touch-none select-none items-center outline-none';
  const trackCls = compact
    ? 'relative h-0.5 w-full rounded-full bg-white/15 transition-[height] duration-150 group-hover/slider:h-1 ring-sky-400 group-data-focus/slider:ring-[3px]'
    : 'relative h-0.75 w-full rounded-full bg-white/15 transition-[height] duration-150 group-hover/slider:h-1.5 ring-sky-400 group-data-focus/slider:ring-[3px]';
  const thumbCls = compact
    ? 'absolute top-1/2 left-(--slider-fill) h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0033] opacity-0 shadow ring-2 ring-white transition-opacity group-hover/slider:opacity-100 group-data-active/slider:opacity-100 will-change-[left]'
    : 'absolute top-1/2 left-(--slider-fill) h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0033] opacity-0 shadow ring-2 ring-white transition-opacity group-hover/slider:opacity-100 group-data-active/slider:opacity-100 will-change-[left]';

  return (
    <TimeSlider.Root className={rootCls}>
      {/* Track */}
      <TimeSlider.Track className={trackCls}>
        <TimeSlider.Progress className="absolute top-0 left-0 h-full w-(--slider-progress) rounded-full bg-white/35 will-change-[width]" />
        <TimeSlider.TrackFill className="absolute top-0 left-0 h-full w-(--slider-fill) rounded-full bg-[#ff0033] will-change-[width]" />
      </TimeSlider.Track>

      {/* Thumb */}
      <TimeSlider.Thumb className={thumbCls} />

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

function InlineVolumeSlider({ expanded, compact = false }: { expanded: boolean; compact?: boolean }) {
  const expandedCls = compact ? 'ml-1 w-16 opacity-100' : 'ml-1 w-20 opacity-100';

  return (
    <VolumeSlider.Root
      className={`group/vslider relative flex h-full cursor-pointer touch-none select-none items-center outline-none transition-[width,opacity,margin] duration-200 ease-out ${expanded ? expandedCls : 'ml-0 w-0 opacity-0'}`}
    >
      <VolumeSlider.Track className="relative h-0.75 w-full rounded-full bg-white/15">
        <VolumeSlider.TrackFill className="absolute top-0 left-0 h-full w-(--slider-fill) rounded-full bg-white will-change-[width]" />
      </VolumeSlider.Track>
      <VolumeSlider.Thumb className="absolute top-1/2 left-(--slider-fill) h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow will-change-[left]" />
    </VolumeSlider.Root>
  );
}

function VolumeControl({ expanded, onExpand, compact = false }: { expanded: boolean; onExpand: () => void; compact?: boolean }) {
  const rootWidthCls = compact ? (expanded ? 'w-28' : 'w-8') : (expanded ? 'w-36' : 'w-10');
  const rootHeightCls = compact ? 'h-8' : 'h-10';

  return (
    <div
      className={`${VOLUME_CONTROL_CLS} ${rootHeightCls} ${rootWidthCls}`}
      onPointerEnter={onExpand}
    >
      <div className='h-full w-full inline-flex rounded-full group-hover/volume:bg-white/15 transition duration-150'>
        <VolumeBtn compact={compact} />
        <InlineVolumeSlider expanded={expanded} compact={compact} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main exported layout
// ─────────────────────────────────────────────

export function YoutubeControls({ compact = false }: { compact?: boolean }) {
  const [isVolumeExpanded, setIsVolumeExpanded] = useState(false);
  const controlsPadding = compact ? 'px-2 pb-1.5' : 'px-3 pb-2';
  const controlsGap = compact ? 'gap-2.5' : 'gap-4';

  return (
    <Controls.Root
      className="pointer-events-none absolute inset-0 z-30 flex h-full w-full flex-col justify-end opacity-0 transition-opacity duration-300 group-hover/player:pointer-events-auto group-hover/player:opacity-100"
      onPointerLeave={() => setIsVolumeExpanded(false)}
    >
      <Controls.Group className="pointer-events-auto relative flex w-full items-center">
        <ProgressBar compact={compact} />
      </Controls.Group>

      <Controls.Group className={`pointer-events-auto relative flex w-full items-center justify-between ${controlsPadding}`}>
        <div className={`flex items-center ${controlsGap}`}>
          <PlayBtn compact={compact} />

          <VolumeControl expanded={isVolumeExpanded} onExpand={() => setIsVolumeExpanded(true)} compact={compact} />

          <TimeDisplay compact={compact} />
        </div>

        <div className="flex items-center rounded-full bg-black/35">
          <FullscreenBtn compact={compact} />
        </div>
      </Controls.Group>
    </Controls.Root>
  );
}
