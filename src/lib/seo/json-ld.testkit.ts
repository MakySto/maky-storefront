/**
 * Test helper: every `application/ld+json` block in a piece of server-rendered markup,
 * parsed back from the HTML — the form a crawler actually receives, not the objects the
 * builders return.
 */
export function jsonLdBlocks(html: string): Record<string, unknown>[] {
	return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
		(match) => JSON.parse(match[1]!) as Record<string, unknown>,
	);
}
