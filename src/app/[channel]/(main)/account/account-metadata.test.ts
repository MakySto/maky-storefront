import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The sign-in, sign-up and account pages are titled in the market's language.
 *
 * Until 2026-09-26 all three had a static English `metadata` — "Sign In", "Create Account",
 * "My Account" — on every one of the twelve markets, Slovakia included.
 */

type Meta = { signInTitle: string; signUpTitle: string; accountTitle: string };
const load = (locale: string) =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as {
		account: { meta: Meta };
	};

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

// The login page reaches the session helpers, which only matter when the page renders.
vi.mock("@/lib/auth/resolve-session-user", () => ({ resolveSessionUser: vi.fn() }));

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const MARKETS = Object.values(CHANNEL_MAP);

const PAGES = [
	{ name: "login", load: () => import("../login/page"), key: "signInTitle" },
	{ name: "signup", load: () => import("../signup/page"), key: "signUpTitle" },
	{ name: "account", load: () => import("./layout"), key: "accountTitle" },
] as const;

describe.each(PAGES)("$name metadata", ({ load: loadPage, key }) => {
	it.each(MARKETS)(
		"is in the language of $saleorSlug and stays noindex, follow",
		async ({ saleorSlug, locale }) => {
			const { generateMetadata } = await loadPage();
			const metadata = await generateMetadata({ params: Promise.resolve({ channel: saleorSlug }) });

			expect(metadata.title).toBe(load(locale).account.meta[key]);
			expect(metadata.robots).toEqual({ index: false, follow: true });
		},
	);

	it("says it in Slovak on the Slovak market", async () => {
		const { generateMetadata } = await loadPage();
		const metadata = await generateMetadata({ params: Promise.resolve({ channel: "sk-eur" }) });

		expect(metadata.title).not.toMatch(/Sign In|Create Account|My Account/);
	});
});
