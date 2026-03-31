import type { CSSProperties } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StudioMetricCardProps = {
  title: string;
  value: string;
  hint?: string;
  accent?: string;
  emphasis?: "default" | "soft";
};

export function StudioMetricCard({
  title,
  value,
  hint,
  accent = "var(--chart-1)",
  emphasis = "default",
}: StudioMetricCardProps) {
  return (
    <Card
      className={cn(
        "relative gap-3 overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm",
        emphasis === "soft" && "bg-background/80",
      )}
      style={
        {
          "--metric-accent": accent,
        } as CSSProperties
      }
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--metric-accent),transparent)]" />
      <div className="absolute right-0 bottom-0 size-24 rounded-full bg-[color:var(--metric-accent)]/8 blur-2xl" />
      <CardHeader className="relative gap-1 pb-0">
        <CardDescription className="text-[11px] tracking-[0.16em] uppercase">{title}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="relative pt-0 text-xs leading-5 text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}
