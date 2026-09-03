import Link from "next/link";
import { NavLink } from "./nav-link";
import { executePublicGraphQL } from "@/lib/graphql";
import { MenuGetBySlugDocument } from "@/gql/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleMenu } from "@/lib/saleor/exact-locale";
import { getTranslations } from "next-intl/server";

export const NavLinks = async ({ channel }: { channel: string }) => {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	applyCacheProfile(CACHE_PROFILES.navigation, { channel, locale });
	const t = await getTranslations({ locale, namespace: "plp" });

	const result = await executePublicGraphQL(MenuGetBySlugDocument, {
		variables: { slug: "navbar", channel, lang },
		revalidate: 60 * 60, // 1 hour
	});

	if (!result.ok) {
		// During build, if the API is unreachable, render minimal nav.
		// The page will re-fetch when a user visits.
		console.warn(`[NavLinks] Failed to fetch navigation for ${channel}:`, result.error.message);
		return <NavLink href="/products">{t("allProducts")}</NavLink>;
	}

	const items = resolveExactLocaleMenu(result.data.menu?.items ?? [], locale);

	return (
		<>
			<NavLink href="/products">{t("allProducts")}</NavLink>
			{items.map((item) => {
				if (item.category) {
					return (
						<NavLink key={item.id} href={`/categories/${item.category.slug}`}>
							{item.category.name}
						</NavLink>
					);
				}
				if (item.collection) {
					return (
						<NavLink key={item.id} href={`/collections/${item.collection.slug}`}>
							{item.collection.name}
						</NavLink>
					);
				}
				if (item.page) {
					return (
						<NavLink key={item.id} href={`/pages/${item.page.slug}`}>
							{item.page.title}
						</NavLink>
					);
				}
				if (item.url) {
					return (
						<Link key={item.id} href={item.url} prefetch={false}>
							{item.name}
						</Link>
					);
				}
				return null;
			})}
		</>
	);
};
