import { describe, expect, it } from "vitest";
import { type InlineNode, parseInline, safeInternalPath, withMarketPrefix } from "./inline";

const textOf = (nodes: readonly InlineNode[]): string =>
	nodes.map((n) => (n.kind === "text" ? n.value : textOf(n.children))).join("");

describe("safeInternalPath", () => {
	it("accepts the shape the export actually uses", () => {
		expect(safeInternalPath("/stresne-nosice/bmw")).toBe("/stresne-nosice/bmw");
	});

	it("refuses every scheme, including the ones that look harmless", () => {
		for (const href of [
			"javascript:alert(1)",
			"data:text/html,x",
			"https://evil.test/x",
			"mailto:a@b.test",
		]) {
			expect(safeInternalPath(href), href).toBeNull();
		}
	});

	it("refuses a protocol-relative URL, which merely looks like a path", () => {
		expect(safeInternalPath("//evil.test/x")).toBeNull();
	});

	it("refuses smuggling through whitespace", () => {
		expect(safeInternalPath("/ok path")).toBeNull();
	});
});

describe("safeInternalPath refuses control characters", () => {
	const TAB = String.fromCharCode(9);
	const NUL = String.fromCharCode(0);
	const NEWLINE = String.fromCharCode(10);

	it("refuses a control character inside the path", () => {
		expect(safeInternalPath("/ok" + NUL + "/x")).toBeNull();
		expect(safeInternalPath("/ok" + NEWLINE + "/x")).toBeNull();
	});

	it("trims leading whitespace to a PATH, which is harmless, not to a scheme", () => {
		// Worth pinning rather than asserting a refusal: after trimming, this is
		// "/javascript:alert(1)" — a same-origin PATH. A browser navigates to it and
		// gets a 404; no script runs, because the value never starts a scheme. The
		// dangerous shape is a bare "javascript:", which is refused above.
		expect(safeInternalPath(TAB + "/javascript:alert(1)")).toBe("/javascript:alert(1)");
		expect(safeInternalPath(TAB + "javascript:alert(1)")).toBeNull();
	});

	it("refuses an entity-encoded value that is not a path once decoded", () => {
		expect(safeInternalPath("&#39;/x")).toBeNull();
	});
});

describe("parseInline", () => {
	const kindsIn = (nodes: readonly InlineNode[], seen = new Set<string>()): Set<string> => {
		for (const n of nodes) {
			seen.add(n.kind);
			if (n.kind !== "text") kindsIn(n.children, seen);
		}
		return seen;
	};

	it("returns plain text unchanged", () => {
		expect(parseInline("Priecniky na T-Roc.")).toEqual([{ kind: "text", value: "Priecniky na T-Roc." }]);
	});

	it("parses a link the export really contains", () => {
		expect(parseInline('Pozrite <a href="/stresne-nosice/bmw">BMW</a> dalej.')).toEqual([
			{ kind: "text", value: "Pozrite " },
			{ kind: "link", href: "/stresne-nosice/bmw", children: [{ kind: "text", value: "BMW" }] },
			{ kind: "text", value: " dalej." },
		]);
	});

	it("parses bold", () => {
		expect(parseInline("<b>Prsty prejdu</b>")).toEqual([
			{ kind: "bold", children: [{ kind: "text", value: "Prsty prejdu" }] },
		]);
	});

	it("keeps the words but drops the link when the href is refused", () => {
		expect(parseInline('<a href="javascript:alert(1)">klik</a>')).toEqual([{ kind: "text", value: "klik" }]);
	});

	it("turns injected markup into visible text, never into structure", () => {
		for (const raw of [
			"<script>alert(1)</script>",
			"<img src=x onerror=alert(1)>",
			'<iframe src="https://evil.test"></iframe>',
			"<svg/onload=alert(1)>",
		]) {
			const nodes = parseInline(raw);
			expect(
				[...kindsIn(nodes)].every((k) => k === "text" || k === "link" || k === "bold"),
				raw,
			).toBe(true);
			expect(textOf(nodes), raw).toContain("<");
		}
	});

	it("keeps a link's text and never carries an event attribute through", () => {
		const nodes = parseInline('<a href="/stresne-nosice/bmw" onclick="alert(1)">BMW</a>');
		expect(textOf(nodes)).toBe("BMW");
		expect(JSON.stringify(nodes)).not.toContain("onclick");
	});

	it("survives a stray or unterminated tag without swallowing content", () => {
		expect(textOf(parseInline("a </b> b"))).toBe("a </b> b");
		expect(textOf(parseInline('<a href="/x">unterminated'))).toBe("unterminated");
	});

	it("decodes the entities the export uses", () => {
		expect(textOf(parseInline("5&nbsp;kg &amp; viac"))).toBe("5 kg & viac");
	});
});

describe("withMarketPrefix", () => {
	it("adds the market once", () => {
		expect(withMarketPrefix("/stresne-nosice/bmw", "sk")).toBe("/sk/stresne-nosice/bmw");
	});

	it("does not double-prefix an already prefixed path", () => {
		expect(withMarketPrefix("/sk/stresne-nosice/bmw", "sk")).toBe("/sk/stresne-nosice/bmw");
	});

	it("does not treat a look-alike segment as the prefix", () => {
		expect(withMarketPrefix("/skoda/x", "sk")).toBe("/sk/skoda/x");
	});
});
