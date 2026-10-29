/**
 * The grid-and-list layout of a listing card, in one place.
 *
 * Every card that sits in a listing — the category card, the vehicle page's set card, the
 * configurator's result card — takes these classes, so one choice of "Mriežka / Zoznam" lays all of
 * them out the same way and a change to the list happens once.
 *
 * The switch is CSS only: `group-data-[view=list]/lv:` answers the `data-view` that
 * `ListingViewRoot` publishes. In a list, from `sm`, the card becomes a three-column grid —
 * photograph, facts, and the price with the action — and the photograph spans the card's full
 * height. Below `sm` a list is the same single column as a grid, because a phone has no room for
 * three columns and the facts must stay readable.
 */

/** The card itself. `group/card` carries the hover for the photograph's cross-fade. */
export const CARD =
	"group/card border-border-default bg-surface-card relative flex flex-col overflow-hidden rounded-sm border shadow-xs transition-[box-shadow,border-color] duration-200 ease-out hover:border-border-strong hover:shadow-md group-data-[view=list]/lv:sm:grid group-data-[view=list]/lv:sm:grid-cols-[15rem_minmax(0,1fr)_14.5rem] group-data-[view=list]/lv:sm:grid-rows-[1fr_auto] group-data-[view=list]/lv:lg:grid-cols-[17rem_minmax(0,1fr)_15.5rem]";

/** The photograph's column, which in a list spans both rows. */
export const MEDIA_COLUMN =
	"relative group-data-[view=list]/lv:sm:static group-data-[view=list]/lv:sm:row-span-2";

/** The photograph's window: a fixed ratio, so nothing jumps while photographs load. */
export const MEDIA_BOX =
	"bg-surface-card relative block aspect-[3/2] overflow-hidden sm:aspect-[4/3] group-data-[view=list]/lv:sm:aspect-auto group-data-[view=list]/lv:sm:h-full group-data-[view=list]/lv:sm:min-h-52";

/** The facts: brand, name, fit, parameters. Grows, so the rows under it line up across a row of cards. */
export const FACTS_COLUMN =
	"flex min-w-0 flex-1 flex-col px-4 pt-3 group-data-[view=list]/lv:sm:row-span-2 group-data-[view=list]/lv:sm:py-4";

/** The price and availability, under a hairline in a grid and at the top of the right column in a list. */
export const PRICE_ROW =
	"border-border-subtle mx-4 mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 group-data-[view=list]/lv:sm:col-start-3 group-data-[view=list]/lv:sm:mt-0 group-data-[view=list]/lv:sm:self-end group-data-[view=list]/lv:sm:border-t-0 group-data-[view=list]/lv:sm:pt-4";

/** The action: above the card-wide link (`relative`), so its buttons stay clickable. */
export const ACTION_ROW =
	"relative px-4 pt-3 pb-4 group-data-[view=list]/lv:sm:col-start-3 group-data-[view=list]/lv:sm:self-start";

/** The title's own size: roomier in a list, where the facts column is wide. */
export const TITLE =
	"text-text-primary mt-1.5 line-clamp-4 text-base leading-snug font-semibold tracking-[-0.01em] sm:min-h-[2lh] sm:text-[0.9375rem] group-data-[view=list]/lv:sm:min-h-0 group-data-[view=list]/lv:sm:text-base";

/**
 * The list of cards: one column on a phone, two from `sm`, three from `lg` — and always one column
 * in a list, whatever the width (`!` beats the responsive columns).
 */
export const CARD_GRID =
	"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 group-data-[view=list]/lv:grid-cols-1!";

/**
 * The same link as the shop's own purchase button: solid, high contrast, the action colour. Used
 * where a card's one way on is the primary action of the card (a set's page, from a page that has no
 * confirmed car and so cannot add to the cart).
 */
export const PRIMARY_LINK =
	"bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex h-11 w-full items-center justify-center rounded-xs text-sm font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden";

/** The link that carries the card's primary action when it is not a form: outlined, full width. */
export const DETAIL_LINK =
	"border-border-default text-text-primary hover:border-text-primary focus-visible:ring-ring flex h-11 w-full items-center justify-center rounded-xs border text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden";
