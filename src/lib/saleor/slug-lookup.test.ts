import { describe, expect, it, vi } from "vitest";
import { LanguageCodeEnum } from "@/gql/graphql";
import type { GraphQLResult } from "@/lib/graphql";
import { lookupBySlug } from "./slug-lookup";

/**
 * The catalogue these tests describe is the one Saleor actually holds today:
 * every product and category has a base slug and NO translation row at all.
 *
 * The regression being locked down is a release base that sent
 * `slugLanguageCode` unconditionally. Because Saleor matches that argument
 * against the translation table only — never falling back to the base slug —
 * every PDP and every category resolved to null, Slovak included.
 */

type Data = { product: { id: string; slug: string } | null };

const found = (slug: string): GraphQLResult<Data> => ({ ok: true, data: { product: { id: "p1", slug } } });
const missing: GraphQLResult<Data> = { ok: true, data: { product: null } };
const fault: GraphQLResult<Data> = {
	ok: false,
	error: { type: "network", message: "socket hang up", isRetryable: true },
} as GraphQLResult<Data>;

const pick = (data: Data) => data.product;

describe("lookupBySlug", () => {
	describe("with an empty translation table — today's live catalogue", () => {
		it("resolves a source-locale product from its base slug", async () => {
			const run = vi.fn(async (slugLang: LanguageCodeEnum | null) =>
				slugLang === null ? found("stresny-box-639901") : missing,
			);

			const result = await lookupBySlug("sk-SK", pick, run);

			expect(result.ok && result.data.product?.slug).toBe("stresny-box-639901");
		});

		it("asks the source locale exactly once — no second round trip", async () => {
			const run = vi.fn(async () => found("stresny-box-639901"));

			await lookupBySlug("sk-SK", pick, run);

			expect(run).toHaveBeenCalledTimes(1);
			expect(run).toHaveBeenCalledWith(null);
		});

		it("never sends slugLanguageCode for the source locale, even on a miss", async () => {
			const run = vi.fn(async () => missing);

			const result = await lookupBySlug("sk-SK", pick, run);

			expect(run).toHaveBeenCalledTimes(1);
			expect(run).toHaveBeenCalledWith(null);
			expect(result.ok && result.data.product).toBeNull();
		});

		it("resolves a foreign-locale product from the base slug it still links to", async () => {
			// de-DE, no German translation yet: the outgoing link is still the base
			// slug, so the base attempt has to answer.
			const run = vi.fn(async (slugLang: LanguageCodeEnum | null) =>
				slugLang === null ? found("stresny-box-639901") : missing,
			);

			const result = await lookupBySlug("de-DE", pick, run);

			expect(run).toHaveBeenCalledTimes(1);
			expect(result.ok && result.data.product?.slug).toBe("stresny-box-639901");
		});
	});

	describe("once translations exist", () => {
		it("falls through to the translated slug when the base slug is not one", async () => {
			const run = vi.fn(async (slugLang: LanguageCodeEnum | null) =>
				slugLang === LanguageCodeEnum.De ? found("dachbox-639901") : missing,
			);

			const result = await lookupBySlug("de-DE", pick, run);

			expect(run).toHaveBeenNthCalledWith(1, null);
			expect(run).toHaveBeenNthCalledWith(2, LanguageCodeEnum.De);
			expect(result.ok && result.data.product?.slug).toBe("dachbox-639901");
		});

		it("sends de-AT the German language code — one German row serves both", async () => {
			const run = vi.fn(async (slugLang: LanguageCodeEnum | null) =>
				slugLang === LanguageCodeEnum.De ? found("dachbox-639901") : missing,
			);

			await lookupBySlug("de-AT", pick, run);

			expect(run).toHaveBeenNthCalledWith(2, LanguageCodeEnum.De);
		});

		it("reports an authoritative miss when neither slug matches", async () => {
			const run = vi.fn(async () => missing);

			const result = await lookupBySlug("de-DE", pick, run);

			expect(run).toHaveBeenCalledTimes(2);
			expect(result.ok && result.data.product).toBeNull();
		});
	});

	describe("a fault is never an absence", () => {
		it("does not ask the second question after a failed base attempt", async () => {
			const run = vi.fn(async () => fault);

			const result = await lookupBySlug("de-DE", pick, run);

			expect(run).toHaveBeenCalledTimes(1);
			expect(result.ok).toBe(false);
		});

		it("reports the fault when the translated attempt fails, not the base miss", async () => {
			// The two attempts ask different questions. Returning the base attempt's
			// authoritative miss here would turn "we could not find out" into "this
			// does not exist" — which the existence gate would serve as a hard 404.
			const run = vi.fn(async (slugLang: LanguageCodeEnum | null) => (slugLang === null ? missing : fault));

			const result = await lookupBySlug("de-DE", pick, run);

			expect(result.ok).toBe(false);
		});

		it("hands a data-less success straight back, unretried", async () => {
			// `{ok:true, data:null}` is a contract violation, not an answer.
			// `toOutcome` turns it into an upstream error; asking again would only
			// risk converting it into an absence on the second attempt.
			const dataless = { ok: true, data: null } as unknown as GraphQLResult<Data>;
			const run = vi.fn(async () => dataless);

			const result = await lookupBySlug("de-DE", pick, run);

			expect(run).toHaveBeenCalledTimes(1);
			expect(result).toBe(dataless);
		});
	});
});
