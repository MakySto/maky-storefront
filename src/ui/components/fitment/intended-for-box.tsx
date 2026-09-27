import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CarFront } from "lucide-react";

import { cn } from "@/lib/utils";
import { type IntendedVehicle, windowBounds } from "@/lib/fitment/intended-for";
import { BODY_LABEL_KEY, ROOF_LABEL_KEY } from "./verdict-presentation";

/**
 * "Určené pre: AUDI A4 Avant B8 · 05/2008 – 10/2015 · Kombi · Integrované pozdĺžniky", above the
 * price — what this offer is made for, and the way to the offers for the shopper's own car.
 *
 * Neutral on purpose: not the amber of "we cannot confirm" and not the red of a misfit. It is a
 * description of the offer, not a verdict about the saved car (`intended-for.ts` says when it is
 * shown instead of one). The facts are the ones the "Pre ktoré vozidlá" section lower down lists,
 * in the same order, so the two can never disagree.
 *
 * Everything interactive is an anchor. The box is a sibling of the add-to-cart form, not inside it
 * (`pdp-compatibility.tsx`), and a `<button>` would still be the wrong element for navigation.
 */
export async function IntendedForBox({
	vehicles,
	vehicleHref,
	alternative,
	action,
	locale,
	className,
}: {
	vehicles: readonly IntendedVehicle[];
	/** The first vehicle's page in this market, or null when this market does not serve one. */
	vehicleHref: string | null;
	/** The way to the offers for the saved car: its label ("Pozrieť nosiče pre …") and the URL. */
	alternative: { label: string; href: string } | null;
	/** Rendered last — the "check your car" launcher when no car is saved. */
	action?: React.ReactNode;
	locale: string;
	className?: string;
}) {
	const t = await getTranslations({ locale, namespace: "fitment" });
	const [first, ...rest] = vehicles;
	if (!first) return null;

	const { from, to } = windowBounds(first.window);
	const facts = [
		to === null ? t("yearFromOnly", { from }) : t("yearRange", { from, to }),
		first.bodyTypes.map((body) => t(BODY_LABEL_KEY[body])).join(", "),
		first.roofTypes.map((roof) => t(ROOF_LABEL_KEY[roof])).join(", "),
	].filter(Boolean);

	return (
		<div
			className={cn("border-border-default bg-surface-card rounded-sm border px-4 py-3.5", className)}
			data-testid="fitment-intended-for"
		>
			<div className="flex items-start gap-3">
				<span className="bg-surface-muted text-text-secondary mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
					<CarFront className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-text-primary text-[0.9375rem] leading-snug">
						{t.rich("intendedFor", {
							vehicle: first.name,
							link: (chunks) =>
								vehicleHref ? (
									<Link
										href={vehicleHref}
										className="decoration-text-tertiary hover:decoration-text-primary font-bold underline underline-offset-4"
									>
										{chunks}
									</Link>
								) : (
									<strong className="font-bold">{chunks}</strong>
								),
						})}
						{rest.length > 0 && (
							<>
								{" "}
								{/* The full list is the section lower down; this only says it exists. */}
								<a
									href="#fitment-applications"
									className="text-text-secondary text-sm underline underline-offset-4"
								>
									{t("intendedForMore", { count: rest.length })}
								</a>
							</>
						)}
					</p>
					<p className="text-text-secondary mt-0.5 text-sm">{facts.join(" · ")}</p>
					{alternative && (
						<Link
							href={alternative.href}
							className="text-brand mt-1.5 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
						>
							{alternative.label}
							<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
						</Link>
					)}
					{action && <div className="mt-3">{action}</div>}
				</div>
			</div>
		</div>
	);
}
