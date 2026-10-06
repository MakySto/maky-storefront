import { getTranslations } from "next-intl/server";
import { Car, Check, CircleHelp } from "lucide-react";

import { getLocaleFromChannel } from "@/config/locale";
import {
	vehicleFilterHref,
	type VehicleListingFilter as FilterState,
} from "@/lib/fitment/plp-vehicle-filter";
import { cn } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { VehicleQuickSelect } from "@/ui/components/vehicle/vehicle-quick-select";
import { loadSelectorStep } from "@/lib/fitment/selector-actions";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";

/**
 * The listing's vehicle control: what it is doing to this list, and how to undo it.
 *
 * Since the Thule opening it is a two-way SWITCH, "Pre moje auto" | "Všetky vozidlá", and the one
 * that is on says so twice — in colour and in `aria-current`. A roof-rack shelf holds ~18 000
 * vehicle-specific sets, so for a shopper with a saved car the car's own list is the default; the
 * switch is how they see the whole shelf, and how they get back. Both are plain links to a URL
 * (`?vehicle=1` / `?vehicle=0`), so the state is shareable and survives a reload.
 *
 * Every state says which of two different things is true — whether the list in front of
 * the shopper has been narrowed — because the failure mode of getting that wrong is a
 * shopper concluding that nothing fits their car when the truth is that we could not
 * ask. `unanswerable` and `no-vehicle` therefore say in as many words that the listing
 * is NOT narrowed.
 *
 * It prints no match count. The number of verified sets for a car is not the number of
 * rows in THIS listing — a category or a price range narrows it further — and two
 * different totals on one screen is a defect, not information.
 *
 * It only renders on a shelf the fitment programme covers — the roof-rack sets — where an
 * alphabetical list of thousands of sets is of no use until the car is known. So before a
 * car is chosen it is a panel the listing starts with, and its button is the page's green
 * action; once the filter is on it shrinks to one line that says so and how to undo it.
 * Choosing a car still never narrows the list by itself: that stays an explicit click.
 */
/**
 * "Pre moje auto" | "Všetky vozidlá" — which of the two lists the shopper is looking at.
 *
 * The selected side is filled and the other is plain, in two different colours (green for the
 * list that is checked against the car, the brand's own for "all"), so a glance says which list
 * this is without reading a sentence. A real link on each side: the unselected one switches, the
 * selected one is `aria-current` and goes nowhere new.
 */
function ModeSwitch({
	current,
	vehicleHref,
	allHref,
	t,
}: {
	current: "vehicle" | "all";
	vehicleHref: string;
	allHref: string;
	t: (key: string) => string;
}) {
	const segment =
		"inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-hidden";
	return (
		<div
			role="group"
			aria-label={t("listingModeGroup")}
			data-testid="vehicle-mode-switch"
			className="border-border-default bg-surface-card inline-flex overflow-hidden rounded-xs border"
		>
			<LinkWithChannel
				href={vehicleHref}
				aria-current={current === "vehicle" ? "true" : undefined}
				className={cn(
					segment,
					current === "vehicle" ? "bg-cta text-cta-text" : "text-text-primary hover:bg-surface-muted",
				)}
			>
				<Car className="h-4 w-4 shrink-0" aria-hidden="true" />
				{t("listingModeVehicle")}
			</LinkWithChannel>
			<LinkWithChannel
				href={allHref}
				aria-current={current === "all" ? "true" : undefined}
				className={cn(
					segment,
					"border-border-default border-l",
					current === "all" ? "bg-brand text-brand-text" : "text-text-primary hover:bg-surface-muted",
				)}
			>
				{t("listingModeAll")}
			</LinkWithChannel>
		</div>
	);
}

