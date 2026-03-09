import { HomeNavbar } from "@/components/home/home-navbar";
import { VideoGallery } from "@/components/home/video-gallery"
import { PageReadySignal } from "@/components/transition/page-ready-signal";

export default function Home() {
  return (
    <div className="mx-auto min-h-screen w-full">
      <HomeNavbar />
      <main className="w-full h-full px-[5%]">
        <VideoGallery />
      </main>
      <PageReadySignal />
    </div>
  )
}
