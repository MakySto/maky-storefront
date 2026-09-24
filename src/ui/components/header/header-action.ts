/**
 * The shape shared by the header's account, favourites and cart actions.
 *
 * A phone gets a 40px icon button; from `lg` the same element is an icon over its name, the
 * way the approved design lays out "Môj účet · Obľúbené · Košík". The name is always in the
 * DOM — `sr-only` below `lg` — so the accessible name is the visible one wherever it shows.
 */
export const headerActionClass =
	"group/action text-text-primary hover:bg-surface-secondary hover:text-text-primary focus-visible:ring-ring relative inline-flex h-10 min-w-10 flex-col items-center justify-center gap-1 rounded-xs px-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:h-14 lg:min-w-16 lg:px-2";

export const headerActionLabelClass =
	"sr-only lg:not-sr-only lg:text-xs lg:leading-none lg:font-medium lg:whitespace-nowrap";
