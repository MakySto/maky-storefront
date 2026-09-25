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

/**
 * The listing's vehicle control: what it is doing to this list, and how to undo it.
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
	 * Build it with `categoryUrl()` rather than by hand — a catalogue category lives at
	 * the root and a non-catalogue one still under `/categories/`, and every filter link
	 * on the page is derived from this string.
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

	const clearHref = vehicleFilterHref(basePath, searchParams, false);
	const changeVehicle = (
		<VehicleSelectorLauncher
			variant="link"
			label={t("listingChangeVehicle")}
			className="text-text-link hover:text-text-link-hover text-sm"
		/>
	);

	// Before the filter is on: a white panel with the mountains drawn faintly at its edge, like the
	// homepage's vehicle block, and the green action (premium redesign 2026-09).
	const panel = (
		body: React.ReactNode,
		actions: React.ReactNode,
		fields?: React.ReactNode,
		// With no fields between them the words take the row's width up to the actions, instead of
		// a 22rem column broken over four lines beside an empty middle (third pass, 2026-09-24).
		wide = !fields,
	) => (
		<div
			className={cn(
				"border-border-subtle bg-surface-card relative isolate overflow-hidden rounded-sm border shadow-xs",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className="art-mountains bg-sand-400/40 absolute right-0 bottom-0 -z-10 hidden h-[90%] w-[34%] lg:block"
			/>
			<div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-6">
				<div
					className={cn(
						"flex min-w-0 items-start gap-3.5",
						wide ? "lg:max-w-2xl lg:flex-1 lg:items-center" : "lg:w-[22rem] lg:shrink-0",
					)}
				>
					<span className="bg-status-success-bg text-status-success flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
						<Car className="h-5 w-5" aria-hidden="true" />
					</span>
					<div className="min-w-0 pt-0.5">{body}</div>
				</div>
				{fields && <div className="hidden min-w-0 flex-1 md:block">{fields}</div>}
				<div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:ml-auto lg:shrink-0">{actions}</div>
			</div>
		</div>
	);

	// Before a car is chosen: the approved category page's vehicle bar — the icon and the question,
	// then the three fields and the green button in one row (second pass, 2026-09-24). The same
	// selector's steps (`VehicleQuickSelect`); a car settled by its year goes straight to this
	// listing with the filter on — the button's words are that request — and anything more a car
	// needs is asked in the sheet.
	if (filter.state === "no-vehicle") {
		const first = await loadSelectorStep({});
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

	if (filter.state === "offered") {
		return panel(
			<p className="text-text-primary text-sm font-medium sm:text-base">
				{t("listingOfferFor", { vehicle: filter.vehicleLabel ?? "" })}
			</p>,
			<>
				<LinkWithChannel
					href={vehicleFilterHref(basePath, searchParams, true)}
					className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-ring inline-flex h-12 items-center justify-center gap-2 rounded-xs px-6 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
				>
					<Car className="h-4 w-4 shrink-0" aria-hidden="true" />
					{t("listingApply")}
				</LinkWithChannel>
				{changeVehicle}
			</>,
		);
	}

	const clearButton = (
		<LinkWithChannel
			href={clearHref}
			className="border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus-visible:ring-ring inline-flex h-10 items-center rounded-xs border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
		>
			{t("listingClear")}
		</LinkWithChannel>
	);

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

	// active — narrowed: one line that says so, and both ways out.
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
			<div className="flex items-center gap-4">
				{changeVehicle}
				{clearButton}
			</div>
		</div>
	);
}
