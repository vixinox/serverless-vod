import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StudioNavbar } from "@/components/studio/basic/studio-navbar";
import { StudioSidebar } from "@/components/studio/basic/studio-sidebar";
import {
  StudioTransitionProvider,
  StudioTransitionSurface,
} from "@/components/studio/basic/studio-transition";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <StudioTransitionProvider>
        <StudioSidebar />
        <SidebarInset className="bg-studio-background">
          <StudioNavbar />
          <StudioTransitionSurface className="flex-1">
            {children}
          </StudioTransitionSurface>
        </SidebarInset>
      </StudioTransitionProvider>
    </SidebarProvider>
  );
}
