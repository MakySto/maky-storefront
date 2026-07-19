import { describe, expect, it } from "vitest";

import { resolvePersistedMethodId, resolveSoleMethodToAutoSave } from "./shipping-method-selection";

const COURIER = { id: "U2hpcHBpbmdNZXRob2Q6MTQ=" };
const EXPRESS = { id: "U2hpcHBpbmdNZXRob2Q6MTU=" };
const WAREHOUSE_ID = "V2FyZWhvdXNlOjE=";

describe("resolvePersistedMethodId", () => {
	it("mirrors the server-persisted method when it is an available shipping method", () => {
		expect(resolvePersistedMethodId(COURIER.id, [COURIER, EXPRESS])).toBe(COURIER.id);
	});

	it("returns undefined when the server has nothing persisted", () => {
		expect(resolvePersistedMethodId(undefined, [COURIER])).toBeUndefined();
		expect(resolvePersistedMethodId(null, [COURIER])).toBeUndefined();
	});

	it("never resolves a Warehouse (click & collect) id to a shipping method", () => {
		expect(resolvePersistedMethodId(WAREHOUSE_ID, [COURIER, EXPRESS])).toBeUndefined();
	});

	it("returns undefined when methods are empty", () => {
		expect(resolvePersistedMethodId(COURIER.id, [])).toBeUndefined();
	});
});

describe("resolveSoleMethodToAutoSave", () => {
	it("auto-saves the sole available method when nothing is persisted", () => {
		expect(resolveSoleMethodToAutoSave(undefined, [COURIER])).toBe(COURIER.id);
	});

	it("does NOT auto-save when the server already has a method (refresh, back-nav)", () => {
		expect(resolveSoleMethodToAutoSave(COURIER.id, [COURIER])).toBeNull();
	});

	it("does NOT preselect anything with multiple methods — the user must pick", () => {
		expect(resolveSoleMethodToAutoSave(undefined, [COURIER, EXPRESS])).toBeNull();
	});

	it("does nothing when no methods are available", () => {
		expect(resolveSoleMethodToAutoSave(undefined, [])).toBeNull();
	});
});
