import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { CACHE_PROFILES, buildTag, buildPath } from "@/lib/cache-manifest";
import { extractBearerToken, verifySecret, verifyWebhookSignature } from "@/lib/api-auth";
import { getLocaleFromChannel } from "@/config/locale";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { parseWebhookPayload } from "@/lib/saleor/webhook-payload";

/**
 * Webhook endpoint for cache invalidation.
 *
 * Configure in Saleor Dashboard:
 * 1. Go to Configuration → Webhooks
 * 2. Create webhook pointing to: https://your-site.com/api/revalidate
 * 3. Select events: PRODUCT_UPDATED, CATEGORY_UPDATED, etc.
 * 4. Copy the secret key and set as SALEOR_WEBHOOK_SECRET env var
 *
 * Security:
 * - Verifies Saleor's HMAC signature (timing-safe)
 * - Falls back to Bearer token / x-revalidate-secret header
 */

// ============================================================================
// Revalidation helper — keeps the switch cases DRY
// ============================================================================

/**
 * Expire NOW, rather than "revalidate soon".
 *
 * The named profiles (`minutes`, `hours`, `days`) are stale-while-revalidate:
 * after a purge the next request is still served the old entry while the new one
 * is fetched behind it. That is right for ordinary drift and wrong for a
 * publication event — "this product now exists" must not be eventually true.
 */
const IMMEDIATE = { expire: 0 } as const;

function revalidateProfile(
	profile: (typeof CACHE_PROFILES)[keyof typeof CACHE_PROFILES],
	channel: string,
	locale: string,
	slug: string,
	tags: string[],
	paths: string[],
) {
	const identity = { channel, locale, slug };
	const tag = buildTag(profile, identity);
	revalidateTag(tag, IMMEDIATE);
	tags.push(tag);

	const path = buildPath(profile, identity);
	if (path) {
		revalidatePath(path);
		paths.push(path);
	}
}

/**
 * Every Saleor channel, or just the one the event named.
 *
 * Cache keys carry channel AND locale (`product:{channel}:{locale}:{slug}`), and
 * a Saleor product payload carries no channel at all — so falling back to
 * `DefaultChannelSlug` purged one market out of twelve and left the other eleven
 * serving the old entry until it expired on its own. A product event is not
 * channel-specific; the fan-out has to match the key.
 */
function targetChannels(named: string | undefined): string[] {
	if (named) return [named];
	return Object.values(CHANNEL_MAP).map((config) => config.saleorSlug);
}

// ============================================================================
// POST — Saleor webhook
// ============================================================================

export async function POST(request: NextRequest) {
	const rawBody = await request.text();

	const signature = request.headers.get("saleor-signature");
	if (!verifyWebhookSignature(rawBody, signature)) {
		const token = extractBearerToken(request) ?? request.headers.get("x-revalidate-secret");
		if (!verifySecret(token)) {
			console.warn("[Revalidate] Invalid signature or secret");
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}
	}

	try {
		const payload = JSON.parse(rawBody);

		if (process.env.NODE_ENV === "development") {
			console.log("[Revalidate] Raw payload:", JSON.stringify(payload, null, 2));
		}

		const resource = parseWebhookPayload(payload);
		const { kind, slug, previousSlug, categorySlug, unnamedProduct } = resource;

		const revalidatedPaths: string[] = [];
		const revalidatedTags: string[] = [];

		for (const channel of targetChannels(resource.channel)) {
			const locale = getLocaleFromChannel(channel);

			// A rename has to purge BOTH slugs. Only the new one was ever purged, so
			// the old URL kept serving the live product — indexable, and competing
			// with the URL that replaced it.
			const slugs = [slug, previousSlug].filter((value): value is string => Boolean(value));

			switch (kind) {
				case "product":
					for (const value of slugs) {
						revalidateProfile(
							CACHE_PROFILES.products,
							channel,
							locale,
							value,
							revalidatedTags,
							revalidatedPaths,
						);
					}
					revalidatePath(`/${channel}/products`);
					revalidatedPaths.push(`/${channel}/products`);
					if (categorySlug) {
						revalidateProfile(
							CACHE_PROFILES.categories,
							channel,
							locale,
							categorySlug,
							revalidatedTags,
							revalidatedPaths,
						);
					}
					break;

				case "category":
					for (const value of slugs) {
						revalidateProfile(
							CACHE_PROFILES.categories,
							channel,
							locale,
							value,
							revalidatedTags,
							revalidatedPaths,
						);
					}
					revalidatePath(`/${channel}/products`);
					revalidatedPaths.push(`/${channel}/products`);
					break;

				case "collection":
					for (const value of slugs) {
						revalidateProfile(
							CACHE_PROFILES.collections,
							channel,
							locale,
							value,
							revalidatedTags,
							revalidatedPaths,
						);
					}
					break;

				default:
					revalidatePath(`/${channel}/products`);
					revalidatedPaths.push(`/${channel}/products`);
			}

			// The homepage carries listing modules built from the same catalogue.
			revalidatePath(`/${channel}`);
			revalidatedPaths.push(`/${channel}`);
		}

		// Publishing, unpublishing or renaming changes which URLs exist, so the
		// sitemap is stale too — and it is the one surface a crawler reads first.
		revalidatePath("/sitemap.xml");
		revalidatedPaths.push("/sitemap.xml");

		if (unnamedProduct) {
			console.warn(
				"[Revalidate] product event carried no slug — listing and sitemap refreshed, but no " +
					"detail page could be targeted. Add `product { slug }` to the webhook subscription.",
			);
		}

		const sanitizedSlug = slug?.replace(/[\r\n]/g, "") ?? "";
		const sanitizedPaths = revalidatedPaths.map((s) => s.replace(/[\r\n]/g, ""));
		const sanitizedTags = revalidatedTags.map((s) => s.replace(/[\r\n]/g, ""));
		console.log("[Revalidate] Success:", {
			type: kind,
			slug: sanitizedSlug,
			paths: sanitizedPaths,
			tags: sanitizedTags,
		});
		return Response.json({ paths: revalidatedPaths, tags: revalidatedTags, success: true });
	} catch (error) {
		console.error("[Revalidate] Error:", error);
		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}
}

