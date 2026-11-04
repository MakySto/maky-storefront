/**
 * The grid-and-list layout of a listing card, in one place.
 *
 * Every card that sits in a listing — the category card, the vehicle page's set card, the
 * configurator's result card — takes these classes, so one choice of "Mriežka / Zoznam" lays all of
 * them out the same way and a change to the list happens once.
 *
 * The switch is CSS only: `group-data-[view=list]/lv:sm:` answers the `data-view` that
 * `ListingViewRoot` publishes. From `sm` a list card becomes a three-column grid — photograph, facts,
 * and the price with the action — and the photograph spans the card's full height. Below `sm` there is
 * ONE card, list or grid: the photograph on top, then the maker and shelf, the name, the car, the
 * mounting, the parameters, the price and the action — the order a phone reader goes down it. (A
 * compact list with a thumbnail beside the name was tried and the owner preferred the photograph on
 * top, 2026-10-29; the view toggle is not shown there, since it would change nothing.)
 */

/**
 * The card itself. `group/card` carries the hover for the photograph's cross-fade.
 *
 * In a list from `sm` the card becomes a grid whose children are placed explicitly, so the same
 * markup lays out two ways: photograph, facts, and the price over the action.
 */
export const CARD =
	"group/card border-border-default bg-surface-card relative flex flex-col overflow-hidden rounded-sm border shadow-xs transition-[box-shadow,border-color] duration-200 ease-out hover:border-border-strong hover:shadow-md group-data-[view=list]/lv:sm:grid group-data-[view=list]/lv:sm:grid-cols-[14rem_minmax(0,1fr)_14.5rem] group-data-[view=list]/lv:sm:grid-rows-[auto_1fr] group-data-[view=list]/lv:lg:grid-cols-[16rem_minmax(0,1fr)_15rem]";

/**
 * The photograph's column. In a list it is not the positioning parent, so the heart and the badge
 * sit in the corners of the CARD, not in the middle of it where the photograph ends.
 */
export const MEDIA_COLUMN =
	"relative group-data-[view=list]/lv:sm:static group-data-[view=list]/lv:sm:col-start-1 group-data-[view=list]/lv:sm:row-span-2 group-data-[view=list]/lv:sm:row-start-1";

/**
 * The photograph's window: a wide, low ratio, because the products are bars and boxes — a taller
 * window was mostly white above and below. The product is shown whole (`object-contain`) with a
 * small inner margin. In a list from `sm` it is the card's full height.
 */
export const MEDIA_BOX =
	"bg-surface-card relative block aspect-[16/10] max-h-44 w-full overflow-hidden group-data-[view=list]/lv:sm:aspect-auto group-data-[view=list]/lv:sm:h-full group-data-[view=list]/lv:sm:max-h-none group-data-[view=list]/lv:sm:min-h-36";

/** What the set is: maker, name, and what it is for. A heading, so it is short. */
export const FACTS_COLUMN =
	"flex min-w-0 flex-col px-4 pt-3 group-data-[view=list]/lv:sm:col-start-2 group-data-[view=list]/lv:sm:row-start-1 group-data-[view=list]/lv:sm:px-0 group-data-[view=list]/lv:sm:pt-4 group-data-[view=list]/lv:sm:pr-4";

/**
 * The parameters and what the set contains. `flex-1` in a grid: the block takes the card's spare
 * height, so the hairline under it sits at one height across a row of cards.
 */
export const SPECS_BLOCK =
	"flex flex-1 flex-col px-4 pt-2.5 group-data-[view=list]/lv:sm:col-start-2 group-data-[view=list]/lv:sm:row-start-2 group-data-[view=list]/lv:sm:px-0 group-data-[view=list]/lv:sm:pt-0 group-data-[view=list]/lv:sm:pr-4 group-data-[view=list]/lv:sm:pb-4";

/** The price and availability, under a hairline in a grid and at the top of the right column in a list. */
export const PRICE_ROW =
	"border-border-subtle mx-4 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 group-data-[view=list]/lv:sm:col-start-3 group-data-[view=list]/lv:sm:row-start-1 group-data-[view=list]/lv:sm:mx-0 group-data-[view=list]/lv:sm:mr-4 group-data-[view=list]/lv:sm:mt-0 group-data-[view=list]/lv:sm:self-end group-data-[view=list]/lv:sm:border-t-0 group-data-[view=list]/lv:sm:pt-4";

/** The action: above the card-wide link (`relative`), so its buttons stay clickable. */
export const ACTION_ROW =
	"relative px-4 pt-3 pb-4 group-data-[view=list]/lv:sm:col-start-3 group-data-[view=list]/lv:sm:row-start-2 group-data-[view=list]/lv:sm:self-start group-data-[view=list]/lv:sm:px-0 group-data-[view=list]/lv:sm:pt-3 group-data-[view=list]/lv:sm:pr-4 group-data-[view=list]/lv:sm:pb-0";

/** The title's own size: roomier in a list, where the facts column is wide. */
export const TITLE =
	"text-text-primary mt-1.5 line-clamp-4 text-base leading-snug font-semibold tracking-[-0.01em] sm:min-h-[2lh] sm:text-[0.9375rem] group-data-[view=list]/lv:sm:min-h-0 group-data-[view=list]/lv:sm:text-base";

/**
 * The list of cards: one column on a phone, two from `sm`, three from `lg`, four from `xl` — and always one column
 * in a list, whatever the width (`!` beats the responsive columns).
 */
export const CARD_GRID =
	"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5 group-data-[view=list]/lv:grid-cols-1!";

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
