import { VideoTable } from "@/components/studio/video/video-table";

export default function ContentsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-16 flex items-end z-30 bg-studio-background">
        <h1 className="ml-7 py-5 mb-1 text-2xl font-bold">频道内容</h1>
      </div>
      <VideoTable/>
    </div>
  )
}