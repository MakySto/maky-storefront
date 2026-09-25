import { cmsCollectionTag, cmsGlobalTag, cmsPageTag } from "./cache-tags";
import { isMarketCode, isPayloadLocale, type MarketCode, type PayloadLocale } from "./markets";

/**
 * The revalidation event Payload sends after a document changes.
 *
 * The endpoint derives cache tags from the entity and slug and never accepts a tag
 * or a path from the body. A caller able to name its own path could purge anything
 * on the site, so the webhook describes *what changed* and the storefront alone
 * decides what that invalidates.
 *
 * ## Two versions, one parser
 *
 * v1 is the body the CMS has always sent: `source`, `entityType`, `entitySlug`, `entityId`,
 * `event`, `locale`, `slug`, `previousSlug`. Its rules are unchanged, and they are the only
 * reason a body is refused — an unknown `event` or `entityType` is still a 400.
 *
 * v2 (`schemaVersion: 2`, `__fixtures__/provider-v3/revalidation-event-v2.md`) is a strict
 * superset: the same eight fields with the same meaning, plus the precise `change`, a stable
 * `eventId`, the `revision`, the affected markets and locales, the old and new route
 * identities, and — for an image — the published documents that use it. None of the extra
 * fields can make a valid v1 body invalid: a `change` this storefront does not know is read as
 * `null`, a malformed route or dependent is left out. Rejecting them would turn a CMS-side
 * addition into eight retries and an error in the admin, for an event the v1 fields already
 * describe well enough to invalidate.
 *
 * The event is only ever used to INVALIDATE. It may arrive twice, or after a newer one; the
 * page is always re-read from the CMS afterwards, so a stale event cannot resurrect anything.
 */

export const CMS_EVENTS = ["publish", "update", "unpublish", "delete"] as const;
export type CmsEventName = (typeof CMS_EVENTS)[number];

export const CMS_ENTITY_TYPES = ["collection", "global"] as const;
export type CmsEntityType = (typeof CMS_ENTITY_TYPES)[number];

/** The precise change a v2 event names. `event` stays the coarse v1 name beside it. */
export const CMS_CHANGES = [
	"publish",
	"update",
	"unpublish",
	"trash",
	"restore",
	"delete",
	"media-update",
	"media-delete",
] as const;
export type CmsChangeName = (typeof CMS_CHANGES)[number];

/** Only this producer is accepted; anything else is a misrouted or forged call. */
export const CMS_EVENT_SOURCE = "maky-cms";

/** A document's public identity before or after a change. */
export interface CmsRouteIdentity {
	readonly slug: string;
	readonly markets: readonly MarketCode[];
	readonly locales: readonly PayloadLocale[];
}

/** A published document that uses the changed image. */
export interface CmsEventDependent {
	readonly entitySlug: string;
	readonly entityId: string | null;
	readonly slug: string | null;
}

/** The fields v2 adds. Present only on a body that declares `schemaVersion: 2`. */
export interface CmsRevalidateEventV2 {
	readonly schemaVersion: 2;
	/** Echoed back so the CMS can match the answer to its outbox entry. */
	readonly eventId: string | null;
	/** `null` when the CMS names a change this storefront does not know — never a refusal. */
	readonly change: CmsChangeName | null;
	/** `updatedAt` of the published document after the change; `null` when it left the web. */
	readonly revision: string | null;
	readonly markets: readonly MarketCode[];
	readonly locales: readonly PayloadLocale[];
	readonly routes: {
		readonly previous: CmsRouteIdentity | null;
		readonly current: CmsRouteIdentity | null;
	};
	readonly dependents: readonly CmsEventDependent[];
}

export interface CmsRevalidateEvent {
	readonly source: typeof CMS_EVENT_SOURCE;
	readonly entityType: CmsEntityType;
	readonly entitySlug: string;
	readonly entityId: string | null;
	readonly event: CmsEventName;
	readonly locale: string | null;
	readonly slug: string | null;
	readonly previousSlug: string | null;
	/** Absent on a v1 body, so a v1 event parses to exactly what it always did. */
	readonly v2?: CmsRevalidateEventV2;
}

export type CmsEventParse =
	| { readonly ok: true; readonly event: CmsRevalidateEvent }
	| { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * An id that is echoed back in the response. Bounded and plain, so the answer never
 * reflects arbitrary text from the body.
 */
function readEventId(value: unknown): string | null {
	return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null;
}

function readMarkets(value: unknown): MarketCode[] {
	return Array.isArray(value) ? value.filter(isMarketCode) : [];
}

function readLocales(value: unknown): PayloadLocale[] {
	return Array.isArray(value) ? value.filter(isPayloadLocale) : [];
}

function readRoute(value: unknown): CmsRouteIdentity | null {
	if (!isRecord(value)) return null;
	const slug = optionalString(value.slug);
	if (!slug) return null;
	return { slug, markets: readMarkets(value.markets), locales: readLocales(value.locales) };
}

function readDependents(value: unknown): CmsEventDependent[] {
	if (!Array.isArray(value)) return [];
	const dependents: CmsEventDependent[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) continue;
		const entitySlug = optionalString(entry.entitySlug);
		if (!entitySlug) continue;
		dependents.push({
			entitySlug,
			entityId: optionalString(entry.entityId),
			slug: optionalString(entry.slug),
		});
	}
	return dependents;
}