// ============================================================================
// GET — Manual cache clearing (protected by secret)
// ============================================================================

/**
 * @example Path-based revalidation:
 * curl -H "Authorization: Bearer <token>" "https://store.com/api/revalidate?path=/default-channel/products/my-product"
 *
 * @example Tag-based revalidation:
 * curl -H "Authorization: Bearer <token>" "https://store.com/api/revalidate?tag=product:my-product"
 *
 * @example Both at once:
 * curl -H "Authorization: Bearer <token>" "https://store.com/api/revalidate?path=/default-channel/products/my-product&tag=product:my-product"
 *
 * @example Revalidate all cached data:
 * curl -H "Authorization: Bearer <token>" "https://store.com/api/revalidate?all=1"
 */
export async function GET(request: NextRequest) {
	const token = extractBearerToken(request);
	if (!verifySecret(token)) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const path = searchParams.get("path");
	const tag = searchParams.get("tag");
	const all = searchParams.get("all");
	const resource = searchParams.get("resource");
	const channel = searchParams.get("channel");
	const locale = searchParams.get("locale");
	const slug = searchParams.get("slug");

	if (!path && !tag && !all && !resource) {
		return Response.json(
			{ error: "Provide resource identity, path, tag, and/or all parameter" },
			{ status: 400 },
		);
	}

	const revalidatedPaths: string[] = [];
	const revalidatedTags: string[] = [];

	if (all === "1" || all === "true") {
		revalidatePath("/", "layout");
		revalidatedPaths.push("/ (all routes)");

		const fixedTagProfiles = Object.values(CACHE_PROFILES).filter((p) => !p.tagPattern.includes("{"));
		for (const p of fixedTagProfiles) {
			revalidateTag(p.tagPattern, p.cacheProfile);
			revalidatedTags.push(p.tagPattern);
		}

		const slugProfiles = Object.values(CACHE_PROFILES)
			.filter((p) => p.tagPattern.includes("{slug}"))
			.map((p) => p.id);

		console.log(
			"[Revalidate] Full purge:",
			'revalidatePath("/", "layout") invalidates all routes (including slug-based:',
			slugProfiles.join(", ") + ").",
			"Also revalidated fixed tags:",
			fixedTagProfiles.map((p) => p.tagPattern).join(", "),
		);
	}

	if (resource) {
		const profiles = {
			product: CACHE_PROFILES.products,
			category: CACHE_PROFILES.categories,
			collection: CACHE_PROFILES.collections,
		} as const;
		const profile = profiles[resource as keyof typeof profiles];
		if (!profile || !channel || !locale || !slug) {
			return Response.json(
				{ error: "resource requires product|category|collection plus channel, locale, and slug" },
				{ status: 400 },
			);
		}
		if (getLocaleFromChannel(channel) !== locale) {
			return Response.json({ error: "locale does not belong to channel" }, { status: 400 });
		}
		revalidateProfile(profile, channel, locale, slug, revalidatedTags, revalidatedPaths);
	}

	if (path) {
		console.log(
			`[Revalidate] Path: revalidatePath("${path.replace(/[\r\n]/g, "")}") — invalidates this specific route`,
		);
		revalidatePath(path);
		revalidatedPaths.push(path);
	}

	if (tag) {
		const profile = searchParams.get("profile") || "minutes";
		console.log(
			`[Revalidate] Tag: revalidateTag("${tag.replace(
				/[\r\n]/g,
				"",
			)}", "${profile}") — invalidates "use cache" entries with this tag`,
		);
		revalidateTag(tag, profile);
		revalidatedTags.push(tag);
	}

	console.log("[Revalidate] Done:", { paths: revalidatedPaths, tags: revalidatedTags });
	return Response.json({ paths: revalidatedPaths, tags: revalidatedTags, success: true });
}
