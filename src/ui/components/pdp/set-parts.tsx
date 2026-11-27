import { type ComponentEan, type ComponentRole } from "@/lib/component-eans";

/**
 * The parts a set is put together from, under the set's own code on the product page.
 *
 * A roof-rack set carries a joined code (`N21220|N20001|N15085`) and no EAN of its own; its parts have
 * both, and CFM publishes them beside the set (`lib/component-eans.ts`). They used to follow the code
 * as one wrapped line, "EAN der Teile: Montagekit N21220: 8034057212200 Füße N20001: … Querträger …",
 * which held everything and read as a string of numbers. The owner asked for one part on a line, with
 * its name, under a sentence that says what the list is (2026-11-27, audit S3); the joined code above
 * it stays as it is.
 *
 * A table, because that is what it is: a part, its code, its EAN. Up to `SET_PARTS_LIST_MAX` parts.
 * A set of more (a roof basket is six to twelve codes) keeps the wrapped line: twelve rows above the
 * price would push the price and the button off a laptop's first screen.
 */
export const SET_PARTS_LIST_MAX = 5;

export interface SetPartsLabels {
	/** "Zostava sa skladá z týchto dielov:" — the sentence over the list, punctuation included. */
	readonly heading: string;
	/** "EAN dielov" — the label of the wrapped line a longer set keeps. */
	readonly compactHeading: string;
	/** "EAN" */
	readonly ean: string;
	/** What the market calls a part of this role ("priečniky"), or `null` for a part CFM gave no role. */
	readonly roleName: (role: ComponentRole) => string | null;
	/** The market's locale, for the capital letter of a part's name. */
	readonly locale: string;
}

/** "priečniky" → "Priečniky". The role names are written for the middle of a sentence. */
export function partName(name: string | null, locale: string): string | null {
	if (!name) return null;
	const first = name.slice(0, 1);
	return first.toLocaleUpperCase(locale) + name.slice(1);
}

export function SetParts({ parts, labels }: { parts: readonly ComponentEan[]; labels: SetPartsLabels }) {
	if (parts.length === 0) return null;

	if (parts.length > SET_PARTS_LIST_MAX) {
		return (
			<dl className="text-text-tertiary flex w-full min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs">
				<dt className="w-full sm:w-auto">{labels.compactHeading}:</dt>
				{parts.map((part) => {
					const role = labels.roleName(part.role);
					return (
						<dd key={part.ean} className="min-w-0">
							{role ? `${role} ` : ""}
							<span className="[overflow-wrap:anywhere]">{part.code}</span>
							{part.qty > 1 ? ` (${part.qty}×)` : ""}:{" "}
							<span className="font-medium tabular-nums">{part.ean}</span>
						</dd>
					);
				})}
			</dl>
		);
	}

	return (
		<div className="text-text-tertiary w-full min-w-0 text-xs" data-testid="set-parts">
			<table className="border-separate border-spacing-0 text-left">
				<caption className="text-text-secondary pb-1.5 text-left font-medium">{labels.heading}</caption>
				<tbody>
					{parts.map((part) => {
						const name = partName(labels.roleName(part.role), labels.locale);
						return (
							<tr key={part.ean}>
								<th scope="row" className="text-text-secondary py-0.5 pr-4 align-baseline font-normal">
									{name ?? part.code}
									{part.qty > 1 ? ` (${part.qty}×)` : ""}
								</th>
								<td className="py-0.5 pr-4 align-baseline font-medium [overflow-wrap:anywhere] tabular-nums">
									{name ? part.code : ""}
								</td>
								<td className="py-0.5 align-baseline whitespace-nowrap">
									{labels.ean}: <span className="font-medium tabular-nums">{part.ean}</span>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
