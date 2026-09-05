type WebhookResourceKind = "product" | "category" | "collection" | "unknown";

interface WebhookResource {
	kind: WebhookResourceKind;
	/** Current slug, when the subscription selected one. */
	slug?: string;
	/**
	 * The slug this resource had before the change.
	 *
	 * A rename leaves the OLD url serving the live resource, because only the new
	 * one gets purged. Saleor's own payload does not carry it, but the CMS side
	 * already sends it and a Saleor subscription can be asked to.
	 */
	previousSlug?: string;
	/** Saleor channel slug, when the event is channel-specific. */
	channel?: string;
	categorySlug?: string;
	/**
	 * True when the event clearly concerns a product we could not name — a media
	 * event carrying only `productId`, for instance. The listing and the sitemap
	 * still have to be refreshed even though no detail page can be targeted.
	 */
	unnamedProduct?: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const slugOf = (node: Record<string, unknown> | null): string | undefined =>
	node ? asString(node.slug) : undefined;

const previousSlugOf = (...nodes: (Record<string, unknown> | null)[]): string | undefined => {
	for (const node of nodes) {
		if (!node) continue;
		const found = asString(node.previousSlug) ?? asString(node.oldSlug);
		if (found) return found;
	}
	return undefined;
};

const channelOf = (node: Record<string, unknown> | null): string | undefined =>
	node ? asString(node.channel) ?? slugOf(asRecord(node.channel)) : undefined;

/**
 * Read a Saleor webhook body into the resource it concerns.
 *
 * This used to understand four shapes — `product`, `productVariant.product`,
 * `category`, `collection` — and fall through to `unknown` for everything else,
 * which then refreshed only `/{channel}/products`. So a corrected Slovak title
 * (`TRANSLATION_UPDATED`) and a new photograph (`PRODUCT_MEDIA_*`) stayed
 * invisible for up to the full hour, and the product's own page was never
 * touched. Those are exactly the two events a catalogue import produces most.
 */
export function parseWebhookPayload(payload: unknown): WebhookResource {
	const data = asRecord(payload);
	if (!data) return { kind: "unknown" };

	// A translation event wraps the translated resource; the interesting slug is
	// the base one, since that is what the cache key is built from.
	const translation = asRecord(data.translation);
	const media = asRecord(data.productMedia);

	const productNode =
		asRecord(data.product) ??
		asRecord(asRecord(data.productVariant)?.product) ??
		asRecord(translation?.product) ??
		asRecord(media?.product);

	if (productNode) {
		const category = asRecord(productNode.category);
		return {
			kind: "product",
			slug: slugOf(productNode),
			previousSlug: previousSlugOf(productNode, data, translation),
			channel: channelOf(productNode) ?? channelOf(data),
			categorySlug: slugOf(category),
		};
	}

	// A media event whose subscription selected only `productId`. We cannot name
	// the page, but pretending nothing happened is worse than refreshing the
	// listing and the sitemap.
	if (media) {
		return { kind: "product", unnamedProduct: true, channel: channelOf(data) };
	}

	const categoryNode = asRecord(data.category) ?? asRecord(translation?.category);
	if (categoryNode) {
		return {
			kind: "category",
			slug: slugOf(categoryNode),
			previousSlug: previousSlugOf(categoryNode, data, translation),
			channel: channelOf(data),
		};
	}

	const collectionNode = asRecord(data.collection) ?? asRecord(translation?.collection);
	if (collectionNode) {
		return {
			kind: "collection",
			slug: slugOf(collectionNode),
			previousSlug: previousSlugOf(collectionNode, data, translation),
			channel: channelOf(collectionNode) ?? channelOf(data),
		};
	}

	return { kind: "unknown" };
}
