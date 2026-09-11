import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The CMS consumer, market by market.
 *
 * `/o-nas` was gated on `isSlovakChannel()`, so none of this could be exercised: one
 * market, one language, one bootstrap. Opening it to a second market puts three
 * questions in play that a Slovak-only route never had to answer —
 *
 *   1. does an upstream fault in a market with no approved fallback copy serve SLOVAK
 *      prose (and Slovak SEO) under a foreign URL?
 *   2. do US and CA, which share the Payload locale `en`, see each other's content?
 *      Same for DE and AT, which share `de`.
 *   3. do `generateMetadata` and the page component still agree, branch for branch?
 *
 * The route gate is mocked OPEN here on purpose. `route-policy.ts` still lists `o-nas`
 * as `sk` alone, because Payload holds no translated document yet — so this proves the
 * CONSUMER is correct and ready, not that the provider has published anything. Opening
 * it for real stays a one-line edit in `route-policy.ts` once P delivers.
 */

vi.mock("server-only", () => ({}));

// No request context in a unit test. Mocked against the real catalogues so the
// assertions below are about real strings, not placeholders.
let activeLocale = "sk-SK";
vi.mock("next-intl/server", () => ({
	getTranslations: async (namespace: string) => {
		const file = join(dirname(fileURLToPath(import.meta.url)), "../../i18n/messages", `${activeLocale}.json`);
		const messages = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>;
		return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
	},
}));

// The application-level gate, held open. See the note above.
vi.mock("@/lib/route-policy", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/route-policy")>()),
	marketHasRoute: () => true,
}));

const MARKETS = [
	{ channel: "sk-eur", locale: "sk-SK", code: "SK", marker: "SK-ONLY-MARKER" },
	{ channel: "us-usd", locale: "en-US", code: "US", marker: "US-ONLY-MARKER" },
	{ channel: "ca-cad", locale: "en-CA", code: "CA", marker: "CA-ONLY-MARKER" },
	{ channel: "de-eur", locale: "de-DE", code: "DE", marker: "DE-ONLY-MARKER" },
	{ channel: "at-eur", locale: "de-AT", code: "AT", marker: "AT-ONLY-MARKER" },
] as const;

const SHARED_MARKER = "SHARED-EVERY-MARKET";

/**
 * A rich-text body block, the shape the real document uses.
 *
 * `richText` specifically, and not `hero`: the provider contract defines
 * content-readiness as a surviving `richText` block with a non-empty Lexical body, so
 * a fixture built from heroes would be content-not-ready and would not exercise what
 * it claims to. It read as a convenient marker until the rule existed to disagree.
 */
const body = (marker: string, markets: string[] | null) => ({
	id: `b${marker.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`,
	anchorId: null,
	blockName: null,
	markets,
	blockType: "richText",
	content: {
		root: {
			type: "root",
			format: "",
			indent: 0,
			version: 1,
			children: [
				{
					type: "paragraph",
					format: "",
					indent: 0,
					version: 1,
					children: [
						{ type: "text", text: marker, format: 0, detail: 0, mode: "normal", style: "", version: 1 },
					],
				},
			],
		},
	},
});

/** One document carrying a discriminating block for every market under test. */
const document = () => ({
	docs: [
		{
			id: "018f0000-0000-7000-8000-0000000000aa",
			title: "About us from the CMS",
			slug: "o-nas",
			summary: "CMS summary",
			layout: [body(SHARED_MARKER, null), ...MARKETS.map((m) => body(m.marker, [m.code]))],
			markets: MARKETS.map((m) => m.code),
			meta: { title: "CMS meta title", description: "CMS meta description", image: null },
			updatedAt: "2026-09-10T00:00:00.000Z",
			_status: "published",
		},
	],
	totalDocs: 1,
});

function stubCms(respond: () => Promise<Response>) {
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "test-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "rotated-secret");
	const mock = vi.fn(respond);
	vi.stubGlobal("fetch", mock);
	return mock;
}

const json = (body: unknown) => async () =>
	new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

async function route() {
	return (await import("@/app/[channel]/(main)/o-nas/page")) as {
		default: (p: { params: Promise<{ channel: string }> }) => Promise<React.ReactElement>;
		generateMetadata: (p: { params: Promise<{ channel: string }> }) => Promise<{
			robots?: unknown;
			alternates?: { canonical?: string };
			title?: unknown;
			description?: unknown;
		}>;
	};
}

