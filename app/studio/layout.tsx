import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StudioNavbar } from "@/components/studio/basic/studio-navbar";
import { StudioSidebar } from "@/components/studio/basic/studio-sidebar";

export default async function StudioLayout({ children }: { children: ReactNode }) {

  return (
    <SidebarProvider defaultOpen>
      <StudioSidebar />
      <SidebarInset className="bg-studio-background">
        <StudioNavbar />
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}