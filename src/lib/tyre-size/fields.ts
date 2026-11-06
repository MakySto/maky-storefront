/**
 * The names of the form fields the product page sends about the tyre choice. The page's picker (client) and the
 * server action (`selection.ts`) must agree on these, so they live in one module both can import; a test pins the
 * list.
 */
export const TYRE_FIELDS = { mode: "tyreMode", size: "tyreSize", condition: "tyreCondition" } as const;
