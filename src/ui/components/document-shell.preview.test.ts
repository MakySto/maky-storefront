import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/font and next/script only work inside a Next build; stand-ins that keep what matters
// here — which scripts the document asks for — visible in the markup.
vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "font-geist-sans" } }));
vi.mock("next/script", () => ({
	default: (props: { id?: string; src?: string }) =>
		createElement("script", { id: props.id, "data-src": props.src }),
}));

const draft = vi.hoisted(() => ({ isEnabled: false }));
vi.mock("next/headers", () => ({
	draftMode: async () => ({ isEnabled: draft.isEnabled, enable: () => undefined, disable: () => undefined }),
	cookies: async () => ({ get: () => undefined }),
}));

/**
 * No analytics during a CMS draft preview (`preview-v1.md`, „Súkromie a cache“): no tag
 * manager — so no GA4 and no Ads — and no Cloudflare beacon while Draft Mode is on. Outside a
 * preview the document is exactly what it was.
 */

async function renderShell(): Promise<string> {
	const { DocumentShell } = await import("./document-shell");
	// Children as an argument, not a prop (react/no-children-prop); the cast only relaxes the
	// props type so `createElement` accepts them that way.
	const Shell = DocumentShell as (props: { lang: string; children?: ReactNode }) => ReactNode;
	const stream = await renderToReadableStream(
		createElement(Shell, { lang: "sk-SK" }, createElement("main", null, "OBSAH-STRANKY")),
	);
	await stream.allReady;
	return new Response(stream).text();
}

const ANALYTICS = [
	'id="maky-consent-default"',
	'id="maky-gtm"',
	'id="cf-web-analytics"',
	"googletagmanager.com/ns.html",
];

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-FAKE000");
	vi.stubEnv("NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN", "fake-cf-beacon-token");
});

afterEach(() => {
	vi.unstubAllEnvs();
	draft.isEnabled = false;
});

describe("DocumentShell and analytics", () => {
	it("loads the tag manager and the beacon outside a preview", async () => {
		const html = await renderShell();
		for (const marker of ANALYTICS) expect(html, marker).toContain(marker);
	});

	it("loads none of them while Draft Mode is on, and still renders the page", async () => {
		draft.isEnabled = true;
		const html = await renderShell();
		for (const marker of ANALYTICS) expect(html, marker).not.toContain(marker);
		expect(html).toContain("OBSAH-STRANKY");
		expect(html).toContain('lang="sk-SK"');
	});
});
