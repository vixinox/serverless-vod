"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Clapperboard } from "lucide-react"
import { AuthButton } from "@/components/auth-button"
import { VideoUploadDialog } from "@/components/studio/video/upload-dialog"

export function StudioNavbar() {
  return (
    <nav className="bg-studio-background/95 sticky top-0 z-40 border-b border-sidebar-border/70 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-3 md:px-4">
        <SidebarTrigger className="size-9 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />

        <div className="ml-auto flex items-center gap-2">
          <VideoUploadDialog>
            <Button variant="outline" className="h-9 rounded-md border-sidebar-border/80 px-3">
              <Clapperboard />
              上传
            </Button>
          </VideoUploadDialog>
          <AuthButton />
        </div>
      </div>
    </nav>
  )
}