import { getTranslations } from "next-intl/server";
import { FulfillmentStatus, type OrderFullDetailsFragment } from "@/gql/graphql";
import { formatDate } from "@/config/locale";

type Props = {
	/** The market's locale — labels and dates are in its language. */
	locale: string;
	order: OrderFullDetailsFragment;
};

type TimelineEvent = {
	label: string;
	description: string;
	date: Date;
	isCurrent: boolean;
};

/** Keys in the `account` messages. */
const fulfillmentLabelKey: Record<FulfillmentStatus, string> = {
	[FulfillmentStatus.Fulfilled]: "timeline.shipped",
	[FulfillmentStatus.Canceled]: "timeline.shipmentCanceled",
	[FulfillmentStatus.Refunded]: "timeline.refunded",
	[FulfillmentStatus.RefundedAndReturned]: "timeline.refundedAndReturned",
	[FulfillmentStatus.Replaced]: "timeline.replaced",
	[FulfillmentStatus.Returned]: "timeline.returned",
	[FulfillmentStatus.WaitingForApproval]: "timeline.awaitingApproval",
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

function buildTimeline(order: OrderFullDetailsFragment, t: Translate): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	// "Order placed", not the "Payment confirmed and order placed" this said until 2026-09-26:
	// the first event is the order's creation, which is true of an unpaid order as well.
	events.push({
		label: t("timeline.placed"),
		description: "",
		date: new Date(order.created),
		isCurrent: false,
	});

	for (const fulfillment of order.fulfillments) {
		const labelKey = fulfillmentLabelKey[fulfillment.status];
		const itemCount = fulfillment.lines?.reduce((sum, l) => sum + l.quantity, 0) ?? 0;

		events.push({
			label: labelKey ? t(labelKey) : fulfillment.status,
			description: itemCount > 0 ? t("orders.itemCount", { count: itemCount }) : "",
			date: new Date(fulfillment.created),
			isCurrent: false,
		});

		if (fulfillment.trackingNumber) {
			events.push({
				label: t("timeline.tracking", { number: fulfillment.trackingNumber }),
				description: "",
				date: new Date(fulfillment.created),
				isCurrent: false,
			});
		}
	}

	events.sort((a, b) => b.date.getTime() - a.date.getTime());

	if (events.length > 0) {
		events[0].isCurrent = true;
	}

	return events;
}

export async function OrderTimeline({ order, locale }: Props) {
	const t = await getTranslations({ locale, namespace: "account" });
	const events = buildTimeline(order, t);

	if (events.length === 0) return null;

	return (
		<div className="rounded-xl border">
			<div className="border-b px-5 py-4">
				<h2 className="text-sm font-semibold">{t("timeline.title")}</h2>
			</div>
			<div className="px-5 py-4">
				<ol className="border-border relative ml-3 border-l">
					{events.map((event, i) => (
						<li key={i} className="relative mb-6 ml-6 last:mb-0">
							<span
								className={`border-background absolute top-1 -left-[calc(1.5rem+5px)] h-2.5 w-2.5 rounded-full border-2 ${
									event.isCurrent ? "bg-foreground" : "bg-muted-foreground/40"
								}`}
							/>
							<p
								className={`text-sm ${
									event.isCurrent ? "font-semibold" : "text-muted-foreground font-medium"
								}`}
							>
								{event.label}
							</p>
							{event.description && (
								<p className="text-muted-foreground mt-0.5 text-[13px]">{event.description}</p>
							)}
							<p className="text-muted-foreground mt-0.5 text-[13px]">
								<time dateTime={event.date.toISOString()}>{formatDate(event.date, locale)}</time>
							</p>
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}
