// Re-export client-safe items only
// Server code should import directly from "./server" / "./bff-server" / "./resolve-session-user"
export { AuthProvider, saleorAuthClient } from "./auth-provider";
export { ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, encodeCookieName } from "./constants";
export { loginWithBff, setPasswordWithBff } from "./bff-client";
export type { AuthApiError } from "./auth-api-types";
