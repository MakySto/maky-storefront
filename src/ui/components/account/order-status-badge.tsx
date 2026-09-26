import { Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type OrderStatus } from "@/gql/graphql";
import { orderStatusBadgeStyle, orderStatusLabelKey } from "./order-status-config";

type Props = {
	/** The market's locale — the label is in its language, not Saleor's English `statusDisplay`. */
	locale: string;
	status: OrderStatus;
	statusDisplay: string;
};

export async function OrderStatusBadge({ locale, status, statusDisplay }: Props) {
	const t = await getTranslations({ locale, namespace: "account" });
	const labelKey = orderStatusLabelKey[status];
	const config = orderStatusBadgeStyle[status] ?? {
		icon: Circle,
		badgeClassName: "text-muted-foreground bg-secondary border-border",
	};
	const Icon = config.icon;

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${config.badgeClassName}`}
		>
			<Icon className="h-4 w-4" strokeWidth={1.75} />
			{labelKey ? t(labelKey) : statusDisplay}
		</span>
	);
}
