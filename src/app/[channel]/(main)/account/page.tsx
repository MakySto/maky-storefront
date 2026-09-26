import { getLocaleFromChannel } from "@/config/locale";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { CurrentUserOrdersPaginatedDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { OrderRow } from "@/ui/components/account/order-row";
import { AccountAddressCard } from "@/ui/components/account/address-card";
import { accountRoutes } from "@/ui/components/account/routes";
import { getCurrentUser } from "./get-current-user";

export default async function AccountOverviewPage({
	params,
}: {
	// Money is formatted in the market's locale, not the store default.
	params: Promise<{ channel: string }>;
}) {
	const { channel } = await params;
	const locale = getLocaleFromChannel(channel);
	const [t, tCheckout] = await Promise.all([
		getTranslations({ locale, namespace: "account" }),
		getTranslations({ locale, namespace: "checkout.addressForm" }),
	]);
	const [user, ordersResult] = await Promise.all([
		getCurrentUser(),
		executeAuthenticatedGraphQL(CurrentUserOrdersPaginatedDocument, {
			variables: { first: 3, after: null },
			cache: "no-cache",
		}),
	]);

	const orders = ordersResult.ok ? ordersResult.data.me?.orders?.edges ?? [] : [];
	const defaultAddress = user
		? user.addresses.find((a) => a.id === user.defaultShippingAddress?.id) ?? user.addresses[0]
		: null;

	const displayName = user?.firstName || user?.email.split("@")[0] || "";

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("dashboard.greeting", { name: displayName })}
				</h1>
				<p className="text-muted-foreground mt-1 text-sm">{t("overview")}</p>
			</div>

			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{t("recentOrders")}</h2>
					{orders.length > 0 && (
						<LinkWithChannel
							href={accountRoutes.orders}
							className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium transition-colors"
						>
							{t("dashboard.viewAll")}
							<ChevronRight className="h-4 w-4" />
						</LinkWithChannel>
					)}
				</div>

				{orders.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
						{t("orders.empty")}
					</div>
				) : (
					<div className="space-y-2">
						{orders.map(({ node: order }) => (
							<OrderRow key={order.id} order={order} locale={locale} />
						))}
					</div>
				)}
			</section>

			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{t("defaultAddress")}</h2>
					<LinkWithChannel
						href={accountRoutes.addresses}
						className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium transition-colors"
					>
						{t("dashboard.manage")}
						<ChevronRight className="h-4 w-4" />
					</LinkWithChannel>
				</div>

				{defaultAddress ? (
					<AccountAddressCard address={defaultAddress} locale={locale} isDefaultShipping />
				) : (
					<div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
						{tCheckout("noSavedAddressesYet")}
					</div>
				)}
			</section>
		</div>
	);
}
