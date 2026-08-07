/**
 * Public Payload media origin admitted by both the CMS parser and `next/image`.
 *
 * This is intentionally static deployment configuration. A provider-side
 * `MEDIA_CDN_URL` change must arrive with a new fixture pack and an accepted
 * storefront config change; it must not silently drift through an environment
 * variable at runtime.
 */
export const CMS_MEDIA_BASE_URL = "https://cms-media.maky.store/media/";
