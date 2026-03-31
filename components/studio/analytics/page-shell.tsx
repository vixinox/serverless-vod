import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AnalyticsHeroStat = {
  label: string;
  value: string;
};

type AnalyticsPageShellProps = {
  children: ReactNode;
};

type AnalyticsHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  actions?: ReactNode;
  stats?: AnalyticsHeroStat[];
};

type AnalyticsSectionProps = {
  kicker?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
};

export function AnalyticsPageShell({ children }: AnalyticsPageShellProps) {
  return (
    <div className="flex h-full flex-col gap-6 bg-[radial-gradient(circle_at_top,theme(colors.muted/45),transparent_42%)] p-4 md:p-6">
      {children}
    </div>
  );
}

export function AnalyticsHero({
  eyebrow,
  title,
  description,
  badges,
  actions,
  stats = [],
}: AnalyticsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/95 shadow-sm backdrop-blur-sm">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,theme(colors.muted/35),transparent)]" />
      <div className="absolute -top-24 right-0 size-56 rounded-full bg-[color:var(--chart-1)]/10 blur-3xl" />
      <div className="absolute -bottom-28 left-12 size-60 rounded-full bg-[color:var(--chart-2)]/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-3">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase">
              {eyebrow}
            </Badge>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{description}</p>
            </div>
            {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
        </div>

        {stats.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 shadow-xs backdrop-blur-sm"
              >
                <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AnalyticsSection({
  kicker,
  title,
  description,
  aside,
  className,
}: AnalyticsSectionProps) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="flex flex-col gap-1">
        {kicker ? (
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">{kicker}</p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}
