import { INTERNAL_TOKEN_HEADER, internalLoopbackToken } from "@/lib/internal-token";

/**
 * The proxy asking the app whether a vehicle category address has a page (`vehicle-page-outcome.ts`).
 *
 * Why a loopback and not a read of the catalogue in the proxy: the decision has to be the page's own
 * (`resolveVehiclePath`, the publication gate, the retired-page successor), and those need the loaded
 * catalogue view — nine megabytes per language, memoised in the app's process. See `lib/bot-preflight.ts`,
 * whose mechanism this repeats, for the same reasoning at length.
 *
 * Fail open, except on proof: only an explicit `absent` becomes a 404 and an explicit `redirect` a 301.
 * A loopback that could not be made, a timeout, an `undetermined` or a malformed body is `skipped`, and the
 * request goes on to the page exactly as before this existed. A defect here must never be able to take
 * vehicle pages off the site.
 */
export type VehiclePagePreflight =
	| { readonly verdict: "found" | "absent"; readonly ms: number }
	| { readonly verdict: "redirect"; readonly href: string; readonly ms: number }
	| { readonly verdict: "skipped"; readonly reason: string; readonly ms: number };

export const VEHICLE_PAGE_PATH = "/api/internal/vehicle-page";

/** Past this the page is served as before; the first request after a start also loads the catalogue. */
export const VEHICLE_PAGE_TIMEOUT_MS = 2_500;

/** The kill switch: `MAKY_VEHICLE_PAGE_GATE=off` turns it off with a restart, no deploy. */
export function isVehiclePageGateEnabled(): boolean {
	return process.env.MAKY_VEHICLE_PAGE_GATE?.trim().toLowerCase() !== "off";
}

export interface VehiclePagePreflightOptions {
	readonly port?: string | undefined;
	readonly fetchImpl?: typeof fetch;
	readonly timeoutMs?: number;
	readonly token?: string;
	readonly now?: () => number;
}

/**
 * A short memory of what was answered, so a crawler walking the catalogue costs the app one decision per
 * address per half minute, not one per hit. Only definite answers are kept (never a skip), the key space
 * is bounded (an attacker's random paths cannot grow it), and a page published or retired is seen within
 * the TTL.
 */
const MEMO_TTL_MS = 30_000;
const MEMO_MAX = 2_000;
const memo = new Map<string, { at: number; answer: VehiclePagePreflight }>();

/** For tests: forget everything remembered. */
export function __resetVehiclePageMemo(): void {
	memo.clear();
}

export async function preflightVehiclePage(
	channel: string,
	categorySlug: string,
	segments: readonly string[],
	options: VehiclePagePreflightOptions = {},
): Promise<VehiclePagePreflight> {
	const key = `${channel}|${categorySlug}|${segments.join("/")}`;
	const wall = Date.now();
	const remembered = memo.get(key);
	if (remembered && wall - remembered.at < MEMO_TTL_MS) return { ...remembered.answer, ms: 0 };
	const answer = await ask(channel, categorySlug, segments, options);
	if (answer.verdict !== "skipped") {
		if (memo.size >= MEMO_MAX) memo.clear();
		memo.set(key, { at: wall, answer });
	}
	return answer;
}

async function ask(
	channel: string,
	categorySlug: string,
	segments: readonly string[],
	options: VehiclePagePreflightOptions,
): Promise<VehiclePagePreflight> {
	const now = options.now ?? (() => performance.now());
	const started = now();
	const ms = () => Math.round(now() - started);
	const skipped = (reason: string): VehiclePagePreflight => ({ verdict: "skipped", reason, ms: ms() });

	const port = "port" in options ? options.port : process.env.PORT;
	if (!port || !/^\d{1,5}$/.test(port)) return skipped("no-port");

	const url = new URL(`http://127.0.0.1:${port}${VEHICLE_PAGE_PATH}`);
	url.searchParams.set("channel", channel);
	url.searchParams.set("category", categorySlug);
	url.searchParams.set("path", segments.join("/"));

	try {
		const response = await (options.fetchImpl ?? fetch)(url, {
			headers: { [INTERNAL_TOKEN_HEADER]: options.token ?? internalLoopbackToken() },
			signal: AbortSignal.timeout(options.timeoutMs ?? VEHICLE_PAGE_TIMEOUT_MS),
			cache: "no-store",
			// Never followed: a redirect means something else answered, and the token would go with it.
			redirect: "manual",
		});
		if (!response.ok) return skipped(`http-${response.status}`);

		const body: unknown = await response.json();
		const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
		if (record.status === "found" || record.status === "absent") {
			return { verdict: record.status, ms: ms() };
		}
		if (record.status === "redirect") {
			// Only a path of this site: the answer names where a page went, never another host.
			const href = typeof record.href === "string" ? record.href : "";
			return /^\/(?!\/)/.test(href) ? { verdict: "redirect", href, ms: ms() } : skipped("malformed");
		}
		return skipped(record.status === "undetermined" ? "undetermined" : "malformed");
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		return skipped(name === "TimeoutError" || name === "AbortError" ? "timeout" : "transport");
	}
}
