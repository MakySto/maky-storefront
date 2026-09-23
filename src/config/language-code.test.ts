import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// The REAL generated enum, as a value. A test runs on the server; this is the one place in
// `config/` allowed to load it.
import { LanguageCodeEnum } from "@/gql/graphql";
import { LanguageCode } from "./language-code";
import { LOCALE_MAP, localeConfig } from "./locale";

/**
 * `config/locale.ts` takes its Saleor language codes from `./language-code` instead of from
 * `LanguageCodeEnum`, so that the browser stops loading `@/gql/graphql` (see `language-code.ts`).
 * These tests pin the two things that change could get wrong: a code (every market must still
 * ask Saleor for exactly the member it asked for before), and the import itself (one careless
 * `import { LanguageCodeEnum }` puts the 114 KB module back into every page, and no build,
 * type check or other test notices).
 */
const EXPECTED: Record<string, LanguageCodeEnum> = {
	"sk-SK": LanguageCodeEnum.Sk,
	"cs-CZ": LanguageCodeEnum.Cs,
	"de-DE": LanguageCodeEnum.De,
	"de-AT": LanguageCodeEnum.DeAt,
	"pl-PL": LanguageCodeEnum.Pl,
	"hu-HU": LanguageCodeEnum.Hu,
	"it-IT": LanguageCodeEnum.It,
	"fr-FR": LanguageCodeEnum.Fr,
	"es-ES": LanguageCodeEnum.Es,
	"ro-RO": LanguageCodeEnum.Ro,
	"en-US": LanguageCodeEnum.En,
	"en-CA": LanguageCodeEnum.EnCa,
};

describe("the language code every locale asks Saleor for", () => {
	it("is pinned for exactly the locales LOCALE_MAP has, all twelve", () => {
		expect(Object.keys(LOCALE_MAP).sort()).toEqual(Object.keys(EXPECTED).sort());
		expect(Object.keys(LOCALE_MAP)).toHaveLength(12);
	});

	it.each(Object.keys(LOCALE_MAP))("%s reads the same member of the generated enum as before", (locale) => {
		expect(LOCALE_MAP[locale].graphqlLanguageCode).toBe(EXPECTED[locale]);
	});

	it("keeps Austria on DE_AT, Canada on EN_CA and the United States on plain EN", () => {
		expect(LOCALE_MAP["de-AT"].graphqlLanguageCode).toBe("DE_AT");
		expect(LOCALE_MAP["en-CA"].graphqlLanguageCode).toBe("EN_CA");
		expect(LOCALE_MAP["en-US"].graphqlLanguageCode).toBe("EN");
	});

	it("gives every light code the value of the generated member of the same name", () => {
		for (const [member, value] of Object.entries(LanguageCode)) {
			expect(value, member).toBe(LanguageCodeEnum[member as keyof typeof LanguageCodeEnum]);
		}
	});

	it("keeps the deprecated default export on Slovak", () => {
		expect(localeConfig.graphqlLanguageCode).toBe(LanguageCodeEnum.Sk);
	});
});

// ---------------------------------------------------------------------------
// Import guard
// ---------------------------------------------------------------------------

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = path.join(SRC, "gql") + path.sep;

type RuntimeImport = { from: string; spec: string; resolved: string | null };

const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

/** Resolve a specifier the way tsconfig `paths` does; packages resolve to null. */
function resolveSpecifier(from: string, spec: string): string | null {
	let base: string;
	if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
	else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
	else return null;
	const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, "index.ts")];
	return candidates.find(isFile) ?? base;
}

/**
 * Every import of `file` that survives compilation: not `import type`, not an import whose
 * bindings are all `type`, plus `export … from` and `import()`. Parsed, not grepped, so a
 * multi-line import cannot slip past.
 */
function runtimeImports(file: string): RuntimeImport[] {
	const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
	const found: RuntimeImport[] = [];
	const add = (spec: string) => found.push({ from: file, spec, resolved: resolveSpecifier(file, spec) });
	const visit = (node: ts.Node) => {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const clause = node.importClause;
			const typeOnly =
				clause !== undefined &&
				(clause.isTypeOnly ||
					(clause.name === undefined &&
						clause.namedBindings !== undefined &&
						ts.isNamedImports(clause.namedBindings) &&
						clause.namedBindings.elements.length > 0 &&
						clause.namedBindings.elements.every((element) => element.isTypeOnly)));
			if (!typeOnly) add(node.moduleSpecifier.text);
		} else if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			if (!node.isTypeOnly) add(node.moduleSpecifier.text);
		} else if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments[0] &&
			ts.isStringLiteral(node.arguments[0])
		) {
			add(node.arguments[0].text);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

const isGenerated = (resolved: string | null) => resolved !== null && resolved.startsWith(GENERATED);

describe("config/locale.ts does not load the generated GraphQL module at runtime", () => {
	it.each(["config/locale.ts", "config/language-code.ts"])("%s imports @/gql only as a type", (file) => {
		const leaks = runtimeImports(path.join(SRC, file)).filter((entry) => isGenerated(entry.resolved));
		expect(leaks.map((entry) => entry.spec)).toEqual([]);
	});

	it("and nothing it loads at runtime does either", () => {
		const seen = new Set<string>();
		const queue = [path.join(SRC, "config", "locale.ts")];
		const leaks: string[] = [];
		while (queue.length > 0) {
			const file = queue.shift()!;
			if (seen.has(file)) continue;
			seen.add(file);
			for (const entry of runtimeImports(file)) {
				if (entry.resolved === null) continue;
				if (isGenerated(entry.resolved)) leaks.push(`${path.relative(SRC, file)} -> ${entry.spec}`);
				else if (isFile(entry.resolved)) queue.push(entry.resolved);
			}
		}
		expect(leaks).toEqual([]);
		// The walk really ran: locale.ts loads the channel map and the light codes.
		expect([...seen].map((file) => path.relative(SRC, file))).toEqual(
			expect.arrayContaining(["config/language-code.ts", "config/locale.ts", "lib/channel-map.ts"]),
		);
	});
});
