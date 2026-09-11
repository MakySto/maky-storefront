import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * May this process put a WRITE on the wire to Saleor?
 *
 * ## Why this exists
 *
 * On 2026-09-11 an M3 walkthrough clicked "Pridať do košíka" against a local
 * `next start`. That process was configured — exactly as every handoff in
 * `docs/design/market-rollout/` tells you to configure it — with the PRODUCTION
 * `NEXT_PUBLIC_SALEOR_API_URL`. `checkoutCreate` is a real mutation, so real
 * draft `Checkout` objects now exist in the customer-facing Saleor. Nothing was
 * charged, no stock moved and no order was placed — but nothing in the code
 * stopped it either.
 *
 * `NODE_ENV` could not have stopped it. `next start` sets `NODE_ENV=production`
 * in a scratch worktree exactly as it does on the deployed box, so the mode reads
 * "production" in both. That is why the `isDummyPaymentAllowed()` pattern next
 * door (deny in production, allow in development) does not generalise to this
 * problem: for cart and checkout mutations, production is precisely the case that
 * MUST be allowed to write.
 *
 * ## The rule
 *
 * Reads are never affected — pointing a development session at production data is
 * normal, useful and safe. Only mutations are gated, and only when the endpoint is
 * the customer-facing Saleor.
 *
 * A process may write to the production endpoint when EITHER:
 *
 *  1. it says so explicitly — `MAKY_SALEOR_WRITES=allow`; or
 *  2. it is serving a build that `scripts/ops/deploy-production.sh` stamped, i.e.
 *     `$PWD/.next/MAKY_DEPLOY_META` exists.
 *
 * Rule (2) is why production needs no configuration change: a guard that
 * production had to opt OUT of would turn one forgotten `.env` line into a
 * silently dead add-to-cart button — the same class of failure as the
 * undefined-token wall in CLAUDE.md §4.2, and just as invisible to a passing
 * build. The deployed artifact identifies itself by a file the deploy script
 * already writes (§13.2) and a rollback already restores (§13.3), while a
 * worktree cannot write however its environment is set.
 *
 * `MAKY_SALEOR_WRITES=block` refuses writes everywhere, production included. It is
 * for a read-only audit, not for the deployed box.
 *
 * ## What this is NOT — do not overstate it
 *
 * **It is not "no deployment risk".** That claim was made when this landed and it
 * was wrong: the tests shipped alongside it assumed no marker under `cwd`, and the
 * deploy preflight runs `pnpm vitest run` in `/opt/storefront` while the previous
 * build's marker is still in place — so the guard's own tests would have failed
 * there and blocked the deploy. Fixed by pinning the probe in tests
 * (`setDeployedArtifactOverride`), but the lesson stands: a guard changes the
 * deploy, and the claim has to be earned by running the deploy's own checks.
 *
 * **It is not a sandbox.** Refusing a write to production is not the same as
 * having somewhere safe to write. A hostname that is merely not `api.maky.store`
 * proves nothing about which database, queues or side-effects sit behind it; a
 * real sandbox has to be supplied and verified, not inferred from a URL.
 *
 * **It does not cover every transport.** It sits on `executeGraphQL` and
 * `executeRawGraphQL`. It therefore does NOT cover `@saleor/auth-sdk`, which
 * refreshes tokens over its own fetch (`src/lib/auth/server.ts`), nor the Payload
 * forms client, the CMS client, the fitment provider or Stripe — each has its own
 * fetch. Those need their own answer; do not read this guard as blanket coverage.
 * For a read-only walkthrough, keep an independent network block in place as well.
 */

/** Hosts that serve the real, customer-facing Saleor. */
const PRODUCTION_SALEOR_HOSTNAMES: readonly string[] = ["api.maky.store"];

/** The environment variable that decides. Three states: `allow`, `block`, unset. */
export const SALEOR_WRITES_ENV = "MAKY_SALEOR_WRITES";

export type SaleorWriteAllowReason = "explicit-allow" | "deployed-artifact" | "non-production-endpoint";

export type SaleorWriteDecision =
	| { readonly allowed: true; readonly because: SaleorWriteAllowReason }
	| { readonly allowed: false; readonly reason: string };

/**
 * Is this endpoint the customer-facing Saleor?
 *
 * Compared on hostname, so a port or a path cannot disguise it, and an
 * unparseable value is not production (the executor will fail on it anyway).
 */
export function isProductionSaleorEndpoint(endpoint: string | undefined | null): boolean {
	if (!endpoint) return false;
	try {
		return PRODUCTION_SALEOR_HOSTNAMES.includes(new URL(endpoint).hostname.toLowerCase());
	} catch {
		return false;
	}
}

export interface WritePolicyInputs {
	readonly endpoint: string | undefined | null;
	/** Raw `MAKY_SALEOR_WRITES`. */
	readonly setting: string | undefined | null;
	/** Lazy: only probed when the answer can still change the decision. */
	readonly isDeployedArtifact: () => boolean;
}

