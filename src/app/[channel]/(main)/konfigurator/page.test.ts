import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FitmentLoad } from "@/lib/fitment/provider";
import { EMPTY_GARAGE_STATE, type GarageState } from "@/lib/garage/state";

/**
 * What the configurator says before it looks for a single set.
 *
 * Executed, not grepped: the page is called, the streamed part of its tree found and run,
 * and the notices it renders read off the elements. Translations come back as their keys,
 * so the assertions name the message rather than its Slovak wording.
 */

const provider = vi.hoisted(() => ({ load: null as FitmentLoad | null }));
const garage = vi.hoisted(() => ({ state: null as GarageState | null, reads: 0 }));

vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	// Outside a request `connection()` throws; the page only uses it to leave the shell.
	connection: async () => undefined,
}));
vi.mock("next-intl/server", () => ({
	getTranslations:
		async ({ namespace }: { namespace: string }) =>
		(key: string) =>
			`${namespace}.${key}`,
}));
vi.mock("@/lib/fitment/provider", () => ({
	loadFitmentDataset: async () => provider.load,
}));
vi.mock("@/lib/garage/state", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/garage/state")>()),
	readGarage: async () => {
		garage.reads++;
		return garage.state;
	},
}));

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	garage.reads = 0;
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function elementsIn(node: unknown): ReactElement[] {
	if (Array.isArray(node)) return (node as unknown[]).flatMap((child) => elementsIn(child));
	if (!isValidElement(node)) return [];
	const props = node.props as Record<string, unknown>;
	return [node, ...Object.values(props).flatMap((value) => elementsIn(value))];
}

const nameOf = (element: ReactElement) =>
	typeof element.type === "function" ? (element.type as { name?: string }).name : String(element.type);

/** The part of the page that streams in after the shell, run as React would run it. */
async function configuratorContent(): Promise<ReactElement[]> {
	const { default: Page } = await import("./page");
	const shell = await Page({ params: Promise.resolve({ channel: "sk-eur" }) });
	const content = elementsIn(shell).find((element) => nameOf(element) === "ConfiguratorContent");
	expect(content, "the page streams its content in").toBeDefined();
	const render = content!.type as (props: unknown) => Promise<unknown>;
	return elementsIn(await render(content!.props));
}

const noticeTitles = (tree: ReactElement[]) =>
	tree
		.filter((element) => nameOf(element) === "Notice")
		.map((element) => (element.props as { title: string }).title);

/** A shopper who has a car saved — which, read without a dataset, is "unresolved". */
const SAVED_CAR: GarageState = {
	...EMPTY_GARAGE_STATE,
	status: "ok",
	activeIndex: 0,
	activeIsSaved: true,
	vehicles: [],
	active: {
		stored: { k: "make-skoda", m: "model-octavia", g: "gen-nx", y: 2021 },
		selection: { makeId: "make-skoda", modelId: "model-octavia", generationId: "gen-nx", year: 2021 },
		makeName: null,
		modelName: null,
		generationName: null,
		unresolved: true,
	} as GarageState["active"],
};

describe("the configurator without a dataset", () => {
	it("says the offer could not be loaded — not 'choose a vehicle' — to a shopper with a saved car", async () => {
		provider.load = {
			dataset: null,
			status: {
				mode: "http",
				isFixture: false,
				unavailableReason: "fetch-failed",
				datasetVersion: null,
				generatedAt: null,
			},
		};
		garage.state = SAVED_CAR;

		const tree = await configuratorContent();

		expect(noticeTitles(tree)).toEqual(["configurator.lookupFailed"]);
		// And offers no selector: without a dataset it would open on an empty list of makes.
		expect(tree.some((element) => nameOf(element) === "VehicleSelectorLauncher")).toBe(false);
	});
});

describe("the configurator with a dataset", () => {
	it("still asks a shopper with no car to choose one", async () => {
		const { validateFitmentDataset } = await import("@/lib/fitment/validate");
		const fixture = (await import("@/lib/fitment/fixtures/dataset-v1.json")).default;
		const validation = validateFitmentDataset(fixture, { allowUnhashedFixture: true });
		expect(validation.ok).toBe(true);
		provider.load = {
			dataset: validation.ok ? validation.dataset : null,
			status: {
				mode: "fixture",
				isFixture: true,
				unavailableReason: null,
				datasetVersion: null,
				generatedAt: null,
			},
		};
		garage.state = { ...EMPTY_GARAGE_STATE, status: "absent" };

		const tree = await configuratorContent();

		expect(garage.reads).toBe(1);
		expect(noticeTitles(tree)).toEqual(["configurator.selectVehicleFirst"]);
		expect(tree.some((element) => nameOf(element) === "VehicleSelectorLauncher")).toBe(true);
	});
});
