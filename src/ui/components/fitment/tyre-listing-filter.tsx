import { getTranslations } from "next-intl/server";
import { CheckIcon, CircleDotIcon } from "lucide-react";

import { getLocaleFromChannel } from "@/config/locale";
import { tyreFilterHref } from "@/lib/tyre-size/listing-param";
import type { TyreListingFilter as FilterState } from "@/lib/tyre-size/plp-tyre-filter";
import { cn } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { ListingModeSwitch } from "@/ui/components/fitment/listing-mode-switch";
import { TyreSizeLauncher } from "@/ui/components/vehicle/tyre-size-launcher";

/**
 * The snow-chain listing's tyre control: what it is doing to this list, and how to undo it.
 *
 * The roof-rack shelf's vehicle control (`VehicleListingFilter`) for a different fact. One product on this shelf is one
 * manufacturer's code and a size fits only a handful of the ~145 of them, so for a shopper who has told the shop the
 * size the narrowed list is the default and the switch is how they see the whole shelf and how they get back. Both
 * sides are plain links to a URL (`?tyres=1` / `?tyres=0`), so the state is shareable and survives a reload.
 *
 * Every state says which of two different things is true: whether the list in front of the shopper has been narrowed.
 * It prints no match count: the number of products that list a size is not the number of rows in THIS listing (a
 * price band or a maker narrows it further), and two totals on one screen is a defect.
 *
 * Before a size is known it is a panel the listing starts with, and its button is the page's green action; once the
 * list is narrowed it shrinks to one line that says so. It says nothing at all when the shop's products could not be
 * read (the listing is then whole and makes no claim) and on any shelf the sizes do not belong to.
 */
