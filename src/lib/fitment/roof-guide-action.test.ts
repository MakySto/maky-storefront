import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdviceGuide = vi.fn();
const cmsRouteAvailable = vi.fn();

vi.mock("@/lib/cms/advice-guide", () => ({
	ADVICE_GUIDE_SLUG: "poradna",
	getAdviceGuide,
	roofGuidePath: (guide: { topics: { anchor: string }[] } | null) =>
		guide?.topics.some((topic) => topic.anchor === "typ-strechy") ? "/poradna#typ-strechy" : null,
}));
vi.mock("@/lib/cms/availability", () => ({ cmsRouteAvailable }));

const { loadRoofGuidePath } = await import("./roof-guide-action");

const WITH_ROOFS = {
	title: "Poradňa",
	lead: null,
	topics: [{ anchor: "typ-strechy", title: "Typ strechy", text: null }],
};

describe("where the roof question's guide link goes", () => {
	beforeEach(() => {
		getAdviceGuide.mockReset();
		cmsRouteAvailable.mockReset();
	});

	it("is the roof section of the market's guide", async () => {
		cmsRouteAvailable.mockResolvedValue(true);
		getAdviceGuide.mockResolvedValue(WITH_ROOFS);
		expect(await loadRoofGuidePath("sk-eur")).toBe("/poradna#typ-strechy");
		expect(cmsRouteAvailable).toHaveBeenCalledWith("sk-eur", "poradna");
	});

	it("is nothing in a market that has no guide, and the guide is not read", async () => {
		cmsRouteAvailable.mockResolvedValue(false);
		expect(await loadRoofGuidePath("de-eur")).toBeNull();
		expect(getAdviceGuide).not.toHaveBeenCalled();
	});

	it("is nothing when the guide has no roof section", async () => {
		cmsRouteAvailable.mockResolvedValue(true);
		getAdviceGuide.mockResolvedValue({ title: "Poradňa", lead: null, topics: [] });
		expect(await loadRoofGuidePath("sk-eur")).toBeNull();
	});

	it("is nothing when the CMS does not answer, and never an error in the selector", async () => {
		cmsRouteAvailable.mockResolvedValue(true);
		getAdviceGuide.mockRejectedValue(new Error("CMS unavailable"));
		expect(await loadRoofGuidePath("sk-eur")).toBeNull();
		expect(await loadRoofGuidePath(undefined)).toBeNull();
	});
});
