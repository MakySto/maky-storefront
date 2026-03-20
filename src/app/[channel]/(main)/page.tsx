import { Suspense } from "react";
import { ProductListByCollectionDocument, ProductOrderField, OrderDirection } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { ProductList } from "@/ui/components/product-list";
import { HeroSection, CategoryGrid, WhyMaky, BrandsStrip, NewsletterCTA } from "@/ui/components/homepage";

async function getFeaturedProducts(channel: string) {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.collections, "featured-products");

	const result = await executePublicGraphQL(ProductListByCollectionDocument, {
		variables: {
			slug: "featured-products",
			channel,
			first: 12,
			sortBy: { field: ProductOrderField.Collection, direction: OrderDirection.Asc },
		},
		revalidate: 300,
	});

	if (!result.ok) {
		console.warn(`[Homepage] Failed to fetch featured products for ${channel}:`, result.error.message);
		return [];
	}

	return result.data.collection?.products?.edges.map(({ node }) => node) ?? [];
}

export default function Page(props: { params: Promise<{ channel: string }> }) {
	return (
		<>
			<HeroSection />
			<CategoryGrid />

			{/* Featured Products */}
			<section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
				<h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
					Featured Products
				</h2>
				<div className="mt-8">
					<Suspense
						fallback={
							<ul
								role="list"
								data-testid="ProductList"
								className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
							>
								{Array.from({ length: 8 }).map((_, i) => (
									<li key={i} className="animate-pulse">
										<div className="aspect-square overflow-hidden rounded-lg bg-gray-100" />
										<div className="mt-3 flex justify-between">
											<div>
												<div className="h-4 w-32 rounded bg-gray-100" />
												<div className="mt-2 h-4 w-20 rounded bg-gray-100" />
											</div>
											<div className="h-4 w-16 rounded bg-gray-100" />
										</div>
									</li>
								))}
							</ul>
						}
					>
						<FeaturedProducts params={props.params} />
					</Suspense>
				</div>
			</section>

			<WhyMaky />
			<BrandsStrip />
			<NewsletterCTA />
		</>
	);
}

async function FeaturedProducts({ params: paramsPromise }: { params: Promise<{ channel: string }> }) {
	const { channel } = await paramsPromise;
	const products = await getFeaturedProducts(channel);

	if (products.length === 0) {
		return (
			<p className="text-center text-gray-500 py-8">
				No featured products yet. Products will appear here after CFM publication.
			</p>
		);
	}

	return <ProductList products={products} />;
}
