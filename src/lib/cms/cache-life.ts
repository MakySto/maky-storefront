/**
 * How long the storefront may keep a read of a CMS page.
 *
 * `fetchCmsPage` carries `CMS_REVALIDATE_SECONDS` as the `next.revalidate` of its `fetch`, and every
 * reader that wraps that call in `"use cache"` (`availability.ts`, `published-page.ts`) declares
 * `CMS_PAGE_CACHE_LIFE` for the entry it stores, so moving a read into a cache entry does not change
 * how soon an edit whose webhook was lost shows up. It is insurance, not the mechanism: the publish
 * webhook drops the entry through its `cms:` tags (`cache-tags.ts`) the moment an editor publishes.
 *
 * `stale` and `expire` are the ones of Next's built-in `hours` profile, so a page that reads the CMS
 * keeps the router-cache and the shell lifetimes it had before.
 *
 * Kept out of `client.ts` on purpose: the cached readers import it, and a module that only holds
 * numbers can be imported by a test that replaces the client.
 */
export const CMS_REVALIDATE_SECONDS = 900;

export const CMS_PAGE_CACHE_LIFE = { stale: 300, revalidate: CMS_REVALIDATE_SECONDS, expire: 86400 } as const;
