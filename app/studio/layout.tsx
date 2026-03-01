import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioNavbar } from "@/components/studio/basic/studio-navbar";
import { StudioSidebar } from "@/components/studio/basic/studio-sidebar";

export default async function StudioLayout({ children }: { children: ReactNode }) {

  return (
    <SidebarProvider defaultOpen>
      <div className="w-full bg-studio-background">
        <StudioNavbar />
        <div className="w-full h-16" />
        <div className="flex">
          <StudioSidebar />
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}