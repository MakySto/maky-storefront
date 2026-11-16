import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { JWKS_RETRY_MS, JWKS_TTL_MS, __resetSaleorJwks, verifySaleorJws } from "./webhook-jws";
import { makeSaleorSigner } from "./webhook-jws.testkit";

const body = JSON.stringify({ __typename: "ProductUpdated", product: { id: "UHJvZHVjdDox", slug: "n1" } });
const bytes = (text: string) => new TextEncoder().encode(text);

const jwksResponse = (keys: unknown) => Response.json({ keys });

beforeEach(() => {
	__resetSaleorJwks();
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("Saleor webhook JWS", () => {
	it("accepts what Saleor signs, reading the key from its own JWKS", async () => {
		const signer = makeSaleorSigner();
		const fetchMock = vi.fn(async () => jwksResponse([signer.jwk]));
		vi.stubGlobal("fetch", fetchMock);

		expect(await verifySaleorJws(bytes(body), signer.signBody(body))).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.example.test/.well-known/jwks.json",
			expect.objectContaining({ cache: "no-store" }),
		);
	});

	it("signs the raw bytes: a body with non-ASCII text and exotic spacing still verifies, and one byte off does not", async () => {
		const signer = makeSaleorSigner();
		vi.stubGlobal("fetch", async () => jwksResponse([signer.jwk]));
		const odd = '{ "product" :\n{"slug":"nosič-č"}  }';

		expect(await verifySaleorJws(bytes(odd), signer.signBody(odd))).toEqual({ ok: true });
		expect(await verifySaleorJws(bytes(odd + " "), signer.signBody(odd))).toMatchObject({
			ok: false,
			kind: "invalid",
		});
	});

	it("refuses a body that was changed after signing", async () => {
		const signer = makeSaleorSigner();
		vi.stubGlobal("fetch", async () => jwksResponse([signer.jwk]));
		const header = signer.signBody(body);

		expect(await verifySaleorJws(bytes(body.replace("n1", "n2")), header)).toMatchObject({
			ok: false,
			kind: "invalid",
			reason: "signature does not match",
		});
	});

	it("refuses a signature made by another key under the same kid", async () => {
		const signer = makeSaleorSigner();
		const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
		vi.stubGlobal("fetch", async () => jwksResponse([signer.jwk]));

		expect(
			await verifySaleorJws(bytes(body), signer.signBody(body, { key: attacker.privateKey })),
		).toMatchObject({
			ok: false,
			kind: "invalid",
		});
	});

	it.each([
		["no header", null],
		["a bare hex HMAC", "a".repeat(64)],
		["a compact JWS with a payload", "aaa.bbb.ccc"],
		["garbage", "..."],
	])("refuses %s without reading any key", async (_name, header) => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		expect(await verifySaleorJws(bytes(body), header)).toMatchObject({ ok: false, kind: "invalid" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		["alg none", { alg: "none" }],
		["HS256", { alg: "HS256" }],
		["an encoded payload (b64 true)", { b64: true }],
		["a header with no b64", { b64: undefined, crit: undefined }],
		["another critical parameter", { crit: ["b64", "exp"] }],
		["no kid", { kid: undefined }],
	])("refuses a header with %s", async (_name, header) => {
		const signer = makeSaleorSigner();
		const fetchMock = vi.fn(async () => jwksResponse([signer.jwk]));
		vi.stubGlobal("fetch", fetchMock);

		expect(await verifySaleorJws(bytes(body), signer.signBody(body, { header }))).toMatchObject({
			ok: false,
			kind: "invalid",
		});
	});

	it("keeps the key for an hour and reads the JWKS again after", async () => {
		const signer = makeSaleorSigner();
		const fetchMock = vi.fn(async () => jwksResponse([signer.jwk]));
		vi.stubGlobal("fetch", fetchMock);
		const header = signer.signBody(body);

		await verifySaleorJws(bytes(body), header, 1_000);
		await verifySaleorJws(bytes(body), header, 1_000 + JWKS_TTL_MS - 1);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await verifySaleorJws(bytes(body), header, 1_000 + JWKS_TTL_MS + 1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("follows a rotated key: an unknown kid reads the JWKS once, and not more than once a minute", async () => {
		const first = makeSaleorSigner("kid-old");
		const second = makeSaleorSigner("kid-new");
		let current = [first.jwk];
		const fetchMock = vi.fn(async () => jwksResponse(current));
		vi.stubGlobal("fetch", fetchMock);

		await verifySaleorJws(bytes(body), first.signBody(body), 1_000);
		current = [second.jwk];

		const rotated = second.signBody(body);
		expect(await verifySaleorJws(bytes(body), rotated, 1_000 + JWKS_RETRY_MS + 1)).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);

		// A kid nobody holds, asked for again and again: one read a minute at most.
		const stranger = makeSaleorSigner("kid-unknown").signBody(body);
		const at = 1_000 + 2 * JWKS_RETRY_MS;
		for (let n = 0; n < 5; n++) {
			expect(await verifySaleorJws(bytes(body), stranger, at + n)).toMatchObject({
				ok: false,
				reason: "unknown kid",
			});
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("says `unavailable`, not `invalid`, when the key cannot be read, so Saleor is told to try again", async () => {
		const signer = makeSaleorSigner();
		vi.stubGlobal("fetch", async () => new Response("nope", { status: 502 }));
		expect(await verifySaleorJws(bytes(body), signer.signBody(body))).toMatchObject({
			ok: false,
			kind: "unavailable",
		});

		vi.stubGlobal("fetch", async () => {
			throw new Error("timeout");
		});
		expect(await verifySaleorJws(bytes(body), signer.signBody(body))).toMatchObject({
			ok: false,
			kind: "unavailable",
		});

		vi.unstubAllEnvs();
		vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "");
		expect(await verifySaleorJws(bytes(body), signer.signBody(body))).toMatchObject({
			ok: false,
			kind: "unavailable",
		});
	});

	it("keeps verifying with the key it holds while a refresh fails", async () => {
		const signer = makeSaleorSigner();
		vi.stubGlobal("fetch", async () => jwksResponse([signer.jwk]));
		const header = signer.signBody(body);
		await verifySaleorJws(bytes(body), header, 1_000);

		vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
		expect(await verifySaleorJws(bytes(body), header, 1_000 + JWKS_TTL_MS + 5)).toEqual({ ok: true });
	});

	it("never takes the key from the request", async () => {
		const signer = makeSaleorSigner();
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jwksResponse([signer.jwk]));
		vi.stubGlobal("fetch", fetchMock);
		const header = signer.signBody(body, {
			header: { jku: "https://evil.example/jwks.json", jwk: signer.jwk },
		});

		await verifySaleorJws(bytes(body), header);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.test/.well-known/jwks.json");
	});
});
