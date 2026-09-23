import type { LanguageCodeEnum } from "@/gql/graphql";

/**
 * The Saleor language codes the twelve markets read, typed as the generated `LanguageCodeEnum`
 * without loading the module that defines it.
 *
 * `LanguageCodeEnum` is a TypeScript `enum`, so using it as a value (`LanguageCodeEnum.Sk`)
 * imports `@/gql/graphql` at runtime — the codegen output that also holds every query and
 * mutation document the storefront sends, and every Saleor enum. `config/locale.ts` did exactly
 * that, and `config/locale.ts` is imported by client components (the locale provider on every
 * page, the cart drawer, the configurator, checkout), so the whole module shipped to the
 * browser: on /sk a 114 381-byte chunk (24 709 gzipped) carrying 39 GraphQL documents, none of
 * which the browser ever sends — every query runs on the server.
 *
 * Here the enum is imported as a type only, so the compiler drops the import. The values are
 * the members' own strings, and `satisfies` checks each one against the generated member of the
 * same name: a wrong string, or a name the enum does not have, does not compile. (A plain
 * `"SK" as LanguageCodeEnum.Sk` would not do that — TypeScript accepts any string there.)
 * `language-code.test.ts` also compares every entry with the real enum at runtime, and fails if
 * this file or `config/locale.ts` gains a runtime import of `@/gql/graphql`.
 */
type MemberValues = { [Member in keyof typeof LanguageCodeEnum]: `${(typeof LanguageCodeEnum)[Member]}` };

const values = {
	Sk: "SK",
	Cs: "CS",
	De: "DE",
	DeAt: "DE_AT",
	Pl: "PL",
	Hu: "HU",
	It: "IT",
	Fr: "FR",
	Es: "ES",
	Ro: "RO",
	En: "EN",
	EnCa: "EN_CA",
} as const satisfies Partial<MemberValues>;

/** `LanguageCode.DeAt` is typed `LanguageCodeEnum.DeAt` and is the string `"DE_AT"`. */
export const LanguageCode = values as unknown as Pick<typeof LanguageCodeEnum, keyof typeof values>;