/** The decision itself, with no I/O and no environment access — the testable core. */
export function decideSaleorWrites(inputs: WritePolicyInputs): SaleorWriteDecision {
	const setting = inputs.setting?.trim().toLowerCase();

	if (setting === "block") {
		return {
			allowed: false,
			reason: `${SALEOR_WRITES_ENV}=block refuses every Saleor write in this process.`,
		};
	}
	if (setting === "allow") {
		return { allowed: true, because: "explicit-allow" };
	}
	// Any other value is NOT read as permission. Falling through to the inference
	// below can only ever refuse a write to production, which is the safe direction
	// for a typo.

	if (!isProductionSaleorEndpoint(inputs.endpoint)) {
		return { allowed: true, because: "non-production-endpoint" };
	}
	if (inputs.isDeployedArtifact()) {
		return { allowed: true, because: "deployed-artifact" };
	}

	return {
		allowed: false,
		reason:
			"refusing a write to the production Saleor from a process that is not the deployed storefront. " +
			"Point NEXT_PUBLIC_SALEOR_API_URL at a sandbox, or set " +
			`${SALEOR_WRITES_ENV}=allow if you genuinely mean to write to production.`,
	};
}

/**
 * Does this directory hold a build that the deploy script stamped AS ITSELF?
 *
 * Not `existsSync`. A path test proves only that a file is there: an empty file,
 * or a `MAKY_DEPLOY_META` copied from the real box into a scratch tree, would
 * have satisfied it and handed a test process production write authority. So the
 * marker has to agree with the build sitting next to it — `build_id=` must match
 * `.next/BUILD_ID`.
 *
 * That is safe for production by construction, not by hope: `write_meta()` in
 * `scripts/ops/deploy-production.sh` writes `build_id=$(cat $APP_DIR/.next/BUILD_ID)`,
 * and the live box was checked before this was added (both read
 * `buJZ-9DFbOKS9s5akP4-n`). A rollback restores the pair together, so it stays true.
 *
 * Exported with an explicit root so the real filesystem behaviour can be tested
 * against temporary directories instead of whatever directory the test runner
 * happens to start in.
 */
export function deployMarkerAuthorises(root: string): boolean {
	try {
		const declared = /^build_id=(.*)$/m.exec(
			readFileSync(path.join(root, ".next", "MAKY_DEPLOY_META"), "utf8"),
		);
		const declaredId = declared?.[1]?.trim();
		if (!declaredId) return false; // empty or malformed marker proves nothing
		const actualId = readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim();
		return actualId.length > 0 && actualId === declaredId;
	} catch {
		return false;
	}
}

let probeCache: boolean | undefined;
let probeOverride: boolean | undefined;

/**
 * Is this process serving a build the deploy script stamped? Probed once — the
 * marker cannot appear under a running server without a deploy, and a deploy
 * restarts the process.
 */
export function isDeployedProductionArtifact(): boolean {
	if (probeOverride !== undefined) return probeOverride;
	if (probeCache === undefined) probeCache = deployMarkerAuthorises(process.cwd());
	return probeCache;
}

/**
 * Test seam. Pin the probe so a test's expectation never depends on the directory
 * the runner was started in.
 *
 * This is not pedantry: the deploy preflight runs `pnpm vitest run` in
 * `/opt/storefront` while the OLD build — marker and all — is still in place
 * (`snapshot` only moves `.next` aside later). A test that assumed "no marker
 * under cwd" therefore passed in a worktree and FAILED in preflight, which would
 * have blocked the deploy. Pass `undefined` to restore real probing.
 */
export function setDeployedArtifactOverride(value: boolean | undefined): void {
	probeOverride = value;
	probeCache = undefined;
}

/** Test seam — forgets the one-shot probe above. */
export function resetDeployedArtifactProbe(): void {
	probeCache = undefined;
	probeOverride = undefined;
}

/**
 * The decision for this process, right now.
 *
 * Both variables are read as literal `process.env.X` member expressions, exactly
 * as the transport in `graphql.ts` reads the endpoint. That is deliberate: Next
 * inlines `NEXT_PUBLIC_*` at build time by rewriting precisely that syntax —
 * measured in this build, 26 inlined literals and 0 runtime reads — so reading it
 * any other way (`env[name]`, a destructured copy) yields the RUNTIME value while
 * the request goes to the INLINED one: a guard and a transport disagreeing about
 * which Saleor they are talking to. `MAKY_SALEOR_WRITES` is deliberately not
 * `NEXT_PUBLIC_`, so it stays a runtime read and a restart can change it.
 */
export function saleorWriteDecision(): SaleorWriteDecision {
	return decideSaleorWrites({
		endpoint: process.env.NEXT_PUBLIC_SALEOR_API_URL,
		setting: process.env.MAKY_SALEOR_WRITES,
		isDeployedArtifact: isDeployedProductionArtifact,
	});
}
