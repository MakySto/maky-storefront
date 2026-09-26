import { CheckCircle2, Clock, RotateCcw, XCircle, Circle, PackageCheck, type LucideIcon } from "lucide-react";
import { OrderStatus } from "@/gql/graphql";

type StatusConfig = { icon: LucideIcon; className: string };

export const orderStatusStyle: Record<OrderStatus, StatusConfig> = {
	[OrderStatus.Fulfilled]: { icon: CheckCircle2, className: "text-green-700" },
	[OrderStatus.PartiallyFulfilled]: { icon: PackageCheck, className: "text-blue-700" },
	[OrderStatus.Unfulfilled]: { icon: Clock, className: "text-amber-600" },
	[OrderStatus.Canceled]: { icon: XCircle, className: "text-red-600" },
	[OrderStatus.Returned]: { icon: RotateCcw, className: "text-muted-foreground" },
	[OrderStatus.PartiallyReturned]: { icon: RotateCcw, className: "text-amber-600" },
	[OrderStatus.Draft]: { icon: Circle, className: "text-muted-foreground" },
	[OrderStatus.Unconfirmed]: { icon: Circle, className: "text-muted-foreground" },
	[OrderStatus.Expired]: { icon: XCircle, className: "text-muted-foreground" },
};

export const orderStatusBadgeStyle: Record<OrderStatus, StatusConfig & { badgeClassName: string }> = {
	[OrderStatus.Fulfilled]: {
		...orderStatusStyle[OrderStatus.Fulfilled],
		badgeClassName: "text-green-700 bg-green-50 border-green-200",
	},
	[OrderStatus.PartiallyFulfilled]: {
		...orderStatusStyle[OrderStatus.PartiallyFulfilled],
		badgeClassName: "text-blue-700 bg-blue-50 border-blue-200",
	},
	[OrderStatus.Unfulfilled]: {
		...orderStatusStyle[OrderStatus.Unfulfilled],
		badgeClassName: "text-amber-700 bg-amber-50 border-amber-200",
	},
	[OrderStatus.Canceled]: {
		...orderStatusStyle[OrderStatus.Canceled],
		badgeClassName: "text-red-700 bg-red-50 border-red-200",
	},
	[OrderStatus.Returned]: {
		...orderStatusStyle[OrderStatus.Returned],
		badgeClassName: "text-muted-foreground bg-secondary border-border",
	},
	[OrderStatus.PartiallyReturned]: {
		...orderStatusStyle[OrderStatus.PartiallyReturned],
		badgeClassName: "text-amber-700 bg-amber-50 border-amber-200",
	},
	[OrderStatus.Draft]: {
		...orderStatusStyle[OrderStatus.Draft],
		badgeClassName: "text-muted-foreground bg-secondary border-border",
	},
	[OrderStatus.Unconfirmed]: {
		...orderStatusStyle[OrderStatus.Unconfirmed],
		badgeClassName: "text-muted-foreground bg-secondary border-border",
	},
	[OrderStatus.Expired]: {
		...orderStatusStyle[OrderStatus.Expired],
		badgeClassName: "text-muted-foreground bg-secondary border-border",
	},
};

export const defaultStatusStyle: StatusConfig = {
	icon: Circle,
	className: "text-muted-foreground",
};

/**
 * The customer's word for each status, as a key in the `account` messages. Every status has one:
 * Saleor's own `statusDisplay` is English whatever the market.
 *
 * FULFILLED said "Delivered" until 2026-09-26. In Saleor it means every line has been fulfilled,
 * which in this shop is handed to the carrier — shipped, not delivered.
 */
export const orderStatusLabelKey: Record<OrderStatus, string> = {
	[OrderStatus.Unfulfilled]: "status.unfulfilled",
	[OrderStatus.Unconfirmed]: "status.unconfirmed",
	[OrderStatus.PartiallyFulfilled]: "status.partiallyFulfilled",
	[OrderStatus.Fulfilled]: "status.fulfilled",
	[OrderStatus.Canceled]: "status.canceled",
	[OrderStatus.Returned]: "status.returned",
	[OrderStatus.PartiallyReturned]: "status.partiallyReturned",
	[OrderStatus.Draft]: "status.draft",
	[OrderStatus.Expired]: "status.expired",
};