function readV2(raw: Record<string, unknown>): CmsRevalidateEventV2 {
	const routes = isRecord(raw.routes) ? raw.routes : {};
	const change = raw.change;
	return {
		schemaVersion: 2,
		eventId: readEventId(raw.eventId),
		change:
			typeof change === "string" && (CMS_CHANGES as readonly string[]).includes(change)
				? (change as CmsChangeName)
				: null,
		revision: optionalString(raw.revision),
		markets: readMarkets(raw.markets),
		locales: readLocales(raw.locales),
		routes: { previous: readRoute(routes.previous), current: readRoute(routes.current) },
		dependents: readDependents(raw.dependents),
	};
}

export function parseCmsRevalidateEvent(raw: unknown): CmsEventParse {
	if (!isRecord(raw)) return { ok: false, reason: "body is not an object" };

	if (raw.source !== CMS_EVENT_SOURCE) {
		return { ok: false, reason: `unexpected source ${JSON.stringify(raw.source)}` };
	}

	const entityType = raw.entityType;
	if (typeof entityType !== "string" || !CMS_ENTITY_TYPES.includes(entityType as CmsEntityType)) {
		return { ok: false, reason: `unexpected entityType ${JSON.stringify(entityType)}` };
	}

	const entitySlug = optionalString(raw.entitySlug);
	if (!entitySlug) return { ok: false, reason: "entitySlug is missing" };

	const event = raw.event;
	if (typeof event !== "string" || !CMS_EVENTS.includes(event as CmsEventName)) {
		return { ok: false, reason: `unexpected event ${JSON.stringify(event)}` };
	}

	return {
		ok: true,
		event: {
			source: CMS_EVENT_SOURCE,
			entityType: entityType as CmsEntityType,
			entitySlug,
			entityId: optionalString(raw.entityId),
			event: event as CmsEventName,
			locale: optionalString(raw.locale),
			slug: optionalString(raw.slug),
			previousSlug: optionalString(raw.previousSlug),
			// Only an exact `2`. Anything else — absent, 1, a string, a future 3 — is answered
			// as v1, which the contract guarantees every later body remains readable as.
			...(raw.schemaVersion === 2 ? { v2: readV2(raw) } : {}),
		},
	};
}

/**
 * The tags one document reached through an image carries.
 *
 * Derived from the collection, never taken from the body: a dependent names a document,
 * and this decides what caches that document lives in. A page is read per slug and per
 * collection; brands are read as a whole collection (`brands.ts`); anything else has at
 * least its collection tag.
 */
function dependentTags(dependent: CmsEventDependent): (string | null)[] {
	if (dependent.entitySlug === "pages") {
		return [cmsCollectionTag("pages"), dependent.slug ? cmsPageTag(dependent.slug) : null];
	}
	return [cmsCollectionTag(dependent.entitySlug)];
}

/**
 * Cache tags to invalidate for an event.
 *
 * A slug change arrives as ONE request carrying both the new `slug` and the old
 * `previousSlug`, so both are invalidated — otherwise the old URL keeps serving
 * the page from cache after it has moved. A v2 body says the same thing again in
 * `routes.current` and `routes.previous`; both are read, and the duplicates collapse.
 *
 * An image change (`public-media`) also invalidates every published document the CMS
 * lists as using it. Without that, a replaced photo stays on those pages until their
 * cache expires on its own — which is exactly what a v1 storefront does with the same
 * event.
 *
 * Tags are deduplicated, and a slug that is not slug-shaped is dropped by the tag
 * builders rather than becoming a junk tag. Invalidation is idempotent: replaying
 * the same event re-invalidates the same tags and cannot corrupt anything.
 */
export function tagsForCmsEvent(event: CmsRevalidateEvent): string[] {
	const tags: (string | null)[] = [];

	if (event.entityType === "global") {
		tags.push(cmsGlobalTag(event.entitySlug));
	} else {
		// Coarse tag first: an entity the storefront does not yet read per-slug still
		// has something to invalidate.
		tags.push(cmsCollectionTag(event.entitySlug));

		if (event.entitySlug === "pages") {
			if (event.slug) tags.push(cmsPageTag(event.slug));
			if (event.previousSlug) tags.push(cmsPageTag(event.previousSlug));
			const routes = event.v2?.routes;
			if (routes?.current) tags.push(cmsPageTag(routes.current.slug));
			if (routes?.previous) tags.push(cmsPageTag(routes.previous.slug));
		}

		for (const dependent of event.v2?.dependents ?? []) tags.push(...dependentTags(dependent));
	}

	return [...new Set(tags.filter((tag): tag is string => tag !== null))];
}
