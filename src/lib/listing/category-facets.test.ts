import { describe, expect, it } from "vitest";
import { facetsFromNodes } from "./category-facets";
import { bandOfVolume, parseBrandParam, volumeBand, volumeRange } from "./facet-params";

const node = (brand: string | null, volume: string | null) =>
	({
		brand: brand ? { values: [{ slug: brand.toLowerCase(), name: brand }] } : null,
		volume: volume ? { values: [{ name: volume }] } : null,
	}) as never;

describe("category facets", () => {
	it("counts the makers on the shelf, most products first, and the volume bands in order", () => {
		const facets = facetsFromNodes([
			node("Thule", "450"),
			node("Thule", "300"),
			node("Menabo", "520"),
			node("G3", "480"),
			node("G3", "410"),
			node("G3", null),
		]);
		expect(facets.brands).toEqual([
			{ slug: "g3", name: "G3", count: 3 },
			{ slug: "thule", name: "Thule", count: 2 },
			{ slug: "menabo", name: "Menabo", count: 1 },
		]);
		expect(facets.volumes).toEqual([
			{ value: "0-300", count: 1 },
			{ value: "400-500", count: 3 },
			{ value: "500-", count: 1 },
		]);
	});

	it("offers no maker filter for one maker, and no volume filter where few state one", () => {
		const facets = facetsFromNodes([node("Thule", null), node("Thule", null), node("Thule", "400")]);
		expect(facets).toEqual({ brands: [], volumes: [] });
	});

	it("reads the URL strictly and puts each volume in exactly one band", () => {
		expect(parseBrandParam("thule,Menabo,,bad slug,thule,<x>")).toEqual(["thule", "menabo"]);
		expect(parseBrandParam(null)).toEqual([]);
		expect(bandOfVolume(300)?.value).toBe("0-300");
		expect(bandOfVolume(300.5)?.value).toBe("300-400");
		expect(bandOfVolume(0)).toBeNull();
		expect(volumeBand("400-500")).not.toBeNull();
		expect(volumeBand("1-2")).toBeNull();
		expect(volumeRange(volumeBand("300-400")!)).toEqual({ gte: 301, lte: 400 });
		expect(volumeRange(volumeBand("500-")!)).toEqual({ gte: 501 });
	});
});
