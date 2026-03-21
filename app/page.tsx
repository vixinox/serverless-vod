import { VideoGallery } from "@/components/home/video-gallery"
import { BrowseShell } from "@/components/home/browse-shell";

export default function Home() {
  return (
    <BrowseShell mainClassName="w-full h-full px-[5%]">
      <div data-home-animate>
        <VideoGallery />
      </div>
    </BrowseShell>
  )
}
