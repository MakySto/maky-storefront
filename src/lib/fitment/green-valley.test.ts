import { describe, expect, it } from "vitest";

import sk from "@/i18n/messages/sk-SK.json";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { fitStatementFor } from "@/ui/components/vehicle/configurator-card-state";

import { isUnconditional, renderConditions } from "./conditions";
import type {
	FitmentApplication,
	FitmentDataset,
	FitmentProductRef,
	RoofType,
	VehicleSelection,
} from "./contract";
import { datasetHashFromText } from "./dataset-hash";
import { windowOf } from "./fixtures/build";
import { describeOfferFit, productFitIndex } from "./offer-fit";
import { resolveVehicleOutcome } from "./resolve";
import { roofChoicesFor } from "./selector-plan";
import { validateFitmentDataset } from "./validate";

/**
 * Green Valley roof racks (Aurilis), read the way CFM says it will deliver them.
 *
 * `CFM_GREEN_VALLEY_STOREFRONT_M_20261012` describes the delivery in words: one dataset for Nordrive, Thule and
 * Green Valley, schema 3.0.0 unchanged; `evidence.supplier` "GREEN VALLEY"; a set per (car × roof × SKU) with a
 * window of years that may be open at the end; the three roofs the Green Valley range is sold for (`raised_rail`,
 * `flush_rail`, `t_track`, which the exporter writes as `raised-rails`, `flush-rails`, `t-track`); and NO
 * condition on any set. This file builds a dataset of exactly that shape and asks what the storefront does with
 * it, so that the claims the answer to CFM makes are read off the code and not remembered.
 *
 * Nothing here describes a real vehicle or a real product: the cars are harnesses, and the shape is the point.
 * The dataset's own delivery is CFM's to make and `GET /api/fitment/status` is what says it arrived.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const GENERATED_AT = "2026-10-12T00:00:00.000Z";
/** The clock this file reads the dataset by: a day after CFM built it, so that it never ages out under the test. */
const NOW = Date.parse(GENERATED_AT) + DAY_MS;

const SUPPLIER = "GREEN VALLEY";

const gid = (pk: number) => Buffer.from(`Product:${pk}`, "utf8").toString("base64");
const vid = (pk: number) => Buffer.from(`ProductVariant:${pk}`, "utf8").toString("base64");

const RAISED_UNTIL_2019 = gid(1);
const RAISED_FROM_2020 = gid(2);
const FLUSH_FROM_2014 = gid(3);
const T_TRACK_FROM_2018 = gid(4);

const MAKE = "veh:mk:00000000-0000-4000-8000-0000000000a1";
const MODEL = "veh:md:00000000-0000-4000-8000-0000000000b1";
/** A generation sold with two roofs: the shopper has to say which one is theirs. */
const TWO_ROOFS = "veh:gn:00000000-0000-4000-8000-0000000000c1";
/** A generation sold with one roof only. */
const ONE_ROOF = "veh:gn:00000000-0000-4000-8000-0000000000c2";

const set = (pk: number): FitmentProductRef => ({
	externalReference: `cfm:product:green-valley-${pk}`,
	saleorProductId: gid(pk),
	saleorVariantId: vid(pk),
	productKind: "roof-rack-set",
	evidence: { kind: "manufacturer-application", supplier: SUPPLIER },
	qaStatus: "accepted",
	verification: "not-independently-verified",
	eligibility: { sellable: true, reasons: [] },
});

/** Every Green Valley set is written without a roof modifier, so no application carries a condition. */
const application = (
	pk: number,
	generationId: string,
	roof: RoofType,
	window: FitmentApplication["window"],
): FitmentApplication => ({
	applicationId: `app-green-valley-${pk}`,
	generationId,
	window,
	qualifiers: { roofTypes: [roof] },
	conditions: [],
	products: [set(pk)],
});

const APPLICATIONS: FitmentApplication[] = [
	application(1, TWO_ROOFS, "raised-rails", windowOf([2014], [2019])),
	application(2, TWO_ROOFS, "raised-rails", windowOf([2020], null)),
	application(3, TWO_ROOFS, "flush-rails", windowOf([2014], null)),
	application(4, ONE_ROOF, "t-track", windowOf([2018], null)),
];

const GENERATIONS: FitmentDataset["generations"] = [
	{
		id: TWO_ROOFS,
		modelId: MODEL,
		name: "Generation A",
		productionYearFrom: 2014,
		productionYearTo: null,
		qualifiers: { roofTypes: ["raised-rails", "flush-rails"] },
	},
	{
		id: ONE_ROOF,
		modelId: MODEL,
		name: "Generation B",
		productionYearFrom: 2018,
		productionYearTo: null,
		qualifiers: { roofTypes: ["t-track"] },
	},
];

