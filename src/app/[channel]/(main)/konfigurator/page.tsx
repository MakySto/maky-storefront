import { Suspense } from "react";
import { type Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { resolveVehicleOutcome } from "@/lib/fitment/resolve";
import { isDemoDataset, resolveFitmentOffers } from "@/lib/fitment/offers";
import { renderConditions } from "@/lib/fitment/conditions";
import { readGarage } from "@/lib/garage/state";
import { ConfiguratorResults, type ResultCard } from "@/ui/components/vehicle/configurator-results";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { VehicleSummary } from "@/ui/components/vehicle/vehicle-summary";
import {
	BODY_LABEL_KEY,
	CONDITION_LABEL_KEY,
	ROOF_LABEL_KEY,
} from "@/ui/components/fitment/verdict-presentation";
import { cn } from "@/lib/utils";

/**
 * Roof-rack configurator, v1.
 *
 * It offers ONLY complete roof-rack sets that are verified for the exact vehicle
 * selection and purchasable in this channel. Everything else — an unconfirmed row, a
 * disputed year, a roof box that a fitment row happens to point at — is excluded from
 * the offer and explained instead.
 *
 * `noindex`: the results depend on one visitor's saved car.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "configurator" });
	return { title: t("title"), robots: { index: false, follow: false } };
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
	// Explicit opt-out: this subtree reads the garage cookie. Relying on an incidental
	// cookies() call would work today and break the moment it moves behind a boundary.
	await connection();

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "configurator" });
	const tf = await getTranslations({ locale, namespace: "fitment" });

	const { dataset } = await loadFitmentDataset();
	const garage = await readGarage(dataset);
	const active = garage.active && !garage.active.unresolved ? garage.active : null;
	const isDemo = isDemoDataset(dataset);

	if (!active) {
		return (
			<div className="mt-6 space-y-4">
				<Notice title={t("selectVehicleFirst")} detail={t("selectVehicleFirstHint")} />
				<VehicleSelectorLauncher variant="inline" />
			</div>
		);
	}

	const qualifierLabels = [
		active.stored.b ? tf(BODY_LABEL_KEY[active.stored.b]) : null,
		active.stored.r ? tf(ROOF_LABEL_KEY[active.stored.r]) : null,
	].filter((v): v is string => Boolean(v));

	const outcome = resolveVehicleOutcome(dataset, active.selection);

	// Only verified sets become an offer. An unconfirmed or disputed row is explained
	// below, never listed with a buy button.
	const verifiedRefs = outcome.verified.map((o) => o.ref);
	const offers = await resolveFitmentOffers(verifiedRefs, channel, locale, { dataset });

	const cards: ResultCard[] = offers.offers.map((offer) => {
		const match = outcome.verified.find((o) => o.ref.saleorProductId === offer.saleorProductId);
		const conditions = renderConditions(match?.result.conditions ?? [], locale, (code) => {
			const key = CONDITION_LABEL_KEY[code];
			return key ? tf(key) : null;
		});
		return {
			offer,
			conditions: conditions.resolved.map((c) => c.text),
			unresolvedConditions: conditions.unresolvedCount,
			// Offerable is two verdicts, not one, and the card has to be able to tell them
			// apart to state the fit truthfully. The supplier comes from THIS row's own
			// evidence — a product reachable through several applications is judged by its
			// worst row, and the sentence must name that row's source, not a constant.
			verdict: match?.result.verdict ?? "MANUFACTURER_FIT",
			supplier: match?.result.product?.evidence.supplier ?? null,
		};
	});

	return (
		<div className="mt-6 space-y-6">
			<VehicleSummary
				channel={channel}
				makeName={active.makeName}
				modelName={active.modelName}
				generationName={active.generationName}
				year={active.stored.y}
				qualifiers={qualifierLabels}
				isDemo={isDemo}
			/>

			<div>
				<h2 className="text-text-primary text-lg font-semibold">{t("resultsTitle")}</h2>
				<p className="text-text-tertiary mt-1 text-sm">
					{t("resultsCount", { count: offers.purchasableCount })}
				</p>
			</div>

			{cards.length > 0 && <ConfiguratorResults channel={channel} locale={locale} cards={cards} />}

			<EmptyExplanation
				t={t}
				hasOffers={cards.length > 0}
				unanswerable={outcome.unanswerable}
				verifiedCount={outcome.verified.length}
				unconfirmedCount={outcome.unconfirmed.length}
				compatibleCount={offers.compatibleCount}
				lookupFailed={offers.lookupFailed}
			/>
		</div>
	);
}

/**
 * What to say when there is nothing to show — five different situations that the first
 * version collapsed into one, including saying "this product does not fit" over an empty
 * list on a page where no product had been chosen.
 */
function EmptyExplanation({
	t,
	hasOffers,
	unanswerable,
	verifiedCount,
	unconfirmedCount,
	compatibleCount,
	lookupFailed,
}: {
	t: (key: string) => string;
	hasOffers: boolean;
	unanswerable: boolean;
	verifiedCount: number;
	unconfirmedCount: number;
	compatibleCount: number;
	lookupFailed: boolean;
}) {
	if (hasOffers) return null;
	if (unanswerable) return <Notice title={t("lookupFailed")} />;
	if (lookupFailed) return <Notice title={t("lookupFailed")} />;
	// Verified sets exist for this car, but none is on sale in this channel.
	if (verifiedCount > 0 && compatibleCount > 0) {
		return <Notice title={t("compatibleNotPurchasable")} detail={t("compatibleNotPurchasableDetail")} />;
	}
	// Rows exist but none is trustworthy enough to offer. Not the same as "nothing fits".
	if (unconfirmedCount > 0) {
		return <Notice title={t("noVerifiedSet")} detail={t("noVerifiedSetDetail")} />;
	}
	return <Notice title={t("noOffers")} detail={t("noOffersDetail")} />;
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
