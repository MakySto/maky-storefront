import { describe, expect, it, vi } from "vitest";

// `to-typed-document` imports "server-only", which throws when imported outside a
// react-server graph (i.e. in this node test). Stub it to a no-op.
vi.mock("server-only", () => ({}));

import { CheckoutDocument, OrderDocument } from "@/checkout/graphql";
import { toTypedDocument } from "./to-typed-document";

/** Names of `fragment X on Y { … }` definitions in a printed query. */
function fragmentDefinitionNames(query: string): string[] {
	return [...query.matchAll(/\bfragment\s+([A-Za-z_]\w*)\s+on\b/g)].map((m) => m[1]);
}

/** Names referenced via `...X` fragment spreads (inline `... on Type` is excluded — has a space). */
function referencedFragmentNames(query: string): Set<string> {
	return new Set([...query.matchAll(/\.\.\.([A-Za-z_]\w*)/g)].map((m) => m[1]));
}

function printed(document: Parameters<typeof toTypedDocument>[0]): string {
	return toTypedDocument(document).toString();
}

describe("toTypedDocument fragment de-duplication", () => {
	it("emits each fragment definition exactly once for the order query (Money was duplicated ×2)", () => {
		const query = printed(OrderDocument);
		const names = fragmentDefinitionNames(query);

		// No fragment name appears more than once (the bug: `There can only be one fragment named …`).
		expect(names.length).toBe(new Set(names).size);
		expect(names.filter((n) => n === "Money")).toEqual(["Money"]);
	});

	it("emits each fragment definition exactly once for the checkout query (Money was duplicated ×3)", () => {
		const query = printed(CheckoutDocument);
		const names = fragmentDefinitionNames(query);

		expect(names.length).toBe(new Set(names).size);
		expect(names.filter((n) => n === "Money")).toEqual(["Money"]);
		// The operation itself survives the dedupe.
		expect(query).toMatch(/query checkout\(/);
	});

	it("drops NO referenced fragment — every `...Spread` still has a definition (completeness)", () => {
		for (const document of [OrderDocument, CheckoutDocument]) {
			const query = printed(document);
			const defined = new Set(fragmentDefinitionNames(query));
			for (const referenced of referencedFragmentNames(query)) {
				expect(defined.has(referenced)).toBe(true);
			}
			// And the full expected fragment set is present (guards against over-eager dedupe).
			expect(defined.size).toBeGreaterThanOrEqual(referencedFragmentNames(query).size);
		}
	});
});
