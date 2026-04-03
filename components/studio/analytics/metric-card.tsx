import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StudioMetricCardProps = {
  title: string;
  value: string;
  hint?: string;
  emphasis?: "default" | "soft";
};

export function StudioMetricCard({
  title,
  value,
  hint,
  emphasis = "default",
}: StudioMetricCardProps) {
  return (
    <Card
      className={cn(
        "relative gap-3 overflow-hidden border-border/70 bg-card shadow-sm backdrop-blur-sm",
        emphasis === "soft" && "bg-background/90",
      )}
      style={{
        backgroundImage:
          "linear-gradient(180deg, color-mix(in oklab, var(--primary) 3%, var(--card)) 0%, color-mix(in oklab, var(--primary) 0.8%, var(--card)) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 5%, transparent), transparent 48%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-5 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 12%, transparent), transparent)",
        }}
      />
      <CardHeader className="relative gap-3 pb-0">
        <div className="flex items-center gap-2">
          <CardDescription>{title}</CardDescription>
        </div>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="relative pt-0 text-xs leading-5 text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}
