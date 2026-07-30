/**
 * Test-only stand-in for the `server-only` package.
 *
 * `server-only` exists to make importing a server module from a Client Component a
 * build error. It does that by throwing on import under any condition other than
 * `react-server`, and Vitest runs under plain Node — so every module carrying the
 * marker would blow up on import, and the modules that most need testing (the Payload
 * forms client, the ownership check) are exactly the ones that carry it.
 *
 * Aliasing it away in `vitest.config.ts` does NOT weaken the production guarantee. The
 * protection is enforced by Next at build time against the real package; this file is
 * never part of a build. The alternative — setting `resolve.conditions: ["react-server"]`
 * — would also change how React itself resolves, which is a much larger blast radius
 * for the same result.
 */
export {};
