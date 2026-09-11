import { existsSync } from "node:fs";
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
 * Rule (2) is what keeps this guard free of deployment risk. A guard that
 * production had to opt OUT of would turn one forgotten `.env` line into a
 * silently dead add-to-cart button — the same class of failure as the
 * undefined-token wall in CLAUDE.md §4.2, and just as invisible to a passing
 * build. Instead the deployed artifact identifies itself by a file the deploy
 * script already writes (§13.2) and a rollback already restores (§13.3), so
 * production keeps writing with no configuration change at all, while a worktree
 * — which never has that file — cannot write however its environment is set.
 *
 * `MAKY_SALEOR_WRITES=block` refuses writes everywhere, production included. It is
 * for a read-only audit, not for the deployed box.
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

let deployedArtifactProbe: boolean | undefined;

/**
 * Is this process serving a build the deploy script stamped? Probed once — the
 * file cannot appear under a running server without a deploy, and a deploy
 * restarts the process.
 */
export function isDeployedProductionArtifact(): boolean {
	if (deployedArtifactProbe === undefined) {
		try {
			deployedArtifactProbe = existsSync(path.join(process.cwd(), ".next", "MAKY_DEPLOY_META"));
		} catch {
			deployedArtifactProbe = false;
		}
	}
	return deployedArtifactProbe;
}

/** Test seam — forgets the one-shot probe above. */
export function resetDeployedArtifactProbe(): void {
	deployedArtifactProbe = undefined;
}

/**
 * The decision for this process, right now.
 *
 * Both variables are read as literal `process.env.X` member expressions, exactly
 * as the transport in `graphql.ts` reads the endpoint. That is deliberate: Next
 * inlines `NEXT_PUBLIC_*` at build time by rewriting precisely that syntax, so
 * reading it any other way (`env[name]`, a destructured copy) can yield the
 * RUNTIME value while the request itself goes to the INLINED one — a guard and a
 * transport disagreeing about which Saleor they are talking to.
 */
export function saleorWriteDecision(): SaleorWriteDecision {
	return decideSaleorWrites({
		endpoint: process.env.NEXT_PUBLIC_SALEOR_API_URL,
		setting: process.env.MAKY_SALEOR_WRITES,
		isDeployedArtifact: isDeployedProductionArtifact,
	});
}