/** A delivery: no demo catalogue, the instance of the live shop, and a hash recomputed the way CFM computes it. */
function delivered(): { text: string; value: FitmentDataset } {
	const body = {
		schemaVersion: "3.0.0",
		datasetVersion: "test-green-valley",
		generatedAt: GENERATED_AT,
		source: { system: "cfm" },
		saleorInstance: "api.maky.store",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: {
			scope: { programId: "maky-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: [],
		},
		makes: [{ id: MAKE, name: "Harness make" }],
		models: [{ id: MODEL, makeId: MAKE, name: "Harness model" }],
		generations: GENERATIONS,
		applications: APPLICATIONS,
	};
	const datasetHash = datasetHashFromText(JSON.stringify(body));
	const value = { ...body, datasetHash } as FitmentDataset;
	return { text: JSON.stringify(value), value };
}

function accepted(): FitmentDataset {
	const { text, value } = delivered();
	const result = validateFitmentDataset(value, { rawText: text, expectedSaleorInstance: "api.maky.store" });
	if (!result.ok)
		throw new Error(`the Green Valley harness is not a valid dataset: ${result.errors.join("; ")}`);
	return result.dataset;
}

const car = (generationId: string, year: number, roofType?: RoofType): VehicleSelection => ({
	makeId: MAKE,
	modelId: MODEL,
	generationId,
	year,
	roofType,
});

const offered = (selection: VehicleSelection) =>
	resolveVehicleOutcome(accepted(), selection, { now: NOW }).verified.map((o) => o.ref.saleorProductId);

describe("a dataset in the shape CFM describes", () => {
	it("is accepted by the validator, hash recomputed and instance checked", () => {
		const { text, value } = delivered();
		const result = validateFitmentDataset(value, { rawText: text, expectedSaleorInstance: "api.maky.store" });
		expect(result.ok).toBe(true);
	});

	it("is refused when the hash is not the document's — the check that makes the confirmed hash worth reading", () => {
		const { value } = delivered();
		const tampered = { ...value, datasetHash: "0".repeat(64) };
		const result = validateFitmentDataset(tampered, {
			rawText: JSON.stringify(tampered),
			expectedSaleorInstance: "api.maky.store",
		});
		expect(result.ok).toBe(false);
	});
});

describe("the right set for the right roof and year", () => {
	it("offers the set made for the shopper's year on a raised-rail roof, and no other", () => {
		expect(offered(car(TWO_ROOFS, 2018, "raised-rails"))).toEqual([RAISED_UNTIL_2019]);
		expect(offered(car(TWO_ROOFS, 2021, "raised-rails"))).toEqual([RAISED_FROM_2020]);
	});

	it("offers the flush-rail set only to the flush-rail roof", () => {
		expect(offered(car(TWO_ROOFS, 2021, "flush-rails"))).toEqual([FLUSH_FROM_2014]);
	});

	it("offers the T-track set to a T-track roof", () => {
		expect(offered(car(ONE_ROOF, 2019, "t-track"))).toEqual([T_TRACK_FROM_2018]);
	});

	it("offers nothing for another year or another roof — the negative cases CFM walks through", () => {
		// Before the window opens.
		expect(offered(car(TWO_ROOFS, 2013, "raised-rails"))).toEqual([]);
		expect(offered(car(ONE_ROOF, 2017, "t-track"))).toEqual([]);
		// A roof the set was not made for.
		expect(offered(car(ONE_ROOF, 2019, "raised-rails"))).toEqual([]);
		expect(offered(car(TWO_ROOFS, 2019, "t-track"))).toEqual([]);
	});

	it("does not guess the roof: a generation with two answers offers nothing until the shopper gives one", () => {
		const outcome = resolveVehicleOutcome(accepted(), car(TWO_ROOFS, 2021), { now: NOW });
		expect(outcome.verified).toEqual([]);
		expect(outcome.unconfirmed.length).toBeGreaterThan(0);
	});

	it("asks the roof question for the generation that has two roofs, with every roof the dataset names", () => {
		const dataset = accepted();
		const [twoRoofs, oneRoof] = dataset.generations;
		expect(roofChoicesFor(dataset.applications, twoRoofs!).sort()).toEqual(["flush-rails", "raised-rails"]);
		expect(roofChoicesFor(dataset.applications, oneRoof!)).toEqual(["t-track"]);
	});
});

describe("a set that carries no condition", () => {
	it("is offered as the manufacturer's word with nothing attached, not as a qualified fit", () => {
		const outcome = resolveVehicleOutcome(accepted(), car(TWO_ROOFS, 2018, "raised-rails"), { now: NOW });
		const [only] = outcome.verified;
		expect(only!.result.verdict).toBe("MANUFACTURER_FIT");
		expect(only!.result.conditions).toEqual([]);

		const rendering = renderConditions(only!.result.conditions, "sk-SK", () => null);
		expect(rendering.resolved).toEqual([]);
		expect(isUnconditional(rendering)).toBe(true);
	});

	it("names Green Valley as the one whose word the fit rests on, exactly as the supplier is written", () => {
		const outcome = resolveVehicleOutcome(accepted(), car(TWO_ROOFS, 2018, "raised-rails"), { now: NOW });
		const supplier = outcome.verified[0]!.result.product!.evidence.supplier ?? null;
		expect(supplier).toBe("GREEN VALLEY");

		const statement = fitStatementFor("MANUFACTURER_FIT", supplier, false);
		expect(statement).toEqual({ key: "cardManufacturerFit", supplier: "GREEN VALLEY" });
		const sentence = sk.configurator.cardManufacturerFit.replace("{supplier}", statement.supplier ?? "");
		expect(sentence).toBe("Kompatibilné podľa aplikačných údajov GREEN VALLEY");
	});
});

describe("what a card on the Green Valley shelf says the set is for", () => {
	const t = (key: string, values?: Record<string, string | number>) => {
		const message = String((sk.fitment as Record<string, unknown>)[key] ?? key);
		return message.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name]));
	};
	const forSet = (productId: string) =>
		describeOfferFit(productFitIndex(accepted()).get(productId), t, ROOF_LABEL_KEY);

	it("prints the roof and the years from the application, for each of the three roofs", () => {
		expect(forSet(RAISED_UNTIL_2019)).toEqual({ roof: "Pozdĺžniky nad strechou", years: "2014 – 2019" });
		expect(forSet(FLUSH_FROM_2014)).toEqual({ roof: "Integrované pozdĺžniky", years: "od 2014" });
		expect(forSet(T_TRACK_FROM_2018)).toEqual({ roof: "T-drážka", years: "od 2018" });
	});
});
