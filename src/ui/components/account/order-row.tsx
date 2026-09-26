import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type OrderDetailsFragment } from "@/gql/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { formatDate } from "@/config/locale";
import { formatMoney } from "@/lib/utils";
import { orderStatusStyle, defaultStatusStyle, orderStatusLabelKey } from "./order-status-config";
import { accountRoutes } from "./routes";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

type Props = {
	/** The market's locale — money, dates and words are all in it, not in the store default. */
	locale: string;
	order: OrderDetailsFragment;
};

export async function OrderRow({ order, locale }: Props) {
	const t = await getTranslations({ locale, namespace: "account" });
	const thumbnails = order.lines
		.filter((l) => l.variant?.product.thumbnail)
		.map((l) => l.variant!.product.thumbnail!)
		.slice(0, 3);

	const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

	const style = orderStatusStyle[order.status] ?? defaultStatusStyle;
	const StatusIcon = style.icon;
	const labelKey = orderStatusLabelKey[order.status];

	return (
		<LinkWithChannel
			href={accountRoutes.orderDetail(order.number)}
			className="hover:bg-secondary/30 flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors"
		>
			<div className="flex -space-x-3">
				{thumbnails.map((thumb, i) => (
					<div
						key={i}
						className="bg-secondary/40 border-background h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2"
					>
						<ResilientProductImage
							src={thumb.url}
							alt={thumb.alt ?? ""}
							width={96}
							height={96}
							className="h-full w-full object-contain"
						/>
					</div>
				))}
				{thumbnails.length === 0 && (
					<div className="bg-secondary text-muted-foreground flex h-12 w-12 items-center justify-center rounded-lg text-xs">
						#
					</div>
				)}
			</div>

			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold">ORD-{order.number}</p>
				<p className="text-muted-foreground text-[13px]">
					<time dateTime={order.created}>{formatDate(new Date(order.created), locale)}</time>
					{" · "}
					{t("orders.itemCount", { count: itemCount })}
				</p>
			</div>

			<div className="flex items-center gap-4">
				<span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${style.className}`}>
					<StatusIcon className="h-4 w-4" strokeWidth={1.75} />
					<span className="hidden sm:inline">{labelKey ? t(labelKey) : order.statusDisplay}</span>
				</span>
				<span className="text-sm font-semibold tabular-nums">
					{formatMoney(order.total.gross.amount, order.total.gross.currency, locale)}
				</span>
				<ArrowRight className="text-muted-foreground h-4 w-4" />
			</div>
		</LinkWithChannel>
	);
}
