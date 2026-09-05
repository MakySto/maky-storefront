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

import { POST } from "./route";
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
