import { cacheLife, cacheTag } from "next/cache";
import {
	CategoryNavigationDocument,
	ListingProductTypesDocument,
	type CategoryNavigationQuery,
	type CategoryNavigationNodeFragment,
} from "@/gql/graphql";
import { baseSlugForCategoryId, categoryUrlFor } from "@/config/category-routes";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { createKeptRead } from "@/lib/cache/kept-read";
import { answered, settle, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { marketHref } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";
import { getProductTypeGroups, splitProductTypes } from "./product-groups";

/**
 * Where a category sits in the tree, for its listing: the parent for the breadcrumb, and the
 * row of sub-categories — "Všetko · Nosiče bicyklov na strechu · … · Príslušenstvo k nosičom
 * bicyklov" — that lets a shopper narrow the listing by what the catalogue already knows.
 *
 * Everything here is Saleor's: the tree, the names and what each category holds in this
 * channel. Nothing is typed into the storefront, so a category CFM adds or empties shows up
 * or drops out on its own.
 */

export interface CategoryLink {
	readonly id: string;
	/** Saleor's own slug — the base slug the scenery and the cache know the category by. */
	readonly baseSlug: string;
	/** Market-prefixed URL, e.g. `/sk/nosice-bicyklov-na-strechu`. */
	readonly href: string;
	/** The name in this market's language. */
	readonly name: string;
	/** What the category holds in this channel, sub-categories included. */
	readonly count: number;
}

export interface CategoryChip extends CategoryLink {
	/**
	 * What the chip says: the name without the family's own name in front of it — "Na strechu"
	 * in the row of "Nosiče bicyklov" — or `null` for the family itself ("Všetko"). `name`
	 * stays whole, for the accessible name.
	 */
	readonly label: string | null;
	/** The page this row is on. */
	readonly current: boolean;
}

export interface CategoryNavigation {
	/** The parent, for the breadcrumb; `null` for a top-level category. */
	readonly parent: CategoryLink | null;
	/** "Všetko" first — the family's own listing — then its sub-categories. `null` = no row. */
	readonly chips: readonly CategoryChip[] | null;
}

type NavNode = CategoryNavigationNodeFragment;
type NavCategory = NavNode & {
	parent?: (NavNode & { children?: { edges: ReadonlyArray<{ node: NavNode }> } | null }) | null;
	children?: { edges: ReadonlyArray<{ node: NavNode }> } | null;
};

/**
 * The row is secondary to the listing, so no visitor waits for it longer than this, and only when the
 * process holds no answer for the category yet (`@/lib/cache/kept-read`). One attempt, never the retry ladder.
 */
const WAIT_MS = 2_000;
/** What one load may take in all: the roof-rack family counts 25 000 products in six places, 1.5 to 1.9 s. */
const LOAD_DEADLINE_MS = 8_000;
/** The counts on the chips: five minutes old is as good as new (a product event expires the cache entry, which then asks this for the answer it holds). */
const FRESH_MS = 5 * 60_000;
const PAUSE_MS = 10_000;

interface NavigationRequest {
	readonly baseSlug: string;
	readonly channel: string;
	/** The accessory product types, or `null` when the split is not known (the row then keeps Saleor's order). */
	readonly accessoryTypes: readonly string[] | null;
}

const keptNavigation = createKeptRead<NavigationRequest, CategoryNavigationQuery["category"]>({
	name: "category-navigation",
	freshMs: FRESH_MS,
	pauseMs: PAUSE_MS,
	loadDeadlineMs: LOAD_DEADLINE_MS,
	load: async ({ baseSlug, channel, accessoryTypes }, signal) => {
		const locale = getLocaleFromChannel(channel);
		const result = await executePublicGraphQL(CategoryNavigationDocument, {
			variables: {
				slug: baseSlug,
				channel,
				lang: getLocaleConfigByLocale(locale).graphqlLanguageCode,
				accessoryTypes: accessoryTypes ? [...accessoryTypes] : null,
				withAccessories: accessoryTypes !== null,
			},
			revalidate: 0,
			retry: false,
			signal,
		});
		if (!result.ok) {
			// `queueStarved`: the deadline went on waiting for a Saleor slot in this process, not on Saleor.
			const starved = result.error.queueStarved ? " [queueStarved]" : "";
			throw new Error(
				`[Listing] category navigation unavailable for ${baseSlug}: ${result.error.message}${starved}`,
			);
		}
		return result.data.category;
	},
});

const navigationKey = (baseSlug: string, channel: string) => `${channel}\u0000${baseSlug}`;

/** For tests. */
export function __forgetCategoryNavigation(): void {
	keptNavigation.forget();
}

/**
 * Reads the row of one category into the process, waiting for all of it. For the boot warm-up. It asks
 * for the product types itself (a `"use cache"` reader cannot be called from outside a render) and
 * resolves to whether the process now holds an answer.
 */
export async function prewarmCategoryNavigation(baseSlug: string, channel: string): Promise<boolean> {
	const types = await executePublicGraphQL(ListingProductTypesDocument, {
		revalidate: 3600,
		signal: AbortSignal.timeout(LOAD_DEADLINE_MS),
	});
	// Without the split the row would be ordered differently from the one a visit builds, so an answer
	// read without it is not kept: the warm-up stops here and the first visit loads it.
	if (!types.ok) return false;
	const accessoryTypes = splitProductTypes(types.data.productTypes)?.accessories ?? null;
	return keptNavigation.prewarm(navigationKey(baseSlug, channel), { baseSlug, channel, accessoryTypes });
}

/**
 * Throws on a fault to the caller, so "no row" is never taken for an answer and the page renders
 * without it. Inside the cache it is a value that is remembered for seconds only (`@/lib/cache-fault`).
 */
export async function getCategoryNavigation(baseSlug: string, channel: string): Promise<CategoryNavigation> {
	return valueOrThrow(await readCategoryNavigation(baseSlug, channel));
}

async function readCategoryNavigation(
	baseSlug: string,
	channel: string,
): Promise<CachedRead<CategoryNavigation>> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	// Without the split the sub-categories keep Saleor's order; nothing else depends on it.
	const groups = await getProductTypeGroups().catch(() => null);

	const read = await settle(() =>
		keptNavigation.read(
			navigationKey(baseSlug, channel),
			{ baseSlug, channel, accessoryTypes: groups ? groups.accessories : null },
			WAIT_MS,
		),
	);
	if (!read.ok) return read;

	const category = read.value;
	// A renamed parent or sibling changes the row as well as this category's own event does.
	for (const node of relatives(category)) {
		cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: node.slug }));
	}
	return answered(buildCategoryNavigation(category, channel, locale));
}

