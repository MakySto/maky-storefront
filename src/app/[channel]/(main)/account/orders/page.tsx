import { getLocaleFromChannel } from "@/config/locale";
import { getTranslations } from "next-intl/server";
import { CurrentUserOrdersPaginatedDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { OrderRow } from "@/ui/components/account/order-row";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { Button } from "@/ui/components/ui/button";
import { accountRoutes } from "@/ui/components/account/routes";

const ORDERS_PER_PAGE = 10;

type Props = {
	// The market segment is in the route; the page needs it because money is formatted in the
	// market's locale, not the store default.
	params: Promise<{ channel: string }>;
	searchParams: Promise<{ after?: string }>;
};

export default async function AccountOrdersPage({ params, searchParams }: Props) {
	const { channel } = await params;
	const { after } = await searchParams;
	const locale = getLocaleFromChannel(channel);
	const [t, tCommon] = await Promise.all([
		getTranslations({ locale, namespace: "account" }),
		getTranslations({ locale, namespace: "common" }),
	]);

	const result = await executeAuthenticatedGraphQL(CurrentUserOrdersPaginatedDocument, {
		variables: {
			first: ORDERS_PER_PAGE,
			after: after || null,
		},
		cache: "no-cache",
	});

	if (!result.ok || !result.data.me) {
		return null;
	}

	const ordersConnection = result.data.me.orders;
	const orders = ordersConnection?.edges ?? [];
	const pageInfo = ordersConnection?.pageInfo;
	const totalCount = ordersConnection?.totalCount ?? 0;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">{t("menu.orders")}</h1>
				<p className="text-muted-foreground mt-1 text-sm">{t("orders.count", { count: totalCount })}</p>
			</div>

			{orders.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="text-muted-foreground">{t("orders.empty")}</p>
				</div>
			) : (
				<>
					<div className="space-y-2">
						{orders.map(({ node: order }) => (
							<OrderRow key={order.id} order={order} locale={locale} />
						))}
					</div>

					{pageInfo?.hasNextPage && pageInfo.endCursor && (
						<div className="flex justify-center pt-2">
							<LinkWithChannel href={`${accountRoutes.orders}?after=${pageInfo.endCursor}`}>
								<Button variant="outline-solid">{tCommon("loadMore")}</Button>
							</LinkWithChannel>
						</div>
					)}
				</>
			)}
		</div>
	);
}
