import type { ReactNode } from "react";

export default async function VideoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-full">
      <div className="flex">
        {children}
      </div>
    </div>
  );
}