export async function TyreListingFilter({
	channel,
	filter,
	basePath,
	searchParams,
	className,
}: {
	channel: string;
	filter: FilterState;
	/** Channel-relative path of this listing; every link of the control is derived from it. */
	basePath: string;
	searchParams: Record<string, string | string[] | undefined>;
	className?: string;
}) {
	if (filter.state === "out-of-scope") return null;
	// The shop's products could not be read: with no size there is nothing to say; with one, the shopper is told that the
	// list is NOT narrowed instead of seeing nothing happen, and keeps the way to change the size.
	if (filter.state === "unavailable" && filter.size === null) return null;

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "tyreSize" });
	const tFit = await getTranslations({ locale, namespace: "fitment" });

	// Before a size is known: the question, and the one button that answers it.
	if (filter.state === "no-size") {
		return (
			<div
				data-testid="tyre-listing-ask"
				className={cn(
					"border-border-subtle bg-surface-card flex flex-col gap-4 rounded-sm border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5",
					className,
				)}
			>
				<div className="flex min-w-0 items-center gap-3.5">
					<span className="bg-status-success-bg text-status-success flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
						<CircleDotIcon className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="text-text-primary text-lg font-extrabold tracking-[-0.015em]">
							{t("listingPickTitle")}
						</p>
						<p className="text-text-secondary mt-0.5 text-[0.8125rem] leading-snug">{t("listingPickBody")}</p>
					</div>
				</div>
				<TyreSizeLauncher variant="primary" label={t("fitEnter")} className="shrink-0" />
			</div>
		);
	}

	// The size is in the links, so a link that is sent on shows the same list to whoever opens it.
	const linkSize = "size" in filter ? filter.size : null;
	const narrowedHref = tyreFilterHref(basePath, searchParams, true, linkSize);
	const allHref = tyreFilterHref(basePath, searchParams, false, linkSize);
	const changeSize = (
		<TyreSizeLauncher label={t("fitChange")} className="text-text-link hover:text-text-link-hover text-sm" />
	);
	const modeSwitch = (current: "narrowed" | "all") => (
		<ListingModeSwitch
			current={current}
			narrowedHref={narrowedHref}
			allHref={allHref}
			groupLabel={t("listingModeGroup")}
			narrowedLabel={t("listingModeTyres", { size: linkSize ?? "" })}
			allLabel={t("listingModeAll")}
			icon={CircleDotIcon}
			testId="tyre-mode-switch"
		/>
	);

	if (filter.state === "unavailable") {
		return (
			<div
				data-testid="tyre-listing-unavailable"
				className={cn(
					"border-border-subtle bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border p-3 shadow-xs sm:p-4",
					className,
				)}
			>
				<span className="bg-surface-secondary text-text-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
					<CircleDotIcon className="h-4 w-4" aria-hidden="true" />
				</span>
				<p className="text-text-primary min-w-[12rem] flex-1 text-sm font-medium" role="status">
					{t("listingUnavailable", { size: filter.size ?? "" })}
				</p>
				{changeSize}
			</div>
		);
	}

	// Not narrowed, with a size known. Either the shopper chose all chains, or nothing the shop lists fits the size —
	// and the words say which, because "you are looking at everything" and "we have nothing for your size" are
	// different things to be told.
	if (filter.state === "offered") {
		return (
			<div
				data-testid="tyre-listing-offered"
				data-reason={filter.reason}
				className={cn(
					"border-border-subtle bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border p-3 shadow-xs sm:p-4",
					className,
				)}
			>
				<span className="bg-surface-secondary text-text-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
					<CircleDotIcon className="h-4 w-4" aria-hidden="true" />
				</span>
				<p className="text-text-primary min-w-[12rem] flex-1 text-sm font-medium">
					{filter.reason === "none-fit"
						? t("listingDefaultNone", { size: filter.size })
						: filter.reason === "unlisted"
							? t("listingUnlisted", { size: filter.size })
							: t("listingAllNotice", { size: filter.size })}
				</p>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					{/* A size no list holds has no narrowed list to switch to: the switch would lead nowhere. */}
					{filter.reason === "unlisted" ? (
						<LinkWithChannel
							href="/kontakt"
							className="text-text-link hover:text-text-link-hover text-sm font-medium underline decoration-1 underline-offset-2"
						>
							{tFit("listingContact")}
						</LinkWithChannel>
					) : (
						modeSwitch("all")
					)}
					{changeSize}
				</div>
			</div>
		);
	}

	// Narrowed, and nothing matched: the listing's whole content. It says what happened in the shopper's terms and
	// offers the three ways on — everything, another size, a person.
	if (filter.state === "empty") {
		return (
			<div
				data-testid="tyre-listing-empty"
				className={cn(
					"border-border-subtle bg-surface-card rounded-sm border px-5 py-10 text-center shadow-xs sm:px-8 sm:py-12",
					className,
				)}
			>
				<span className="bg-surface-secondary text-text-secondary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
					<CircleDotIcon className="h-6 w-6" aria-hidden="true" />
				</span>
				<h2 className="text-text-primary mt-4 text-lg font-semibold sm:text-xl">
					{t("listingEmptyTitle", { size: filter.size })}
				</h2>
				<p className="text-text-secondary mx-auto mt-2 max-w-xl text-sm sm:text-base">
					{t("listingEmptyBody")}
				</p>
				<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
					<LinkWithChannel
						href={allHref}
						className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-ring inline-flex h-12 items-center justify-center rounded-xs px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						{t("listingModeAll")}
					</LinkWithChannel>
					{changeSize}
					<LinkWithChannel
						href="/kontakt"
						className="text-text-link hover:text-text-link-hover text-sm font-medium underline decoration-1 underline-offset-2"
					>
						{tFit("listingContact")}
					</LinkWithChannel>
				</div>
			</div>
		);
	}

	// active: narrowed to the products that fit this size (and the ones that depend on an answer the shopper can still
	// give): one line that says so, the switch, and the way to change the size.
	return (
		<div
			data-testid="tyre-listing-active"
			className={cn(
				"border-border-subtle bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border p-3 shadow-xs sm:p-4",
				className,
			)}
		>
			<span className="bg-status-success-bg text-status-success flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
				<CheckIcon className="h-4 w-4" aria-hidden="true" />
			</span>
			<p className="text-text-primary min-w-[12rem] flex-1 text-sm font-medium">
				{t("listingActive", { size: filter.size })}
			</p>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				{modeSwitch("narrowed")}
				{changeSize}
			</div>
		</div>
	);
}
