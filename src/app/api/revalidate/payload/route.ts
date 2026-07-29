import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { extractBearerToken } from "@/lib/api-auth";
import { verifyPayloadRevalidateSecret } from "@/lib/cms/revalidate-auth";
import { parseCmsRevalidateEvent, tagsForCmsEvent } from "@/lib/cms/revalidate-event";

/**
 * Cache invalidation for Payload CMS content.
 *
 * Separate from `/api/revalidate`, which belongs to Saleor. The two carry different
 * events for different entities, authenticate with different secrets, and own
 * different tag namespaces (`cms:*` here). Merging them would mean one producer's
 * secret could invalidate the other's content.
 *
 * Configure in Payload as:
 *   POST https://maky.store/api/revalidate/payload
 *   Authorization: Bearer <PAYLOAD_REVALIDATE_SECRET>
 *
 * `revalidateTag` is used rather than `updateTag`, which throws outside a Server
 * Action — Next checks for a route handler explicitly. The `"max"` profile is the
 * value Next's own deprecation notice recommends for immediate expiry.
 */

/** Only ever tags this endpoint derived itself — never a path or tag from the body. */
function revalidateDerivedTags(tags: readonly string[]): void {
	for (const tag of tags) {
		revalidateTag(tag, "max");
	}
}

export async function POST(request: NextRequest) {
	// Authenticate before reading the body: no work happens for an unauthenticated
	// caller, and a missing secret rejects everyone rather than admitting everyone.
	if (!verifyPayloadRevalidateSecret(extractBearerToken(request))) {
		console.warn("[cms-revalidate] unauthorized");
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const rawBody = await request.text();

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		console.warn("[cms-revalidate] malformed json");
		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}

	const parsed = parseCmsRevalidateEvent(body);
	if (!parsed.ok) {
		console.warn("[cms-revalidate] rejected", JSON.stringify({ reason: parsed.reason }));
		return Response.json({ error: "Invalid payload", reason: parsed.reason }, { status: 400 });
	}

	const { event } = parsed;
	const tags = tagsForCmsEvent(event);

	// An event that maps to nothing is still a success: it was well-formed and
	// authenticated, there is simply no cache entry the storefront holds for it.
	revalidateDerivedTags(tags);

	console.log(
		"[cms-revalidate] ok",
		JSON.stringify({
			event: event.event,
			entityType: event.entityType,
			entitySlug: event.entitySlug,
			slug: event.slug,
			previousSlug: event.previousSlug,
			locale: event.locale,
			tags,
		}),
	);

	return Response.json({ revalidated: tags, success: true });
}
