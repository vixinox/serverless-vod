/**
 * layout-config.ts
 * Single source of truth for layout constants shared between:
 *   - Tailwind class strings (used in JSX)
 *   - Runtime geometry calculations (used in GSAP transitions)
 */

export const NAVBAR_HEIGHT = 56; // h-14 = 3.5rem = 56px

/** Tailwind classes for the video player column in /watch layout */
export const PLAYER_COL_CLASSES =
  "flex flex-col gap-6 w-full xl:w-[75%] 2xl:w-[81%] xl:pr-2";
