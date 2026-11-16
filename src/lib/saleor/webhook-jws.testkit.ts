import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

/** A signing key and a signer that makes what Saleor 3.23 sends: a detached RS256 JWS over the raw body, `b64: false`. */
export function makeSaleorSigner(kid = "kid-1") {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const jwk = { ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };

	const signBody = (
		body: string | Uint8Array,
		overrides: { header?: Record<string, unknown>; key?: KeyObject } = {},
	): string => {
		const header = { alg: "RS256", typ: "JWT", kid, crit: ["b64"], b64: false, ...overrides.header };
		const protectedB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
		const payload = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
		const signature = sign(
			"sha256",
			Buffer.concat([Buffer.from(`${protectedB64}.`, "ascii"), payload]),
			overrides.key ?? privateKey,
		);
		return `${protectedB64}..${signature.toString("base64url")}`;
	};

	return { jwk, privateKey, signBody, jwks: () => ({ keys: [jwk] }) };
}
