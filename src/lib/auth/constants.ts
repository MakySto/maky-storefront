/**
 * Auth token configuration.
 * Shared between client and server.
 */

// Token lifetimes (industry standard for e-commerce)
export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Encode storage key to be a valid cookie name.
 * The SDK uses keys like "https://api.example.com/graphql/+saleor_auth_access_token"
 * which contain invalid cookie characters (: and /). We encode these to make valid names.
 */
export const encodeCookieName = (key: string): string => {
	return key.replace(/[^a-zA-Z0-9_-]/g, "_");
};

/**
 * Decode a cookie value written by the SDK. The client storage encodes with
 * encodeURIComponent; the server storage writes raw. Best-effort — returns the raw value
 * unchanged if it is not URI-encoded.
 */
export function decodeCookieValue(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
