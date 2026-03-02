import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tailwind class string for the outer shell of every player button.
 * Apply this to the vidstack primitive button (PlayButton, MuteButton, etc.)
 * and add the `group` variant so children can react to hover.
 *
 * Shape:  rounded-full
 * BG:     always-visible gray semi-transparent ring
 * Size:   defaults to 40 × 40 px (override with w-* / h-* classes)
 */
export const playerBtnCls = [
  // layout
  'group relative inline-flex items-center justify-center',
  // size
  'w-10 h-10',
  // rounded pill shell
  'rounded-full',
  // always-visible gray semi-transparent background
  'bg-white/15',
  // interaction
  'cursor-pointer select-none outline-none',
  // subtle focus ring
  'focus-visible:ring-2 focus-visible:ring-white/60',
].join(' ');

/**
 * Inner overlay div — 95 % of the button size, transparent at rest,
 * transitions quickly to semi-transparent white on hover.
 *
 * Render this as the **first child** inside any vidstack button that uses
 * `playerBtnCls` so it visually fills the button interior.
 */
export function PlayerBtnOverlay() {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-[2.5%] rounded-full',
        'bg-transparent',
        // fast transition (75 ms) → semi-transparent white on hover
        'transition-colors duration-75 group-hover:bg-white/22',
      )}
    />
  );
}

/**
 * Convenience wrapper when you need a plain `<button>` (not a vidstack
 * primitive) that adopts the same look-and-feel.
 */
export function PlayerButton({
  children,
  className,
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(playerBtnCls, className)}
    >
      <PlayerBtnOverlay />
      {/* icon slot – rendered above the overlay */}
      <span className="relative z-10 flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
