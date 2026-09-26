import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { readBearerToken, verifyPayloadRevalidateSecret } from "@/lib/cms/revalidate-auth";
import { parseCmsRevalidateEvent, tagsForCmsEvent } from "@/lib/cms/revalidate-event";
import { revalidationTargets } from "@/lib/cms/revalidate-targets";

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
 * The Authorization header is the ONLY accepted carrier for the secret. `?secret=`
 * and custom headers are rejected even when the value is correct — see
 * `readBearerToken`. Only POST is exported, so Next answers every other method with
 * 405 before any of this runs.
 *
 * `revalidateTag` is used rather than `updateTag`, which throws outside a Server
 * Action — Next checks for a route handler explicitly.
 *
 * `"max"` is **stale-while-revalidate, not immediate expiry** — an earlier version of
 * this comment said the opposite. The next visitor after a publish may still be served
 * the previous revision while the refresh happens behind them; the one after that gets
 * the new one. Measured at the deployed SHA against a mock Payload: view 1 stale, view 2
 * onwards new, and **exactly one** origin request for the refresh.
 *
 * That is why the cutover gate is worded as "the edit must appear by the second view".
 * It is not slack in the check — it is the documented semantics of this line.
 *
 * ## v1 and v2 bodies
 *
 * A v1 body is answered exactly as before: `{ revalidated, success }`. A v2 body
 * (`schemaVersion: 2`, `__fixtures__/provider-v3/revalidation-event-v2.md`) additionally
 * gets `schemaVersion`, its `eventId` and `targets` — the public URLs the CMS should check
 * for the new revision, and the markets it should not, because they are not open. The
 * targets never widen what is invalidated and never open a market; they only describe.
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
	if (!verifyPayloadRevalidateSecret(readBearerToken(request))) {
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

	if (!event.v2) {
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

	const targets = revalidationTargets(event);

	console.log(
		"[cms-revalidate] ok",
		JSON.stringify({
			schemaVersion: 2,
			eventId: event.v2.eventId,
			event: event.event,
			change: event.v2.change,
			entityType: event.entityType,
			entitySlug: event.entitySlug,
			slug: event.slug,
			previousSlug: event.previousSlug,
			tags,
			targets: targets.map((target) => `${target.market}:${target.live ? "live" : target.reason}`),
		}),
	);

	return Response.json({
		success: true,
		schemaVersion: 2,
		eventId: event.v2.eventId,
		revalidated: tags,
		targets,
	});
}
