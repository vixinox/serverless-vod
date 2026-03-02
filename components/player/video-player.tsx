// Only the base theme is kept; the default video layout CSS is intentionally
// omitted because we render our own YouTube-style controls.
import '@vidstack/react/player/styles/default/theme.css';
import { MediaPlayer, MediaProvider, Gesture } from '@vidstack/react';
import { YoutubeControls } from './youtube-controls';

export function VideoPlayer({ src, thumbnail }: { src: string; thumbnail?: string | undefined }) {
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
      className="w-full aspect-video bg-black text-white font-sans overflow-hidden rounded-md ring-media-focus data-focus:ring-4"
    >
      <MediaProvider />

      {/* Click to play / pause (center tap) */}
      <Gesture className="absolute inset-0 z-0 block h-full w-full" event="pointerup" action="toggle:paused" />
      {/* Double-click to seek */}
      <Gesture className="absolute left-0 top-0 z-10 block h-full w-1/5" event="dblpointerup" action="seek:-10" />
      <Gesture className="absolute right-0 top-0 z-10 block h-full w-1/5" event="dblpointerup" action="seek:10" />

      <YoutubeControls />
    </MediaPlayer>
  );
}