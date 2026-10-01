import "server-only";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { renderConditions } from "@/lib/fitment/conditions";
import { type FitmentVerdict } from "@/lib/fitment/contract";
import { intendedVehiclesFor, presentFitment } from "@/lib/fitment/intended-for";
import { isDemoDataset } from "@/lib/fitment/offers";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { datasetSpeaksForProduct, resolveFitment } from "@/lib/fitment/resolve";
import { GARAGE_COOKIE_NAME } from "@/lib/garage/cookie";
import { vehicleModelLabel, vehicleShortLabel } from "@/lib/garage/label";
import { readGarage } from "@/lib/garage/state";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";
import {
	CONDITION_LABEL_KEY,
	toneForVerdict,
	VERDICT_LABEL_KEY,
	type VerdictTone,
} from "./verdict-presentation";
import { programmeCovered, rememberProgramme } from "./programme-memory";
import { withinDeadline } from "./within-deadline";

/**
 * How long the cart waits for the fitment data before it leaves the badges out. The cart's lines,
 * totals and checkout button render together with them, so the purchase path waits at most this
 * long on the provider — and only for a shopper with a saved car.
 */
export const CART_FITMENT_WAIT_MS = 800;

/** One cart line, as the fitment data knows it: the product and the exact variant bought. */
export interface CartLineRef {
	readonly productId: string;
	readonly variantId: string;
}

/**
 * What a cart line says about the saved car: the verdict's own words, and the car when known —
 * or, for a line made for another car, which car ("Ponuka pre AUDI A4 Avant B8") and the way to
 * the offers for the saved one. `offer` is neutral: a description of the line, not a verdict.
 */
export interface CartLineFitment {
	readonly tone: VerdictTone | "offer";
	readonly label: string;
	readonly vehicle: string | null;
	readonly alternative?: { readonly label: string; readonly href: string };
}

/** Verdicts about our data rather than the product: a cart line keeps quiet about them. */
const SILENT: ReadonlySet<FitmentVerdict> = new Set(["STALE", "PROVIDER_UNAVAILABLE", "NO_VEHICLE_SELECTED"]);

/**
 * The compatibility of each line in the cart with the saved car — the same answer, in the
 * same words, as the product page's box (`pdp-compatibility.tsx`), keyed by Saleor VARIANT id:
 * the answer is about the exact variant bought, as on the product page.
 *
 * Why (third pass, 2026-09-24): the header said Passat while the cart held a set made for an
 * Audi A3, and nothing in the cart said so. It may be a present for someone else's car, so the
 * cart only SAYS it — nothing is blocked, removed or changed, and the cart's own logic is not
 * touched.
 *
 * Silence, never a guess, wherever the product page would be silent too: no dataset, no saved
 * car, a product the dataset has no row for (a snow chain, a fridge), or a verdict about our
 * data rather than the product. Nothing here may throw into the cart: a fault is an empty map.
 * And nothing here may hold the cart up for long: past `CART_FITMENT_WAIT_MS` the cart renders
 * without the badges (`withinDeadline`).
 */
export async function cartLineFitments(
	channel: string,
	lines: readonly CartLineRef[],
): Promise<Record<string, CartLineFitment>> {
	if (lines.length === 0) return {};
	try {
		// No garage cookie, no car: the common case costs neither the dataset nor a wait.
		if (!(await cookies()).has(GARAGE_COOKIE_NAME)) return {};
		// ONE deadline for the whole cart, around its one dataset load — not one per line: the
		// lines are then judged synchronously from the same dataset.
		const loaded = await withinDeadline(loadFitmentDataset(), CART_FITMENT_WAIT_MS);
		const dataset = loaded?.dataset ?? null;
		if (!dataset) return await unavailable(channel, lines);
		rememberProgramme(dataset);
		// Simulated data: the product page says so beside every answer; a cart badge has no room
		// for that notice, so it says nothing rather than a bare green claim.
		if (isDemoDataset(dataset)) return {};
		const garage = await readGarage(dataset, catalogLanguageForChannel(channel));
		const active = garage.active && !garage.active.unresolved ? garage.active : null;
		if (!active) return {};
		const vehicle = vehicleShortLabel({ ...active, year: active.stored.y });
		if (!vehicle) return {};

		const locale = getLocaleFromChannel(channel);
		const t = await getTranslations({ locale, namespace: "fitment" });
		const carModel = vehicleModelLabel(active);
		const fitments: Record<string, CartLineFitment> = {};
		for (const { productId: saleorProductId, variantId: saleorVariantId } of uniqueLines(lines)) {
			if (!datasetSpeaksForProduct(dataset, saleorProductId)) continue;
			const result = resolveFitment(dataset, active.selection, { saleorProductId, saleorVariantId });
			if (SILENT.has(result.verdict)) continue;
			// Made for another car: which one, and where the saved car's offers are — the product
			// page's "Určené pre", said short. Never "nepasuje": see `intended-for.ts`.
			const presentation = presentFitment(
				result,
				intendedVehiclesFor(
					dataset,
					saleorProductId,
					saleorVariantId,
					undefined,
					catalogLanguageForChannel(channel),
				),
			);
			if (presentation.kind === "intended-for") {
				const [first, ...rest] = presentation.vehicles;
				fitments[saleorVariantId] = {
					tone: "offer",
					label: t("cartOfferFor", {
						vehicle: rest.length > 0 ? `${first.name} (+${rest.length})` : first.name,
					}),
					vehicle: null,
					...(carModel
						? {
								alternative: {
									label: t("cartAlternative", { vehicle: carModel }),
									href: marketHref(channel, "/konfigurator"),
								},
							}
						: {}),
				};
				continue;
			}
			// A fit that carries a condition we cannot state is a qualified fit, exactly as on the
			// product page — never a plain green one.
			const conditions = renderConditions(result.conditions, locale, (code) => {
				const key = CONDITION_LABEL_KEY[code];
				return key ? t(key) : null;
			});
			const fit = result.verdict === "VERIFIED_FIT" || result.verdict === "MANUFACTURER_FIT";
			const qualified = fit && conditions.unresolvedCount > 0;
			fitments[saleorVariantId] = {
				tone: qualified ? "unconfirmed" : toneForVerdict(result.verdict),
				label: qualified ? t("verdictQualified") : t(VERDICT_LABEL_KEY[result.verdict]),
				vehicle,
			};
		}
		return fitments;
	} catch (error) {
		console.error("[fitment] cart compatibility failed:", error);
		return {};
	}
}

/**
 * The data did not come this time (past the deadline, or the provider down): each line the
 * programme covers — as the last dataset this process loaded knew it — says "Kompatibilitu teraz
 * nevieme overiť", neutral, without a car it could not resolve. The others say nothing.
 */
async function unavailable(
	channel: string,
	lines: readonly CartLineRef[],
): Promise<Record<string, CartLineFitment>> {
	const covered = uniqueLines(lines).filter((line) => programmeCovered(line.productId) === true);
	if (covered.length === 0) return {};
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "fitment" });
	const label = t(VERDICT_LABEL_KEY.PROVIDER_UNAVAILABLE);
	return Object.fromEntries(
		covered.map((line) => [line.variantId, { tone: "unconfirmed" as const, label, vehicle: null }]),
	);
}

/** Each variant once: two lines of the same variant get one answer. */
function uniqueLines(lines: readonly CartLineRef[]): CartLineRef[] {
	return [...new Map(lines.map((line) => [line.variantId, line])).values()];
}
