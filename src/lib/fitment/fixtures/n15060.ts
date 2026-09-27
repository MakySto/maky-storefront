import { type FitmentApplication, type FitmentDataset, type VehicleSelection } from "../contract";

/**
 * The two offers that made the owner's point on 2026-09-27, copied from CFM's public export
 * `maky_roof_fitment_3.0.0-full-20260915.2.json` (the dataset production reads): Nordrive part
 * N15060 documented as TWO separate offers — product 858 for the Audi A4 Avant B8 and product 9168
 * for the Volkswagen Passat Variant B9. Only these two applications and their vehicles are kept.
 */

export const AUDI_OFFER = { productId: "UHJvZHVjdDo4NTg=", variantId: "UHJvZHVjdFZhcmlhbnQ6ODU4" } as const;
export const PASSAT_OFFER = {
	productId: "UHJvZHVjdDo5MTY4",
	variantId: "UHJvZHVjdFZhcmlhbnQ6OTE2OA==",
} as const;

const AUDI = "veh:mk:8f572ed9-e52a-4ca5-8a8d-f5c99c9ad32c";
const A4_AVANT = "veh:md:8923261f-a55c-4c7c-b1fc-b480627745c8";
export const A4_AVANT_B8 = "veh:gn:7e3d7a9f-ef82-45f4-bf64-892a063feb16";
const VOLKSWAGEN = "veh:mk:bcdc8224-888f-48b0-920b-9d1707a414c3";
const PASSAT_VARIANT = "veh:md:9a999929-0c80-43ef-9a6f-0086cf662776";
export const PASSAT_VARIANT_B9 = "veh:gn:79cd5347-3347-4749-9583-b1914e732ae1";

function ref(offer: { productId: string; variantId: string }, cfmId: string, sourceWindow: string) {
	return {
		externalReference: `cfm:product:${cfmId}`,
		saleorProductId: offer.productId,
		saleorVariantId: offer.variantId,
		productKind: "roof-rack-set" as const,
		evidence: {
			kind: "manufacturer-application" as const,
			supplier: "NORDRIVE",
			sourceRef: "N15060",
			sourceWindow,
		},
		qaStatus: "accepted" as const,
		verification: "not-independently-verified" as const,
		eligibility: { sellable: true, reasons: [] },
		facets: { maxLoadKg: 90, barMaterial: "aluminium", barColour: "black", barLengthCm: 120 },
	};
}

const APPLICATIONS: FitmentApplication[] = [
	{
		applicationId: "app:137d1092cde0b0682267e24a",
		generationId: PASSAT_VARIANT_B9,
		window: {
			from: { year: 2024 },
			to: null,
			startPrecision: "year",
			endPrecision: "open",
			reconciledToGeneration: true,
			sourceWindow: "12/23>",
		},
		qualifiers: { roofTypes: ["flush-rails"], bodyTypes: ["estate"] },
		conditions: [],
		negative: false,
		products: [ref(PASSAT_OFFER, "CFMP-B-NOR-0989a192871ec1-000000", "12/23>")],
	},
	{
		applicationId: "app:f66577a380da16c7281a9917",
		generationId: A4_AVANT_B8,
		window: {
			from: { year: 2008, month: 5 },
			to: { year: 2015, month: 10 },
			startPrecision: "month",
			endPrecision: "month",
			reconciledToGeneration: false,
			sourceWindow: "05/08>10/15",
		},
		qualifiers: { roofTypes: ["flush-rails"], bodyTypes: ["estate"] },
		conditions: [],
		negative: false,
		products: [ref(AUDI_OFFER, "CFMP-B-NOR-bedbf0e9c87951-000000", "05/08>10/15")],
	},
];

/** A fresh copy each call, generated "now" so it is never stale in a test. */
export function n15060Dataset(overrides: Partial<FitmentDataset> = {}): FitmentDataset {
	return {
		schemaVersion: "3.0.0",
		datasetVersion: "3.0.0-full-20260915.2 (N15060 excerpt)",
		datasetHash: "excerpt",
		generatedAt: new Date().toISOString(),
		source: { system: "cfm" },
		saleorInstance: "api.maky.store",
		validity: { validUntil: null, staleAfterDays: 30 },
		coverage: {
			scope: { programId: "nordrive-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: [],
		},
		makes: [
			{ id: AUDI, name: "AUDI" },
			{ id: VOLKSWAGEN, name: "VOLKSWAGEN" },
		],
		models: [
			{ id: A4_AVANT, makeId: AUDI, name: "A4 Avant" },
			{ id: PASSAT_VARIANT, makeId: VOLKSWAGEN, name: "Passat Variant" },
		],
		generations: [
			{
				id: PASSAT_VARIANT_B9,
				modelId: PASSAT_VARIANT,
				name: "B9",
				productionYearFrom: 2024,
				productionYearTo: null,
				qualifiers: { roofTypes: ["flush-rails"], bodyTypes: ["estate"] },
			},
			{
				id: A4_AVANT_B8,
				modelId: A4_AVANT,
				name: "B8",
				productionYearFrom: 2008,
				productionYearTo: 2015,
				qualifiers: { roofTypes: ["flush-rails"], bodyTypes: ["estate"] },
			},
		],
		applications: structuredClone(APPLICATIONS),
		...overrides,
	};
}

/** The owner's car in the screenshots: a 2025 Passat Variant B9 with integrated rails. */
export const PASSAT_2025: VehicleSelection = {
	makeId: VOLKSWAGEN,
	modelId: PASSAT_VARIANT,
	generationId: PASSAT_VARIANT_B9,
	year: 2025,
	roofType: "flush-rails",
	bodyType: "estate",
};

export const AUDI_2012: VehicleSelection = {
	makeId: AUDI,
	modelId: A4_AVANT,
	generationId: A4_AVANT_B8,
	year: 2012,
	roofType: "flush-rails",
	bodyType: "estate",
};

export const NAMES = {
	[PASSAT_VARIANT_B9]: { makeName: "VOLKSWAGEN", modelName: "Passat Variant", generationName: "B9" },
	[A4_AVANT_B8]: { makeName: "AUDI", modelName: "A4 Avant", generationName: "B8" },
} as const;
