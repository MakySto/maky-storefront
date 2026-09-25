import { beforeEach, describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { __forgetProgramme, programmeCovered, rememberProgramme } from "./programme-memory";

const dataset = (hash: string, ids: string[]) =>
	({
		datasetHash: hash,
		applications: ids.map((id) => ({ products: [{ saleorProductId: id }] })),
	}) as unknown as FitmentDataset;

beforeEach(() => __forgetProgramme());

describe("programme memory", () => {
	it("knows nothing before the first dataset", () => {
		expect(programmeCovered("p1")).toBeNull();
	});

	it("answers from the last dataset loaded, and follows a new one", () => {
		rememberProgramme(dataset("h1", ["p1"]));
		expect(programmeCovered("p1")).toBe(true);
		expect(programmeCovered("p2")).toBe(false);

		rememberProgramme(dataset("h2", ["p2"]));
		expect(programmeCovered("p1")).toBe(false);
		expect(programmeCovered("p2")).toBe(true);
	});
});
