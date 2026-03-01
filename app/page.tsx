import { HomeNavbar } from "@/components/home/home-navbar";
import { VideoGallery } from "@/components/home/video-gallery"

export default function Home() {
  return (
    <div className="mx-auto min-h-screen w-full">
      <HomeNavbar />
      <main className="w-full">
        <VideoGallery />
      </main>
    </div>
  )
}
