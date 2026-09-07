import { getTranslations } from "next-intl/server";
import { Car, CircleHelp } from "lucide-react";

import { getLocaleFromChannel } from "@/config/locale";
import {
	vehicleFilterHref,
	type VehicleListingFilter as FilterState,
} from "@/lib/fitment/plp-vehicle-filter";
import { cn } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";

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

	const shell = (children: React.ReactNode, tone?: "muted") => (
		<div
			className={cn(
				"flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-3",
				tone === "muted"
					? "bg-fitment-unconfirmed-bg text-fitment-unconfirmed border-current/15"
					: "border-border-default",
				className,
			)}
		>
			{children}
		</div>
	);

	if (filter.state === "no-vehicle") {
		return shell(
			<>
				<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />
				<p className="text-text-secondary min-w-0 flex-1 text-sm">
					{filter.requested ? t("listingNoVehicle") : t("listingOffer")}
				</p>
				<VehicleSelectorLauncher variant="inline" />
			</>,
		);
	}

	if (filter.state === "offered") {
		return shell(
			<>
				<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />
				<p className="text-text-secondary min-w-0 flex-1 text-sm">
					{t("listingOfferFor", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				<LinkWithChannel
					href={vehicleFilterHref(basePath, searchParams, true)}
					className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors"
				>
					{t("listingApply")}
				</LinkWithChannel>
			</>,
		);
	}

	if (filter.state === "unanswerable") {
		return shell(
			<>
				<CircleHelp className="h-5 w-5 shrink-0" aria-hidden="true" />
				<p className="min-w-0 flex-1 text-sm">
					{t("listingUnanswerable", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				<LinkWithChannel
					href={vehicleFilterHref(basePath, searchParams, false)}
					className="text-text-secondary hover:text-text-primary text-sm underline underline-offset-4"
				>
					{t("listingClear")}
				</LinkWithChannel>
			</>,
			"muted",
		);
	}

	// active | empty — both narrowed the listing, and both must offer the way back.
	return shell(
		<>
			<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<p className="text-text-primary text-sm font-medium">
					{t("listingActive", { vehicle: filter.vehicleLabel ?? "" })}
				</p>
				{filter.state === "empty" && <p className="text-text-secondary mt-1 text-sm">{t("listingEmpty")}</p>}
				{filter.isDemo && <p className="text-text-tertiary mt-1 text-xs">{t("demoNotice")}</p>}
			</div>
			<LinkWithChannel
				href={vehicleFilterHref(basePath, searchParams, false)}
				className="border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition-colors"
			>
				{t("listingClear")}
			</LinkWithChannel>
		</>,
	);
}
