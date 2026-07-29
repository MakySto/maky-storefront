import { cmsCollectionTag, cmsGlobalTag, cmsPageTag } from "./cache-tags";

/**
 * The revalidation event Payload sends after a document changes.
 *
 * The endpoint derives cache tags from the entity and slug and never accepts a tag
 * or a path from the body. A caller able to name its own path could purge anything
 * on the site, so the webhook describes *what changed* and the storefront alone
 * decides what that invalidates.
 */

export const CMS_EVENTS = ["publish", "update", "unpublish", "delete"] as const;
export type CmsEventName = (typeof CMS_EVENTS)[number];

export const CMS_ENTITY_TYPES = ["collection", "global"] as const;
export type CmsEntityType = (typeof CMS_ENTITY_TYPES)[number];

/** Only this producer is accepted; anything else is a misrouted or forged call. */
export const CMS_EVENT_SOURCE = "maky-cms";

export interface CmsRevalidateEvent {
	readonly source: typeof CMS_EVENT_SOURCE;
	readonly entityType: CmsEntityType;
	readonly entitySlug: string;
	readonly entityId: string | null;
	readonly event: CmsEventName;
	readonly locale: string | null;
	readonly slug: string | null;
	readonly previousSlug: string | null;
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
		},
	};
}

/**
 * Cache tags to invalidate for an event.
 *
 * A slug change arrives as ONE request carrying both the new `slug` and the old
 * `previousSlug`, so both are invalidated — otherwise the old URL keeps serving
 * the page from cache after it has moved.
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
		}
	}

	return [...new Set(tags.filter((tag): tag is string => tag !== null))];
}
