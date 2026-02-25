import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';

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
      className="w-full aspect-video bg-slate-900 text-white font-sans overflow-hidden rounded-md ring-media-focus data-focus:ring-4"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}