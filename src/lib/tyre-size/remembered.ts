import "server-only";

import { cookies } from "next/headers";

import { decodeTyreMemory, TYRE_MEMORY_COOKIE } from "./memory";
import { isKnownTyreSize } from "./size-lookup";

/**
 * The tyre size this shopper has told the shop, or `null`.
 *
 * Read on the server, behind the same rule as the garage (`lib/garage/state.ts`): under cacheComponents a cookie
 * read inside a prerendered scope throws, and the right answer there is "nothing remembered", exactly what a
 * shopper who never said anything gets. A caller inside a prerendered shell still puts this behind its own
 * `connection()` in its own Suspense boundary; the guard here stops a crash, it does not make a static shell dynamic.
 *
 * The value is checked against the list every time: a size the list no longer holds (it is replaced when CFM sends
 * a new one), a hand-made cookie and a damaged one all read as nothing. A size is never taken on the cookie's word.
 */
export async function readRememberedTyreSize(): Promise<string | null> {
	let raw: string | undefined;
	try {
		raw = (await cookies()).get(TYRE_MEMORY_COOKIE)?.value;
	} catch {
		return null;
	}
	const size = decodeTyreMemory(raw);
	return size !== null && isKnownTyreSize(size) ? size : null;
}
