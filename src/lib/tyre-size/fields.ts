/**
 * The names of the form fields the product page sends about the tyre choice. The page's gate (client) and the
 * server action (`selection.ts`) must agree on these, so they live in one module both can import; a test pins the
 * list.
 *
 * `tyreAnswer` is what the shopper said about their tyres when the size's condition asked (a make or model from the
 * question, or "other"); empty when the size carries no condition.
 */
export const TYRE_FIELDS = { mode: "tyreMode", size: "tyreSize", answer: "tyreAnswer" } as const;
