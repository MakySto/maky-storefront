import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Availability, from CFM's public `cfm_availability_mode` metadata.
 *
 * The catalogue is sale-to-order: `trackInventory` is false and no stock
 * records exist, so Saleor answers `quantityAvailable` with a synthetic
 * configuration cap (50 for every variant). Deriving "Skladom" from that number
 * would be a stock claim the business cannot honour, which is why availability
 * is a CFM-owned fact transported as metadata rather than something the
 * storefront infers.
 *
 * When the metadata is absent the component renders NOTHING. Silence is the
 * only honest output for an unknown availability — a guess here is a promise to
 * the customer.
 *
 * The `onDemand` copy carries the lead time, not just the mode ("Na objednávku,
 * dodanie 5–10 pracovných dní"). These are dropship items and the wait is the
 * fact the customer needs before they buy, so it belongs in the badge rather
 * than further down the page. The structured-data half of the same claim is
 * `buildProductJsonLd`, which emits schema.org/BackOrder for this mode.
 */

export const AVAILABILITY_METADATA_KEY = "cfm_availability_mode";

export type AvailabilityMode = "sale_to_order";

export type AvailabilityInput = {
	/** Value of `metafield(key: "cfm_availability_mode")`. */
	mode?: string | null;
	/**
	 * Saleor's `quantityAvailable`. Used ONLY to detect a hard zero; it is
	 * capped and synthetic otherwise, and must never produce a positive stock
	 * claim or a "only N left" urgency line.
	 */
	quantityAvailable?: number | null;
};

type Resolved = { key: "onDemand" | "outOfStock"; tone: "info" | "muted" } | null;

export function resolveAvailability({ mode, quantityAvailable }: AvailabilityInput): Resolved {
	if (quantityAvailable === 0) {
		return { key: "outOfStock", tone: "muted" };
	}
	if (mode === "sale_to_order") {
		return { key: "onDemand", tone: "info" };
	}
	return null;
}

export function AvailabilityBadge({ className, ...input }: AvailabilityInput & { className?: string }) {
	const t = useTranslations("common");
	const resolved = resolveAvailability(input);

	if (!resolved) return null;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-sm font-medium",
				resolved.tone === "info" ? "text-status-info" : "text-text-tertiary",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"h-1.5 w-1.5 rounded-full",
					resolved.tone === "info" ? "bg-status-info" : "bg-text-tertiary",
				)}
			/>
			{t(resolved.key)}
		</span>
	);
}
