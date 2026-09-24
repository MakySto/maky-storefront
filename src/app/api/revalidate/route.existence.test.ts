import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A product event also reaches the proxy's route-existence cache, which no tag can. The
 * response body is untouched: it is a contract CFM checks field for field (route.test.ts).
 */
const { forgetProductExistence, verifySecret, verifyWebhookSignature } = vi.hoisted(() => ({
	forgetProductExistence: vi.fn(() => ({ dropped: 0, remaining: 0 })),
	verifySecret: vi.fn(),
	verifyWebhookSignature: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ verifySecret, verifyWebhookSignature, extractBearerToken: () => null }));
vi.mock("@/lib/route-existence", () => ({ forgetProductExistence }));

import { POST } from "./route";
import { CHANNEL_MAP } from "@/lib/channel-map";

const post = (body: unknown) =>
	POST(
		new Request("https://maky.store/api/revalidate", { method: "POST", body: JSON.stringify(body) }) as never,
	);

beforeEach(() => {
	vi.clearAllMocks();
	verifyWebhookSignature.mockReturnValue(true);
	verifySecret.mockReturnValue(true);
});

describe("/api/revalidate and the route-existence cache", () => {
	it("a product event forgets the product in every channel, under its new and old slug", async () => {
		const response = await post({ product: { slug: "n60012", previousSlug: "n60012-old" } });
		expect(response.status).toBe(200);
		expect(forgetProductExistence).toHaveBeenCalledTimes(1);
		expect(forgetProductExistence).toHaveBeenCalledWith({
			channels: Object.values(CHANNEL_MAP).map((c) => c.saleorSlug),
			slugs: ["n60012", "n60012-old"],
		});
		expect(Object.keys((await response.json()) as object)).toEqual(["paths", "tags", "success"]);
	});

	it("a channel-specific product event forgets it in that channel only", async () => {
		await post({ product: { slug: "n60012", channel: { slug: "de-eur" } } });
		expect(forgetProductExistence).toHaveBeenCalledWith({ channels: ["de-eur"], slugs: ["n60012"] });
	});

	it("a product translation event counts as a product event", async () => {
		await post({ translation: { product: { slug: "n60012" } } });
		expect(forgetProductExistence).toHaveBeenCalledTimes(1);
	});

	it("a category event, and an unauthorised call, leave it alone", async () => {
		await post({ category: { slug: "stresne-nosice" } });
		verifyWebhookSignature.mockReturnValue(false);
		verifySecret.mockReturnValue(false);
		expect((await post({ product: { slug: "n60012" } })).status).toBe(401);
		expect(forgetProductExistence).not.toHaveBeenCalled();
	});
});