function relatives(category: NavCategory | null | undefined): NavNode[] {
	if (!category) return [];
	const nodes: NavNode[] = [];
	if (category.parent) {
		nodes.push(category.parent, ...(category.parent.children?.edges.map((edge) => edge.node) ?? []));
	}
	nodes.push(...(category.children?.edges.map((edge) => edge.node) ?? []));
	return nodes;
}

const productCount = (node: NavNode) => node.products?.totalCount ?? 0;

/** Holds products, and every one of them is an accessory or a spare part. */
const holdsOnlyAccessories = (node: NavNode) =>
	productCount(node) > 0 && node.accessoryProducts?.totalCount === productCount(node);

/** Pure half of `getCategoryNavigation`, exported for its test. */
export function buildCategoryNavigation(
	category: NavCategory | null | undefined,
	channel: string,
	locale: string,
): CategoryNavigation {
	if (!category) return { parent: null, chips: null };

	// The same gate the category page applies: a link here must never lead to a page that
	// answers "not found" in this market's language.
	const link = (node: NavNode): CategoryLink | null => {
		const localized = resolveExactLocaleCategory(node, locale);
		if (!localized) return null;
		return {
			id: node.id,
			baseSlug: node.slug,
			// By id where the table knows the category: abroad `localized.slug` is a translation, which can
			// be any spelling, and one the table does not list leaves the chip on `/categories/…`.
			href: marketHref(channel, categoryUrlFor(channel, baseSlugForCategoryId(node.id) ?? localized.slug)),
			name: localized.name,
			count: productCount(node),
		};
	};

	const parent = category.parent ? link(category.parent) : null;

	// A category with sub-categories of its own shows them; a leaf shows its siblings, so the
	// row stays put while the shopper moves along it.
	const ownChildren = category.children?.edges.map((edge) => edge.node) ?? [];
	const family = ownChildren.some((node) => productCount(node) > 0)
		? { root: category as NavNode, members: ownChildren }
		: category.parent
			? {
					root: category.parent as NavNode,
					members: category.parent.children?.edges.map((edge) => edge.node) ?? [],
				}
			: null;
	if (!family) return { parent, chips: null };

	const rootLink = link(family.root);
	const members = family.members
		.filter((node) => productCount(node) > 0)
		// The products a shopper came for before the accessories, as in the listing itself;
		// otherwise Saleor's order. `sort` is stable.
		.sort((a, b) => Number(holdsOnlyAccessories(a)) - Number(holdsOnlyAccessories(b)))
		.map((node) => ({ node, link: link(node) }))
		.filter((member): member is { node: NavNode; link: CategoryLink } => member.link !== null);

	// A row whose every chip lists the same products as "Všetko" narrows nothing — the
	// Nordrive roof-rack sets are all of "Strešné nosiče" — so it is left out.
	const narrows = members.some(({ node }) => productCount(node) < productCount(family.root));
	if (!rootLink || members.length === 0 || !narrows) return { parent, chips: null };

	return {
		parent,
		chips: [
			{ ...rootLink, label: null, current: family.root.id === category.id },
			...members.map(({ node, link: member }) => ({
				...member,
				label: withinFamily(member.name, rootLink.name, locale),
				current: node.id === category.id,
			})),
		],
	};
}

/**
 * The word that joins two things in each market's language. A name whose rest opens with one
 * is the second half of a pair, not a qualifier: "Strešné nosiče a koše na dodávky" in the row
 * of "Strešné nosiče" must not shrink to "A koše na dodávky".
 */
const JOINING_WORDS: ReadonlySet<string> = new Set([
	"a",
	"i",
	"und",
	"and",
	"y",
	"et",
	"e",
	"és",
	"și",
	"ve",
]);

/**
 * "Nosiče bicyklov na strechu" in the row of "Nosiče bicyklov" reads "Na strechu": the row
 * already says whose sub-categories these are. A name that does not start with the family's
 * name — "Príslušenstvo k nosičom bicyklov" — is left whole, and so is one that goes on with
 * "and …" (see `JOINING_WORDS`), which would read as a fragment.
 */
export function withinFamily(name: string, familyName: string, locale: string): string {
	const prefix = `${familyName} `;
	if (!name.toLocaleLowerCase(locale).startsWith(prefix.toLocaleLowerCase(locale))) return name;
	const rest = name.slice(prefix.length).trim();
	if (!rest) return name;
	const firstWord = rest.split(/\s+/, 1)[0].toLocaleLowerCase(locale);
	if (JOINING_WORDS.has(firstWord)) return name;
	return rest.charAt(0).toLocaleUpperCase(locale) + rest.slice(1);
}
