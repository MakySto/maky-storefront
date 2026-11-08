import { type FitmentApplication } from "./contract";

/**
 * What a "may fit, depending on the month" answer has to tell the shopper: from which month the
 * set is valid, or until which. Pure; the words are the surface's (`fitment.monthCaveat*`).
 *
 * Read from the windows of the applications the resolver matched, and only the boundary the
 * shopper's year sits on — a window "03/2025 – open" says "od 03/2025" to a 2025 car, and
 * nothing about an end the car is nowhere near. A boundary the source knows only to the year is
 * never turned into a month: it cannot have been what made the month matter.
 *
 * Several matched windows that do not agree (a set listed twice with two different edges) say
 * "depends on the month" without a date, rather than choosing one.
 */
export type MonthCaveat =
	| { kind: "from"; from: string }
	| { kind: "to"; to: string }
	| { kind: "between"; from: string; to: string }
	| { kind: "several" };

const mmyyyy = (year: number, month: number): string => `${String(month).padStart(2, "0")}/${year}`;

export function monthCaveatOf(applications: readonly FitmentApplication[], year: number): MonthCaveat | null {
	const edges = new Map<string, { from: string | null; to: string | null }>();
	for (const { window } of applications) {
		const from =
			window.startPrecision === "month" && window.from.year === year && window.from.month !== undefined
				? mmyyyy(year, window.from.month)
				: null;
		const to =
			window.to !== null &&
			window.endPrecision === "month" &&
			window.to.year === year &&
			window.to.month !== undefined
				? mmyyyy(year, window.to.month)
				: null;
		if (from === null && to === null) continue;
		edges.set(`${from}|${to}`, { from, to });
	}
	if (edges.size === 0) return null;
	if (edges.size > 1) return { kind: "several" };
	const [{ from, to }] = [...edges.values()] as [{ from: string | null; to: string | null }];
	if (from && to) return { kind: "between", from, to };
	if (from) return { kind: "from", from };
	return { kind: "to", to: to! };
}

/** The sentence for a caveat, through a `fitment`-namespace translator. */
export function monthCaveatText(
	caveat: MonthCaveat | null,
	t: (key: string, values?: Record<string, string>) => string,
): string {
	if (!caveat) return t("monthCaveatSeveral");
	switch (caveat.kind) {
		case "from":
			return t("monthCaveatFrom", { date: caveat.from });
		case "to":
			return t("monthCaveatTo", { date: caveat.to });
		case "between":
			return t("monthCaveatBetween", { from: caveat.from, to: caveat.to });
		case "several":
			return t("monthCaveatSeveral");
	}
}