export async function VehicleListingFilter({
	channel,
	filter,
	basePath,
	searchParams,
	className,
}: {
	channel: string;
	filter: FilterState;
	/**
	 * Channel-relative path of this listing, e.g. `/products` or `/stresne-boxy`.
	 *
	 * Build it with `categoryUrl()` rather than by hand — every category Saleor holds lives
	 * at the root, and a category this build does not know yet still under `/categories/`,
	 * and every filter link on the page is derived from this string.
	 */
	basePath: string;
	searchParams: Record<string, string | string[] | undefined>;
	className?: string;
}) {
	// Nothing to say when the deployment has no compatibility data at all.
	if (filter.state === "unavailable") return null;

	// Nothing to say on a shelf the programme never assessed either. The control's whole
	// job is to report what it is doing to THIS list; on a roof box listing it is doing
	// nothing, and offering it would only lead to an empty page under a claim we cannot
	// make. Silence is the truthful render, not a smaller banner.
	if (filter.state === "out-of-scope") return null;

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "fitment" });

	const changeVehicle = (
		<VehicleSelectorLauncher
			variant="link"
			label={t("listingChangeVehicle")}
			className="text-text-link hover:text-text-link-hover text-sm"
		/>
	);

	// Before a car is chosen: the approved category page's vehicle bar — the icon and the question,
	// then the three fields and the green button in one row (second pass, 2026-09-24). The same
	// selector's steps (`VehicleQuickSelect`); a car settled by its year goes straight to this
	// listing with the filter on — the button's words are that request — and anything more a car
	// needs is asked in the sheet.
	if (filter.state === "no-vehicle") {
		const first = await loadSelectorStep({ language: catalogLanguageForChannel(channel) ?? undefined });
		if (first.unavailable || first.makes.length === 0) return null;
		return (
			<div
				className={cn(
					"border-border-subtle bg-surface-card relative isolate overflow-hidden rounded-sm border shadow-xs",
					className,
				)}
			>
				<div
					aria-hidden="true"
					className="art-mountains bg-sand-400/60 absolute right-0 bottom-0 -z-10 hidden h-[90%] w-[22%] 2xl:block"
				/>
				<div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-end xl:gap-8 xl:p-6">
					<div className="flex min-w-0 items-center gap-3.5 xl:w-[19rem] xl:shrink-0 xl:self-center">
						<span className="bg-status-success-bg text-status-success flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
							<Car className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
						</span>
						<div className="min-w-0">
							<p className="text-text-primary text-lg font-extrabold tracking-[-0.015em]">
								{t("listingPickTitle")}
							</p>
							<p className="text-text-secondary mt-0.5 text-[0.8125rem] leading-snug">
								{filter.requested ? t("listingNoVehicle") : t("listingPickBody")}
							</p>
						</div>
					</div>
					<VehicleQuickSelect
						makes={first.makes}
						layout="bar"
						afterConfirmPath={vehicleFilterHref(basePath, searchParams, true)}
						className="min-w-0 flex-1"
					/>
				</div>
			</div>
		);
	}

	// The same two links, wherever the switch appears.
	const vehicleHref = vehicleFilterHref(basePath, searchParams, true);
	const allHref = vehicleFilterHref(basePath, searchParams, false);
	const clearHref = allHref;

	// Not narrowed, with a car saved. Either the shopper chose all vehicles, or this listing does not
	// narrow by itself, or the car has nothing verified — and the words say which, because "you are
	// looking at everything" and "we have nothing for your car" are different things to be told.
	if (filter.state === "offered") {
		return (
			<div
				className={cn(
					"border-border-subtle bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border p-3 shadow-xs sm:p-4",
					className,
				)}
			>
				<span className="bg-surface-secondary text-text-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
					<Car className="h-4 w-4" aria-hidden="true" />
				</span>
				<p className="text-text-primary min-w-[12rem] flex-1 text-sm font-medium">
					{filter.reason === "none-fit"
						? t("listingDefaultNone", { vehicle: filter.vehicleLabel ?? "" })
						: t("listingAllNotice", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<ModeSwitch current="all" vehicleHref={vehicleHref} allHref={allHref} t={t} />
					{changeVehicle}
				</div>
			</div>
		);
	}

	if (filter.state === "unanswerable") {
		return (
			<div
				className={cn(
					"bg-fitment-unconfirmed-bg text-fitment-unconfirmed flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border border-current/15 p-3 sm:p-4",
					className,
				)}
			>
				<CircleHelp className="h-5 w-5 shrink-0" aria-hidden="true" />
				<p className="min-w-[12rem] flex-1 text-sm">
					{t("listingUnanswerable", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				<LinkWithChannel
					href={clearHref}
					className="text-text-secondary hover:text-text-primary text-sm underline underline-offset-4"
				>
					{t("listingClear")}
				</LinkWithChannel>
			</div>
		);
	}

	// Narrowed to this car's sets and the shop sells none of them: they are hidden, withdrawn or not
	// purchasable here. NOT "nothing fits" (they do) and NOT a silent switch to everything (the
	// shopper asked about their car): the sets exist, they are not for sale yet, and the ways on are
	// the same three.
	if (filter.state === "not-on-sale") {
		return (
			<div
				data-testid="vehicle-not-on-sale"
				className={cn(
					"border-border-subtle bg-surface-card rounded-sm border px-5 py-10 text-center shadow-xs sm:px-8 sm:py-12",
					className,
				)}
			>
				<span className="bg-status-info-bg text-status-info mx-auto flex h-12 w-12 items-center justify-center rounded-full">
					<Car className="h-6 w-6" aria-hidden="true" />
				</span>
				<h2 className="text-text-primary mt-4 text-lg font-semibold sm:text-xl">
					{t("listingNotOnSaleTitle", { vehicle: filter.vehicleLabel ?? "" })}
				</h2>
				<p className="text-text-secondary mx-auto mt-2 max-w-xl text-sm sm:text-base">
					{t("listingNotOnSaleBody")}
				</p>
				<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
					<LinkWithChannel
						href={allHref}
						className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-ring inline-flex h-12 items-center justify-center rounded-xs px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						{t("listingModeAll")}
					</LinkWithChannel>
					{changeVehicle}
					<LinkWithChannel
						href="/kontakt"
						className="text-text-link hover:text-text-link-hover text-sm font-medium underline decoration-1 underline-offset-2"
					>
						{t("listingContact")}
					</LinkWithChannel>
				</div>
			</div>
		);
	}

	// Narrowed, and nothing matched: the listing's whole content. It says what happened in the
	// shopper's terms and offers the three ways on — the full range, another car, a person.
	if (filter.state === "empty") {
		return (
			<div
				className={cn(
					"border-border-subtle bg-surface-card rounded-sm border px-5 py-10 text-center shadow-xs sm:px-8 sm:py-12",
					className,
				)}
			>
				<span className="bg-surface-secondary text-text-secondary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
					<Car className="h-6 w-6" aria-hidden="true" />
				</span>
				<h2 className="text-text-primary mt-4 text-lg font-semibold sm:text-xl">
					{t("listingEmptyTitle", { vehicle: filter.vehicleLabel ?? "" })}
				</h2>
				<p className="text-text-secondary mx-auto mt-2 max-w-xl text-sm sm:text-base">
					{t("listingEmptyBody")}
				</p>
				{filter.isDemo && <p className="text-text-tertiary mt-2 text-xs">{t("demoNotice")}</p>}
				<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
					<LinkWithChannel
						href={clearHref}
						className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-ring inline-flex h-12 items-center justify-center rounded-xs px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						{t("listingClear")}
					</LinkWithChannel>
					{changeVehicle}
					<LinkWithChannel
						href="/kontakt"
						className="text-text-link hover:text-text-link-hover text-sm font-medium underline decoration-1 underline-offset-2"
					>
						{t("listingContact")}
					</LinkWithChannel>
				</div>
			</div>
		);
	}

	// active — narrowed to this car's sets: one line that says so, the switch, and the way to change the car.
	return (
		<div
			className={cn(
				"border-border-subtle bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border p-3 shadow-xs sm:p-4",
				className,
			)}
		>
			<span className="bg-status-success-bg text-status-success flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
				<Check className="h-4 w-4" aria-hidden="true" />
			</span>
			<div className="min-w-[12rem] flex-1">
				<p className="text-text-primary text-sm font-medium">
					{t("listingActive", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				{filter.isDemo && <p className="text-text-tertiary mt-1 text-xs">{t("demoNotice")}</p>}
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<ModeSwitch current="vehicle" vehicleHref={vehicleHref} allHref={allHref} t={t} />
				{changeVehicle}
			</div>
		</div>
	);
}