/** Rendered HTML, or the sentinel `NOT_FOUND` when the route called `notFound()`. */
async function render(channel: string, locale: string): Promise<string> {
	activeLocale = locale;
	const { default: Page } = await route();
	let element: React.ReactElement;
	try {
		element = await Page({ params: Promise.resolve({ channel }) });
	} catch (error) {
		if ((error as { digest?: string })?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK;404"))
			return "NOT_FOUND";
		throw error;
	}
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return new Response(stream).text();
}

beforeEach(() => {
	vi.resetModules();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("CMS consumer — one document, twelve markets", () => {
	it("gives every market the shared block", async () => {
		for (const m of MARKETS) {
			stubCms(json(document()));
			const html = await render(m.channel, m.locale);
			expect(html, `${m.code} lost the shared block`).toContain(SHARED_MARKER);
			vi.unstubAllGlobals();
		}
	});

	it("never leaks another market's block, including across a shared Payload locale", async () => {
		for (const m of MARKETS) {
			stubCms(json(document()));
			const html = await render(m.channel, m.locale);
			expect(html, `${m.code} is missing its own block`).toContain(m.marker);
			for (const other of MARKETS) {
				if (other.code === m.code) continue;
				expect(html, `${m.code} leaked ${other.code}'s block`).not.toContain(other.marker);
			}
			vi.unstubAllGlobals();
		}
	});

	// US/CA share the Payload locale `en` and DE/AT share `de`, so the raw upstream
	// response is byte-identical and legitimately shared by the fetch cache. Only the
	// post-fetch filtering separates them, which is exactly what could regress.
	it.each([
		["us-usd", "en-US", "ca-cad", "en-CA"],
		["ca-cad", "en-CA", "us-usd", "en-US"],
		["de-eur", "de-DE", "at-eur", "de-AT"],
		["at-eur", "de-AT", "de-eur", "de-DE"],
	])("%s does not see %s's content", async (channel, locale, otherChannel, otherLocale) => {
		const mine = MARKETS.find((m) => m.channel === channel)!;
		const theirs = MARKETS.find((m) => m.channel === otherChannel)!;

		stubCms(json(document()));
		await render(otherChannel, otherLocale); // warm the shared upstream response first
		const html = await render(channel, locale);

		expect(html).toContain(mine.marker);
		expect(html).not.toContain(theirs.marker);
	});
});

describe("CMS consumer — the four outcomes", () => {
	it("found: renders the CMS document", async () => {
		stubCms(json(document()));
		const html = await render("de-eur", "de-DE");
		expect(html).toContain("About us from the CMS");
		expect(html).not.toBe("NOT_FOUND");
	});

	it("not-found (unpublished): 404s and never falls back to the bootstrap", async () => {
		stubCms(json({ docs: [], totalDocs: 0 }));
		expect(await render("sk-eur", "sk-SK")).toBe("NOT_FOUND");
		vi.unstubAllGlobals();
		stubCms(json({ docs: [], totalDocs: 0 }));
		expect(await render("de-eur", "de-DE")).toBe("NOT_FOUND");
	});

	it("market-mismatch: 404s rather than serving a document meant for elsewhere", async () => {
		const doc = document();
		doc.docs[0].markets = ["SK"];
		stubCms(json(doc));
		expect(await render("de-eur", "de-DE")).toBe("NOT_FOUND");
	});

	it("error on SK: serves the approved Slovak bootstrap", async () => {
		stubCms(async () => {
			throw new Error("cms unreachable");
		});
		const html = await render("sk-eur", "sk-SK");
		expect(html).not.toBe("NOT_FOUND");
		expect(html).toContain("O nás");
		// the company block is still rendered, and in Slovak
		expect(html).toContain("Internetový obchod prevádzkuje:");
	});

	it("error on a market with no bootstrap: localised unavailable, never Slovak", async () => {
		for (const [channel, locale, expected] of [
			["de-eur", "de-DE", "Seite vorübergehend nicht verfügbar"],
			["us-usd", "en-US", "Page temporarily unavailable"],
			["ca-cad", "en-CA", "Page temporarily unavailable"],
		] as const) {
			stubCms(async () => {
				throw new Error("cms unreachable");
			});
			const html = await render(channel, locale);
			expect(html, `${channel} should show its own unavailable state`).toContain(expected);
			// the Slovak bootstrap and the Slovak static title must not appear
			expect(html, `${channel} leaked the Slovak bootstrap`).not.toContain("Internetový obchod prevádzkuje:");
			expect(html, `${channel} leaked Slovak static copy`).not.toContain("slovenský obchod s výbavou");
			vi.unstubAllGlobals();
		}
	});
});

describe("CMS consumer — metadata agrees with the page, branch for branch", () => {
	const robotsOf = (m: { robots?: unknown }) => JSON.stringify(m.robots ?? null);

	it("an authoritative absence is noindex and carries no canonical", async () => {
		stubCms(json({ docs: [], totalDocs: 0 }));
		const { generateMetadata } = await route();
		const meta = await generateMetadata({ params: Promise.resolve({ channel: "de-eur" }) });
		expect(robotsOf(meta)).toContain('"index":false');
		expect(meta.alternates?.canonical).toBeUndefined();
	});

	it("an outage with no bootstrap is noindex, so a fault cannot be indexed", async () => {
		stubCms(async () => {
			throw new Error("cms unreachable");
		});
		const { generateMetadata } = await route();
		const meta = await generateMetadata({ params: Promise.resolve({ channel: "de-eur" }) });
		expect(robotsOf(meta)).toContain('"index":false');
		expect(meta.alternates?.canonical).toBeUndefined();
		expect(JSON.stringify(meta)).not.toContain("slovenský obchod s výbavou");
	});

	it("an outage on SK keeps the bootstrap indexable, with its canonical", async () => {
		stubCms(async () => {
			throw new Error("cms unreachable");
		});
		const { generateMetadata } = await route();
		const meta = await generateMetadata({ params: Promise.resolve({ channel: "sk-eur" }) });
		expect(meta.alternates?.canonical).toContain("/sk/o-nas");
	});

	it("found: canonical is the market's own URL, never the CMS's idea of one", async () => {
		stubCms(json(document()));
		const { generateMetadata } = await route();
		const meta = await generateMetadata({ params: Promise.resolve({ channel: "ca-cad" }) });
		expect(meta.alternates?.canonical).toContain("/ca/o-nas");
	});
});

/**
 * The route's own behaviour on a content-not-ready document, using the provider's
 * fixtures verbatim — a published page, allowed in this market, whose only body block
 * belongs to the other market of a shared-locale pair.
 *
 * The contract forbids four separate things here, and each is asserted: it must not
 * render as a finished page, must not be indexable, must not be mistaken for an
 * outage, and must not be filled in with the Slovak bootstrap.
 */
describe("CMS consumer — content-not-ready is an absence, not a page", () => {
	const NEGATIVE = [
		["de-only-at-body.synthetic.json", "de-eur", "de-DE"],
		["at-only-de-body.synthetic.json", "at-eur", "de-AT"],
		["us-only-ca-body.synthetic.json", "us-usd", "en-US"],
		["ca-only-us-body.synthetic.json", "ca-cad", "en-CA"],
	] as const;

	const fixtureBody = (name: string) =>
		JSON.parse(
			readFileSync(
				join(
					dirname(fileURLToPath(import.meta.url)),
					"__fixtures__/provider-handoff-20260910/negative",
					name,
				),
				"utf8",
			),
		) as unknown;

	it.each(NEGATIVE)(
		"%s: the page 404s rather than rendering an empty shell",
		async (name, channel, locale) => {
			stubCms(json(fixtureBody(name)));
			expect(await render(channel, locale)).toBe("NOT_FOUND");
		},
	);

	it.each(NEGATIVE)("%s: metadata is noindex with no canonical", async (name, channel) => {
		stubCms(json(fixtureBody(name)));
		const { generateMetadata } = await route();
		const meta = await generateMetadata({ params: Promise.resolve({ channel }) });
		expect(JSON.stringify(meta.robots ?? null)).toContain('"index":false');
		expect(meta.alternates?.canonical).toBeUndefined();
	});

	it("is never rescued by the Slovak bootstrap, even on the Slovak-adjacent markets", async () => {
		for (const [name, channel, locale] of NEGATIVE) {
			stubCms(json(fixtureBody(name)));
			const html = await render(channel, locale);
			expect(html).toBe("NOT_FOUND");
			expect(html).not.toContain("Internetový obchod prevádzkuje:");
			vi.unstubAllGlobals();
		}
	});

	it("is distinguishable from an outage: different log, different branch", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		stubCms(json(fixtureBody("de-only-at-body.synthetic.json")));
		await render("de-eur", "de-DE");
		const lines = error.mock.calls.map((c) => String(c[0]));
		expect(lines).toContain("[cms] content-not-ready");
		expect(lines).not.toContain("[cms] unavailable-no-bootstrap");
		expect(lines).not.toContain("[cms] page-unpublished");
	});
});
