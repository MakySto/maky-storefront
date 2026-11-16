type WebhookResourceKind = "product" | "category" | "collection" | "menu" | "attribute" | "unknown";

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
	/** The parent of the category (the event's own for `category`, the product's for `product`). */
	parentCategorySlug?: string;
	/** The collections a product event lists, which a product joining or leaving one changes. */
	collectionSlugs?: string[];
	/**
	 * True when the event clearly concerns a product we could not name — a media
	 * event carrying only `productId`, for instance. The listing and the sitemap
	 * still have to be refreshed even though no detail page can be targeted.
	 */
	unnamedProduct?: boolean;
	/**
	 * The GraphQL type of the event (`ProductUpdated`, `ProductVariantOutOfStock`, …), when the subscription
	 * selected `__typename`. Absent when it did not, and then nothing is known of what changed.
	 */
	eventType?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const slugOf = (node: Record<string, unknown> | null): string | undefined =>
	node ? asString(node.slug) : undefined;

const slugsOf = (value: unknown): string[] =>
	Array.isArray(value)
		? value.flatMap((item) => {
				const slug = slugOf(asRecord(item));
				return slug ? [slug] : [];
			})
		: [];

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
	const eventType = asString(data.__typename);
	const withType = (resource: WebhookResource): WebhookResource =>
		eventType ? { ...resource, eventType } : resource;

	// A translation event wraps the translated resource; the interesting slug is
	// the base one, since that is what the cache key is built from.
	const translation = asRecord(data.translation);
	const media = asRecord(data.productMedia);

	const productNode =
		asRecord(data.product) ??
		asRecord(asRecord(data.productVariant)?.product) ??
		// `ProductVariantDiscountedPriceUpdated` names its variant `discountedVariant` (the subscription aliases it).
		asRecord(asRecord(data.discountedVariant)?.product) ??
		asRecord(translation?.product) ??
		asRecord(media?.product);

	if (productNode) {
		const category = asRecord(productNode.category);
		const collectionSlugs = slugsOf(productNode.collections);
		return withType({
			kind: "product",
			slug: slugOf(productNode),
			previousSlug: previousSlugOf(productNode, data, translation),
			channel: channelOf(productNode) ?? channelOf(data),
			categorySlug: slugOf(category),
			parentCategorySlug: slugOf(asRecord(category?.parent)),
			...(collectionSlugs.length > 0 ? { collectionSlugs } : {}),
		});
	}

	// A media event whose subscription selected only `productId`. We cannot name
	// the page, but pretending nothing happened is worse than refreshing the
	// listing and the sitemap.
	if (media) {
		return withType({ kind: "product", unnamedProduct: true, channel: channelOf(data) });
	}

	// A translation as the Saleor subscription selects it: the translated fields next to
	// `translatableContent`, which names the object by its BASE slug (the translated slug sits on the
	// translation itself and is not what any cache key is built from).
	const content = asRecord(translation?.translatableContent);
	const translatedKind = asString(translation?.__typename);
	if (content && translatedKind) {
		const base = asString(content.slug);
		if (translatedKind === "ProductTranslation") {
			return withType(base ? { kind: "product", slug: base } : { kind: "product", unnamedProduct: true });
		}
		if (translatedKind === "CategoryTranslation" && base) return withType({ kind: "category", slug: base });
		if (translatedKind === "CollectionTranslation" && base)
			return withType({ kind: "collection", slug: base });
		if (translatedKind === "MenuItemTranslation") return withType({ kind: "menu" });
		// A variant translation names no product: it is an event we cannot place.
		return withType({ kind: "unknown" });
	}

	const categoryNode = asRecord(data.category) ?? asRecord(translation?.category);
	if (categoryNode) {
		return withType({
			kind: "category",
			slug: slugOf(categoryNode),
			previousSlug: previousSlugOf(categoryNode, data, translation),
			channel: channelOf(data),
			parentCategorySlug: slugOf(asRecord(categoryNode.parent)),
		});
	}

	const collectionNode = asRecord(data.collection) ?? asRecord(translation?.collection);
	if (collectionNode) {
		return withType({
			kind: "collection",
			slug: slugOf(collectionNode),
			previousSlug: previousSlugOf(collectionNode, data, translation),
			channel: channelOf(collectionNode) ?? channelOf(data),
		});
	}

	// Navigation: a menu or one of its items (`navigation:` and `footer-menu:` read them).
	if (asRecord(data.menu) || asRecord(data.menuItem)) return withType({ kind: "menu" });

	// Attributes and their values (the filters, the brand names): the entries that print them expire on their own.
	if (asRecord(data.attribute) || asRecord(data.attributeValue)) return withType({ kind: "attribute" });

	return withType({ kind: "unknown" });
}
