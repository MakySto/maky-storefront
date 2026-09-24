import { CircleCheckIcon, CircleSlashIcon, Clock3Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Availability from Saleor inventory plus CFM's public
 * `cfm_availability_mode` metadata.
 *
 * Untracked sale-to-order variants have no physical stock records, so Saleor
 * answers `quantityAvailable` with a synthetic configuration cap (typically
 * 50). Tracked variants are different: their positive quantity is reachable
 * warehouse stock and must take precedence over a stale sale-to-order flag.
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
 *
 * The lead time is NOT the same everywhere, and the copy is the only place that
 * says so. Owner decision 2026-09-22: 5–10 working days across the EU markets,
 * 7–14 for US and CA. Until then every foreign market said only "Auf Bestellung",
 * "Made to order", "Na zamówienie" — the mode without the wait — so a Slovak
 * shopper was the only one who learned how long it takes. If a market's real lead
 * time changes, `common.onDemand` in that locale is the line customers read — and the
 * homepage's shipping markup (`DELIVERY_REGIONS` in `src/lib/seo/json-ld.ts`) states the
 * same window to Google. `json-ld.organization.test.ts` fails until both say the same.
 */

export const AVAILABILITY_METADATA_KEY = "cfm_availability_mode";

export type AvailabilityMode = "sale_to_order";

export type AvailabilityInput = {
	/** Value of `metafield(key: "cfm_availability_mode")`. */
	mode?: string | null;
	/** Whether Saleor decrements real warehouse inventory for this variant. */
	trackInventory?: boolean | null;
	/**
	 * Saleor's channel-aware `quantityAvailable`. It is real stock only when
	 * `trackInventory` is true; otherwise it may be a synthetic checkout cap.
	 */
	quantityAvailable?: number | null;
};

/** The `common.*` keys this badge can ask for. */
export type AvailabilityKey = "inStock" | "onDemand" | "onDemandShort" | "outOfStock";

type Resolved =
	| { key: "inStock"; tone: "success" }
	| { key: "onDemand"; tone: "info" }
	| { key: "outOfStock"; tone: "muted" }
	| null;

export function resolveAvailability({
	mode,
	trackInventory,
	quantityAvailable,
}: AvailabilityInput): Resolved {
	// For tracked variants, Saleor's channel-aware quantity is the authoritative
	// stock fact. This intentionally wins over stale CFM sourcing metadata.
	if (trackInventory === true) {
		if (typeof quantityAvailable !== "number") return null;
		return quantityAvailable > 0 ? { key: "inStock", tone: "success" } : { key: "outOfStock", tone: "muted" };
	}

	// Preserve the hard-zero safeguard for older callers that do not yet carry
	// trackInventory and for explicitly untracked variants.
	if (quantityAvailable === 0) {
		return { key: "outOfStock", tone: "muted" };
	}
	if (mode === "sale_to_order") {
		return { key: "onDemand", tone: "info" };
	}
	return null;
}

/**
 * The label is a PROP, and required, because this badge renders on both sides of the
 * client boundary: `VariantSectionDynamic` is a server component, `ProductCard` is a client
 * one. It used to reach for the `common` namespace itself, through the translations hook with a
 * bare namespace, which reads whichever locale the
 * surrounding render happens to carry — and when that render carries none, `i18n/request.ts`
 * answers with DEFAULT_LOCALE, which is Slovak. The result was a Canadian product page,
 * correct in every other respect, announcing "Na objednávku, dodanie 5–10 pracovných dní".
 *
 * It was the last component in the codebase doing that, and it survived the first sweep
 * because the check looked for `getTranslations` and this one used the hook. Making the label
 * a required prop removes the ambient lookup instead of binding it: there is no locale here to
 * get wrong.
 */
export function AvailabilityBadge({
	className,
	label,
	short = false,
	detailed = false,
	...input
}: AvailabilityInput & {
	className?: string;
	label: (key: AvailabilityKey) => string;
	/**
	 * The mode without the lead time ("Na objednávku") — for a listing card, where the full line
	 * wrapped to three rows beside the price. The product page, where the shopper decides, keeps
	 * the lead time.
	 */
	short?: boolean;
	/**
	 * The product page's two lines, as the approved buy box draws them: an icon, the state in
	 * bold, and under it the lead time. The lead time is the rest of the market's own `onDemand`
	 * line after its short form — never a second copy of the figure that could drift from it.
	 */
	detailed?: boolean;
}) {
	const resolved = resolveAvailability(input);

	if (!resolved) return null;
	const key: AvailabilityKey = short && resolved.key === "onDemand" ? "onDemandShort" : resolved.key;

	if (detailed) {
		const full = label(resolved.key);
		const head = resolved.key === "onDemand" ? label("onDemandShort") : full;
		const rest =
			resolved.key === "onDemand" && full.startsWith(head)
				? full.slice(head.length).replace(/^[\s,–-]+/, "")
				: "";
		const Icon =
			resolved.tone === "success" ? CircleCheckIcon : resolved.tone === "info" ? Clock3Icon : CircleSlashIcon;
		return (
			<span className={cn("flex items-start gap-2.5", className)}>
				<Icon
					aria-hidden
					strokeWidth={2.25}
					className={cn(
						"mt-px h-[1.375rem] w-[1.375rem] shrink-0",
						resolved.tone === "success"
							? "text-status-success"
							: resolved.tone === "info"
								? "text-brand"
								: "text-text-tertiary",
					)}
				/>
				<span className="min-w-0">
					<span
						className={cn(
							"block text-[0.9375rem] leading-tight font-bold",
							resolved.tone === "success" ? "text-status-success" : "text-text-primary",
						)}
					>
						{head}
					</span>
					{rest && (
						<span className="text-text-secondary mt-1 block text-sm leading-snug">
							{rest.charAt(0).toUpperCase() + rest.slice(1)}
						</span>
					)}
				</span>
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-sm font-medium",
				// "Na objednávku" is information, not a warning and not good news: it reads in the
				// quiet body colour, and only its dot carries the info hue. Blue text beside the
				// warm prices of the 2026-09 redesign read as a link.
				resolved.tone === "success"
					? "text-status-success"
					: resolved.tone === "info"
						? "text-text-secondary"
						: "text-text-tertiary",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"h-2 w-2 shrink-0 rounded-full",
					resolved.tone === "success"
						? "bg-status-success"
						: resolved.tone === "info"
							? "bg-status-info"
							: "bg-text-tertiary",
				)}
			/>
			{label(key)}
		</span>
	);
}
