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

function PlayBtn() {
  return (
    <PlayButton className={CONTROL_BTN_CLS}>
      <ControlSurface>
        <PlayIcon className={`${ICON_CLS} hidden group-data-paused:block`} />
        <PauseIcon className={`${ICON_CLS} group-data-paused:hidden`} />
      </ControlSurface>
    </PlayButton>
  );
}

function VolumeBtn() {
  return (
    <MuteButton className={INLINE_ICON_BTN_CLS}>
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
//  Right pill helpers
// ─────────────────────────────────────────────

function FullscreenBtn() {
  return (
    <FullscreenButton className={`${CONTROL_BTN_CLS} w-fit bg-transparent group/fullscreen`}>
      <div className='h-full w-full px-2 inline-flex rounded-full group-hover/fullscreen:bg-white/15 transition duration-150 p-0.5'>
        <FullscreenIcon className={`${ICON_CLS} group-data-active:hidden`} />
        <FullscreenExitIcon className={`${ICON_CLS} hidden group-data-active:block`} />
      </div>
    </FullscreenButton>
  );
}

function TimeDisplay() {
  return (
    <div className={TIME_PILL_CLS}>
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

function ProgressBar() {
  return (
    <TimeSlider.Root className="group/slider peer relative mx-3 flex h-5 w-full cursor-pointer touch-none select-none items-center outline-none">
      {/* Track */}
      <TimeSlider.Track className="relative h-0.75 w-full rounded-full bg-white/15 transition-[height] duration-150 group-hover/slider:h-1.5 ring-sky-400 group-data-focus/slider:ring-[3px]">
        <TimeSlider.Progress className="absolute top-0 left-0 h-full w-(--slider-progress) rounded-full bg-white/35 will-change-[width]" />
        <TimeSlider.TrackFill className="absolute top-0 left-0 h-full w-(--slider-fill) rounded-full bg-[#ff0033] will-change-[width]" />
      </TimeSlider.Track>

      {/* Thumb */}
      <TimeSlider.Thumb className="absolute top-1/2 left-(--slider-fill) h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0033] opacity-0 shadow ring-2 ring-white transition-opacity group-hover/slider:opacity-100 group-data-active/slider:opacity-100 will-change-[left]" />

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

function InlineVolumeSlider({ expanded }: { expanded: boolean }) {
  return (
    <VolumeSlider.Root
      className={`group/vslider relative flex h-full cursor-pointer touch-none select-none items-center outline-none transition-[width,opacity,margin] duration-200 ease-out ${expanded ? 'ml-1 w-20 opacity-100' : 'ml-0 w-0 opacity-0'}`}
    >
      <VolumeSlider.Track className="relative h-0.75 w-full rounded-full bg-white/15">
        <VolumeSlider.TrackFill className="absolute top-0 left-0 h-full w-(--slider-fill) rounded-full bg-white will-change-[width]" />
      </VolumeSlider.Track>
      <VolumeSlider.Thumb className="absolute top-1/2 left-(--slider-fill) h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow will-change-[left]" />
    </VolumeSlider.Root>
  );
}

function VolumeControl({ expanded, onExpand }: { expanded: boolean; onExpand: () => void }) {
  return (
    <div
      className={`${VOLUME_CONTROL_CLS} ${expanded ? 'w-36' : 'w-10'}`}
      onPointerEnter={onExpand}
    >
      <div className='h-full w-full inline-flex rounded-full group-hover/volume:bg-white/15 transition duration-150'>
        <VolumeBtn />
        <InlineVolumeSlider expanded={expanded} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main exported layout
// ─────────────────────────────────────────────

export function YoutubeControls() {
  const [isVolumeExpanded, setIsVolumeExpanded] = useState(false);

  return (
    <Controls.Root
      className="pointer-events-none absolute inset-0 z-30 flex h-full w-full flex-col justify-end opacity-0 transition-opacity duration-300 group-hover/player:pointer-events-auto group-hover/player:opacity-100"
      onPointerLeave={() => setIsVolumeExpanded(false)}
    >
      <Controls.Group className="pointer-events-auto relative flex w-full items-center">
        <ProgressBar />
      </Controls.Group>

      <Controls.Group className="pointer-events-auto relative flex w-full items-center justify-between px-3 pb-2">
        <div className="flex items-center gap-4">
          <PlayBtn />

          <VolumeControl expanded={isVolumeExpanded} onExpand={() => setIsVolumeExpanded(true)} />

          <TimeDisplay />
        </div>

        <div className="flex items-center rounded-full bg-black/35">
          <FullscreenBtn />
        </div>
      </Controls.Group>
    </Controls.Root>
  );
}
