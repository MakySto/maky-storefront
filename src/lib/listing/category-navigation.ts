import { cacheLife, cacheTag } from "next/cache";
import { CategoryNavigationDocument, type CategoryNavigationNodeFragment } from "@/gql/graphql";
import { categoryUrlFor } from "@/config/category-routes";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { marketHref } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";
import { getProductTypeGroups } from "./product-groups";

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
	/** Market-prefixed URL, e.g. `/sk/categories/nosice-bicyklov-na-strechu`. */
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

/** The row is secondary to the listing: one attempt with a deadline, never the retry ladder. */
const NAVIGATION_DEADLINE_MS = 2_000;

export async function getCategoryNavigation(baseSlug: string, channel: string): Promise<CategoryNavigation> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	// Without the split the sub-categories keep Saleor's order; nothing else depends on it.
	const groups = await getProductTypeGroups().catch(() => null);

	const result = await executePublicGraphQL(CategoryNavigationDocument, {
		variables: {
			slug: baseSlug,
			channel,
			lang,
			accessoryTypes: groups ? [...groups.accessories] : null,
			withAccessories: groups !== null,
		},
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(NAVIGATION_DEADLINE_MS),
	});
	if (!result.ok) {
		// Thrown, so "no row" is never cached for an outage; the page renders without it.
		throw new Error(`[Listing] category navigation unavailable for ${baseSlug}: ${result.error.message}`);
	}

	const category = result.data.category;
	// A renamed parent or sibling changes the row as well as this category's own event does.
	for (const node of relatives(category)) {
		cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: node.slug }));
	}
	return buildCategoryNavigation(category, channel, locale);
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
			href: marketHref(channel, categoryUrlFor(channel, localized.slug)),
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
 * "Nosiče bicyklov na strechu" in the row of "Nosiče bicyklov" reads "Na strechu": the row
 * already says whose sub-categories these are. A name that does not start with the family's
 * name — "Príslušenstvo k nosičom bicyklov" — is left whole.
 */
export function withinFamily(name: string, familyName: string, locale: string): string {
	const prefix = `${familyName} `;
	if (!name.toLocaleLowerCase(locale).startsWith(prefix.toLocaleLowerCase(locale))) return name;
	const rest = name.slice(prefix.length).trim();
	return rest ? rest.charAt(0).toLocaleUpperCase(locale) + rest.slice(1) : name;
}
