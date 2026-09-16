import { describe, expect, it, vi, beforeEach } from "vitest";

const { revalidatePath, revalidateTag, verifySecret, verifyWebhookSignature, extractBearerToken } =
	vi.hoisted(() => ({
		revalidatePath: vi.fn(),
		revalidateTag: vi.fn(),
		verifySecret: vi.fn(),
		verifyWebhookSignature: vi.fn(),
		extractBearerToken: vi.fn(),
	}));

vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("@/lib/api-auth", () => ({ verifySecret, verifyWebhookSignature, extractBearerToken }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { CHANNEL_MAP } from "@/lib/channel-map";

const ALL_CHANNELS = Object.values(CHANNEL_MAP).map((c) => c.saleorSlug);

const post = (body: unknown) =>
	POST(
		new Request("https://maky.store/api/revalidate", {
			method: "POST",
			body: JSON.stringify(body),
		}) as never,
	);

const taggedWith = (fragment: string) =>
	revalidateTag.mock.calls.filter((call) => String(call[0]).includes(fragment));

beforeEach(() => {
	vi.clearAllMocks();
	verifyWebhookSignature.mockReturnValue(true);
	verifySecret.mockReturnValue(true);
	extractBearerToken.mockReturnValue(null);
});

describe("Saleor revalidation webhook", () => {
	it("refuses an unsigned, unauthenticated call", async () => {
		verifyWebhookSignature.mockReturnValue(false);
		verifySecret.mockReturnValue(false);

		expect((await post({ product: { slug: "x" } })).status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("purges EVERY channel when the event names none", async () => {
		// Cache keys are `product:{channel}:{locale}:{slug}` and a Saleor product
		// payload carries no channel, so falling back to the default purged one
		// market out of twelve and left eleven serving the old entry.
		await post({ product: { slug: "n60012" } });

		const channels = taggedWith("product:").map((call) => String(call[0]).split(":")[1]);
		expect(new Set(channels)).toEqual(new Set(ALL_CHANNELS));
		expect(ALL_CHANNELS).toHaveLength(12);
	});

	it("purges only the named channel when the event is channel-specific", async () => {
		await post({ product: { slug: "n60012", channel: { slug: "sk-eur" } } });

		const channels = taggedWith("product:").map((call) => String(call[0]).split(":")[1]);
		expect(new Set(channels)).toEqual(new Set(["sk-eur"]));
	});

	it("expires immediately instead of serving stale while it revalidates", async () => {
		await post({ product: { slug: "n60012", channel: { slug: "sk-eur" } } });

		expect(revalidateTag).toHaveBeenCalledWith(expect.stringContaining("product:"), { expire: 0 });
	});

	it("purges the OLD slug as well as the new one after a rename", async () => {
		// Only the new slug was ever purged, so the old URL kept serving the live
		// product — indexable, competing with the URL that replaced it.
		await post({ product: { slug: "novy", previousSlug: "stary", channel: { slug: "sk-eur" } } });

		expect(taggedWith("product:sk-eur:sk-SK:stary")).toHaveLength(1);
		expect(taggedWith("product:sk-eur:sk-SK:novy")).toHaveLength(1);
	});

	it("acts on a TRANSLATION_UPDATED event instead of shrugging", async () => {
		await post({ translation: { product: { slug: "n60012" } } });

		expect(taggedWith("product:").length).toBeGreaterThan(0);
	});

	it("acts on a media event that names its product", async () => {
		await post({ productMedia: { product: { slug: "n60012" } } });

		expect(taggedWith("product:").length).toBeGreaterThan(0);
	});

	it("refreshes the sitemap, because publishing changes which URLs exist", async () => {
		await post({ product: { slug: "n60012", channel: { slug: "sk-eur" } } });

		expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
	});

	it("refreshes the market homepage, which renders listing modules", async () => {
		await post({ product: { slug: "n60012", channel: { slug: "sk-eur" } } });

		expect(revalidatePath).toHaveBeenCalledWith("/sk-eur");
	});

	it("refreshes the category listing when a category is renamed", async () => {
		await post({ category: { slug: "stresne-nosice" } });

		expect(taggedWith("category:").length).toBe(ALL_CHANNELS.length);
	});
});

describe("the CFM revalidation contract (COMMERCE-2)", () => {
	// CFM sends `channel` as an object and M's own report showed it as a string; both are
	// valid and neither is a reason for a new endpoint. What IS the contract is the answer:
	// 200, `success: true`, and the product tag for that channel and market locale.
	const CASES = [
		{ channel: "at-eur", locale: "de-AT" },
		{ channel: "de-eur", locale: "de-DE" },
		{ channel: "us-usd", locale: "en-US" },
		{ channel: "ca-cad", locale: "en-CA" },
	] as const;

	for (const { channel, locale } of CASES) {
		it(`answers the exact CFM body for ${channel} with the ${locale} product tag`, async () => {
			const response = await post({ product: { slug: "n60012", channel: { slug: channel } } });
			const body = (await response.json()) as { success?: boolean; tags?: string[] };

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.tags).toContain(`product:${channel}:${locale}:n60012`);
			// Only that channel: AT never purges DE, although both read German.
			expect(new Set(taggedWith("product:").map((call) => String(call[0]).split(":")[1]))).toEqual(
				new Set([channel]),
			);
		});
	}

	it("takes the channel as a plain string as well", async () => {
		const response = await post({ product: { slug: "n60012", channel: "at-eur" } });
		const body = (await response.json()) as { tags?: string[] };

		expect(response.status).toBe(200);
		expect(body.tags).toContain("product:at-eur:de-AT:n60012");
	});

	it("purges the vehicle-page offers of that channel, which no other tag reaches", async () => {
		const response = await post({ product: { slug: "n60012", channel: { slug: "at-eur" } } });
		const body = (await response.json()) as { tags?: string[] };

		expect(revalidateTag).toHaveBeenCalledWith("fitment-offers:at-eur:de-AT", { expire: 0 });
		expect(body.tags).toContain("fitment-offers:at-eur:de-AT");
		expect(taggedWith("fitment-offers:")).toHaveLength(1);
	});

	it("purges the offers too when a category translation changes", async () => {
		await post({ category: { slug: "stresne-nosice" }, channel: { slug: "cz-czk" } });

		expect(revalidateTag).toHaveBeenCalledWith("fitment-offers:cz-czk:cs-CZ", { expire: 0 });
	});

	it("purges the category the event names, in the same channel", async () => {
		const response = await post({
			product: { slug: "n60012", channel: { slug: "at-eur" }, category: { slug: "stresne-nosice" } },
		});
		const body = (await response.json()) as { tags?: string[] };

		expect(body.tags).toContain("category:at-eur:de-AT:stresne-nosice");
	});

	for (const bogus of ["xx", "at", "sk", "AT-EUR", "at-eur "]) {
		it(`refuses channel ${JSON.stringify(bogus)} with 400 and purges nothing`, async () => {
			// `getLocaleFromChannel` answers an unknown slug with sk-SK, so this used to come
			// back 200 + success with a tag no page reads.
			const response = await post({ product: { slug: "n60012", channel: { slug: bogus } } });

			expect(response.status).toBe(400);
			expect(revalidateTag).not.toHaveBeenCalled();
			expect(revalidatePath).not.toHaveBeenCalled();
		});
	}
});

describe("GET resource revalidation", () => {
	const get = (query: string) => GET(new NextRequest(`https://maky.store/api/revalidate?${query}`) as never);

	it("purges one product in one channel", async () => {
		const response = await get("resource=product&channel=at-eur&locale=de-AT&slug=n60012");
		const body = (await response.json()) as { success?: boolean; tags?: string[] };

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.tags).toEqual(["product:at-eur:de-AT:n60012"]);
	});

	it("refuses an unknown channel even when the locale is the default one", async () => {
		const response = await get("resource=product&channel=xx&locale=sk-SK&slug=n60012");

		expect(response.status).toBe(400);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("refuses a locale that does not belong to the channel", async () => {
		const response = await get("resource=product&channel=at-eur&locale=de-DE&slug=n60012");

		expect(response.status).toBe(400);
		expect(revalidateTag).not.toHaveBeenCalled();
	});
});
