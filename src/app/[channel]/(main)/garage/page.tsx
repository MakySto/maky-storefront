import { Suspense } from "react";
import { type Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { readGarage } from "@/lib/garage/state";
import { GARAGE_MAX_VEHICLES } from "@/lib/garage/cookie";
import { GarageList } from "@/ui/components/vehicle/garage-list";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { cn } from "@/lib/utils";

/**
 * The guest garage.
 *
 * `robots: noindex` because the whole page is one visitor's saved cars — there is
 * nothing here for a crawler, and CLAUDE.md §11 wants personalised surfaces kept out of
 * the index and the sitemap. `noindex` is the mechanism, not a robots.txt `Disallow`: a
 * disallowed URL can never be crawled again, so it can never be de-indexed either.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "garage" });
	return {
		title: t("title"),
		robots: { index: false, follow: false },
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "garage" });

	return (
		<section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
			<header>
				<h1 className="text-text-primary text-2xl font-bold sm:text-3xl">{t("title")}</h1>
				<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("description")}</p>
			</header>

			{/* The saved vehicles come from a cookie, so this subtree is request-time and
			    must not be pulled into the prerendered shell. The fallback reserves height
			    so the page does not jump when it streams in. */}
			<Suspense fallback={<GarageSkeleton />}>
				<GarageContent channel={channel} />
			</Suspense>
		</section>
	);
}

async function GarageContent({ channel }: { channel: string }) {
	// Explicit, not incidental. Relying on the cookie read inside readGarage() to make
	// this dynamic would work today and stop working the moment that call moves behind
	// another boundary — the trap documented in odstupenie-od-zmluvy/page.tsx:36-39.
	await connection();

	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "garage" });
	const { dataset, status } = await loadFitmentDataset();
	const garage = await readGarage(dataset);

	if (garage.status === "disabled") {
		return <Notice title={t("notConfigured")} detail={t("notConfiguredDetail")} className="mt-6" />;
	}

	return (
		<div className="mt-6 space-y-6">
			{status.isFixture && <FixtureNotice channel={channel} />}

			{garage.repaired && <Notice title={t("recovered")} />}

			{!dataset && <Notice title={t("unavailable")} detail={t("unavailableDetail")} />}

			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-text-tertiary text-sm">
					{t("savedCount", { count: garage.vehicles.length, max: GARAGE_MAX_VEHICLES })}
				</p>
				{garage.vehicles.length < GARAGE_MAX_VEHICLES && dataset && (
					<VehicleSelectorLauncher variant="inline" />
				)}
			</div>

			{garage.vehicles.length === 0 ? (
				<div className="border-border-default rounded-lg border border-dashed p-8 text-center">
					<p className="text-text-primary text-sm font-medium">{t("empty")}</p>
					<p className="text-text-tertiary mt-1 text-sm">{t("emptyHint")}</p>
					{dataset && (
						<div className="mt-4 flex justify-center">
							<VehicleSelectorLauncher variant="inline" />
						</div>
					)}
				</div>
			) : (
				<>
					<GarageList
						vehicles={garage.vehicles.map((v) => ({
							makeName: v.makeName,
							modelName: v.modelName,
							generationName: v.generationName,
							year: v.stored.y,
							roofType: v.stored.r ?? null,
							unresolved: v.unresolved,
						}))}
						activeIndex={garage.activeIndex}
					/>
					{garage.vehicles.length >= GARAGE_MAX_VEHICLES && (
						<p className="text-text-tertiary text-sm">{t("limitReached", { max: GARAGE_MAX_VEHICLES })}</p>
					)}
					<div className="flex flex-wrap gap-3">
						<LinkWithChannel
							href="/konfigurator"
							className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition-colors"
						>
							{t("openConfigurator")}
						</LinkWithChannel>
						<LinkWithChannel
							href="/products"
							className="border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition-colors"
						>
							{t("browseCompatible")}
						</LinkWithChannel>
					</div>
				</>
			)}
		</div>
	);
}

async function FixtureNotice({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "fitment" });
	return <Notice title={t("fixtureNotice")} />;
}

/**
 * Class names are LITERAL on purpose. Tailwind scans source text for complete class
 * strings, so an interpolated `bg-fitment-${tone}-bg` compiles to no CSS at all — and
 * under Tailwind v4 an undefined utility emits nothing and still passes the build.
 */
function Notice({ title, detail, className }: { title: string; detail?: string; className?: string }) {
	return (
		<div
			className={cn(
				"bg-fitment-unconfirmed-bg text-fitment-unconfirmed rounded-lg border border-current/15 p-4",
				className,
			)}
		>
			<p className="text-sm font-medium">{title}</p>
			{detail && <p className="mt-1 text-sm opacity-90">{detail}</p>}
		</div>
	);
}

function GarageSkeleton() {
	return (
		<div className="mt-6 space-y-3" aria-hidden="true">
			<div className="bg-surface-muted h-10 w-48 animate-pulse rounded-md" />
			<div className="bg-surface-muted h-24 animate-pulse rounded-lg" />
		</div>
	);
}
