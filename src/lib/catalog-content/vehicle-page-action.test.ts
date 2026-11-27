import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCatalogView = vi.fn();
const catalogLanguageForChannel = vi.fn();
const vehiclePageHref = vi.fn();

vi.mock("./resolve", () => ({ loadCatalogView, catalogLanguageForChannel }));
vi.mock("./vehicle-href", () => ({ vehiclePageHref }));

const { loadVehiclePagePath } = await import("./vehicle-page-action");

const KUGA = "veh:gn:kuga-dfk";
const view = (applications: number) => ({
	ready: true,
	tree: { applicationsOf: new Map([[KUGA, Array.from({ length: applications }, () => ({}))]]) },
});

describe("where the selector lands after a car is confirmed", () => {
	beforeEach(() => {
		loadCatalogView.mockReset();
		catalogLanguageForChannel.mockReset();
		vehiclePageHref.mockReset();
		catalogLanguageForChannel.mockReturnValue("sk");
	});

	it("is the generation's page in this market", async () => {
		loadCatalogView.mockResolvedValue(view(3));
		vehiclePageHref.mockResolvedValue("/sk/stresne-nosice/ford/kuga/dfk");
		expect(await loadVehiclePagePath("sk-eur", KUGA)).toBe("/sk/stresne-nosice/ford/kuga/dfk");
		expect(vehiclePageHref).toHaveBeenCalledWith("sk-eur", KUGA);
	});

	it("is nothing where the market serves no such page", async () => {
		loadCatalogView.mockResolvedValue(view(3));
		vehiclePageHref.mockResolvedValue(null);
		expect(await loadVehiclePagePath("sk-eur", KUGA)).toBeNull();
	});

	it("is nothing for a generation with nothing to list, and the page is not asked for", async () => {
		loadCatalogView.mockResolvedValue(view(0));
		expect(await loadVehiclePagePath("sk-eur", KUGA)).toBeNull();
		expect(await loadVehiclePagePath("sk-eur", "veh:gn:unknown")).toBeNull();
		expect(vehiclePageHref).not.toHaveBeenCalled();
	});

	it("is nothing in a market without a catalogue language, or whose catalogue is not ready", async () => {
		catalogLanguageForChannel.mockReturnValue(null);
		expect(await loadVehiclePagePath("us-usd", KUGA)).toBeNull();
		expect(loadCatalogView).not.toHaveBeenCalled();

		catalogLanguageForChannel.mockReturnValue("sk");
		loadCatalogView.mockResolvedValue({ ready: false });
		expect(await loadVehiclePagePath("sk-eur", KUGA)).toBeNull();
	});

	it("is nothing when the catalogue cannot be read, and never an error in the selector", async () => {
		loadCatalogView.mockRejectedValue(new Error("snapshot unavailable"));
		expect(await loadVehiclePagePath("sk-eur", KUGA)).toBeNull();
		expect(await loadVehiclePagePath(undefined, KUGA)).toBeNull();
	});
});
