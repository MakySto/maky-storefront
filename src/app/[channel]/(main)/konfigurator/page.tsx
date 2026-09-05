import { Suspense } from "react";
import { type Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { collectFittingProducts, resolveFitment } from "@/lib/fitment/resolve";
import { resolveFitmentOffers, uniqueProductRefs } from "@/lib/fitment/offers";
import { readGarage } from "@/lib/garage/state";
import { CompatibilityBox } from "@/ui/components/fitment/compatibility-box";
import { ConfiguratorResults } from "@/ui/components/vehicle/configurator-results";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { cn } from "@/lib/utils";

/**
 * Roof-rack configurator, v1.
 *
 * It picks an EXISTING complete set — one Saleor product with one existing variant. It
 * does not assemble a bill of materials, mint a virtual SKU, or add several cart lines:
 * the underlying add-to-cart mutation adds exactly one line per call, and multi-line
 * assembly would need sequential calls with no per-line success signal to roll back on.
 *
 * `noindex`: the results depend on one visitor's saved car, so there is no stable page
 * for a crawler to index.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "configurator" });
	return {
		title: t("title"),
		robots: { index: false, follow: false },
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "configurator" });

	return (
		<section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
			<header>
				<h1 className="text-text-primary text-2xl font-bold sm:text-3xl">{t("title")}</h1>
				<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("description")}</p>
			</header>

			<Suspense fallback={<ConfiguratorSkeleton />}>
				<ConfiguratorContent channel={channel} />
			</Suspense>
		</section>
	);
}

async function ConfiguratorContent({ channel }: { channel: string }) {
	// Explicit opt-out: this subtree reads the garage cookie. See the note in
	// garage/page.tsx — an incidental cookies() call is not a contract.
	await connection();

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "configurator" });

	const { dataset, status } = await loadFitmentDataset();
	const garage = await readGarage(dataset);
	const active = garage.active && !garage.active.unresolved ? garage.active : null;
	const selection = active?.selection ?? null;

	const vehicleLabel = active
		? [active.makeName, active.modelName, active.generationName].filter(Boolean).join(" ") +
			`, ${active.stored.y}`
		: null;

	const result = resolveFitment(dataset, selection);

	// No car yet: say so and offer the selector. Nothing is looked up, so no empty
	// result list can be mistaken for "nothing fits".
	if (!selection) {
		return (
			<div className="mt-6 space-y-4">
				<CompatibilityBox
					result={result}
					vehicleLabel={null}
					isFixture={status.isFixture}
					action={<VehicleSelectorLauncher variant="inline" />}
				/>
				<p className="text-text-tertiary text-sm">{t("selectVehicleFirstHint")}</p>
			</div>
		);
	}

	const { result: fitResult } = collectFittingProducts(dataset, selection);
	const refs = uniqueProductRefs(fitResult.matched);
	const offers = await resolveFitmentOffers(refs, channel);

	return (
		<div className="mt-6 space-y-6">
			<CompatibilityBox
				result={fitResult}
				vehicleLabel={vehicleLabel}
				isFixture={status.isFixture}
				action={<VehicleSelectorLauncher variant="inline" vehicleLabel={vehicleLabel} />}
			/>

			<div>
				<h2 className="text-text-primary text-lg font-semibold">{t("resultsTitle")}</h2>
				<p className="text-text-tertiary mt-1 text-sm">
					{t("resultsCount", { count: offers.purchasableCount })}
				</p>
			</div>

			{offers.lookupFailed && offers.offers.length === 0 ? (
				<Notice title={t("lookupFailed")} />
			) : offers.purchasableCount === 0 && offers.compatibleCount > 0 ? (
				// The distinction that matters most on this page today: compatible sets
				// exist, but none is on sale in this channel. That is NOT "nothing fits
				// your car" — nordrive-stresne-nosice currently has zero public products.
				<Notice title={t("compatibleNotPurchasable")} detail={t("compatibleNotPurchasableDetail")} />
			) : offers.offers.length === 0 ? (
				<Notice title={t("noOffers")} />
			) : (
				<ConfiguratorResults channel={channel} locale={locale} offers={offers.offers} />
			)}
		</div>
	);
}

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

function ConfiguratorSkeleton() {
	return (
		<div className="mt-6 space-y-4" aria-hidden="true">
			<div className="bg-surface-muted h-24 animate-pulse rounded-lg" />
			<div className="bg-surface-muted h-40 animate-pulse rounded-lg" />
		</div>
	);
}
