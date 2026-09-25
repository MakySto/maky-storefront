"use client";

/**
 * "Which vehicles is this product made for?"
 *
 * Deliberately answerable with NO vehicle selected — it is the question a shopper asks
 * before they are willing to tell you anything about their car, and a compatibility
 * feature that only answers after you commit is a feature most people never reach.
 *
 * Only the first page is rendered from the server payload; search and further pages come
 * from a server action, so a bar family fitting thousands of vehicles does not put
 * thousands of rows into every product page's HTML.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { listProductApplications } from "@/lib/fitment/application-actions";
import { type ApplicationPage, type ApplicationRow } from "@/lib/fitment/application-types";
import { BODY_LABEL_KEY, ROOF_LABEL_KEY } from "./verdict-presentation";
import { type BodyType, type RoofType } from "@/lib/fitment/contract";

type Props = {
	saleorProductId: string;
	initial: ApplicationPage;
};

/** Above this many vehicles the list gets its search field. */
const SEARCH_FROM = 8;

function yearsOf(row: ApplicationRow, t: ReturnType<typeof useTranslations>): string {
	return row.yearTo === null
		? t("yearFromOnly", { from: row.yearFrom })
		: t("yearRange", { from: row.yearFrom, to: row.yearTo });
}

/** The one vehicle a product is made for, as a short block: the car, then years, body and roof. */
function SingleApplication({ row }: { row: ApplicationRow }) {
	const t = useTranslations("fitment");
	const facts = [
		yearsOf(row, t),
		row.bodyTypes?.map((b) => t(BODY_LABEL_KEY[b as BodyType])).join(", "),
		row.roofTypes?.map((r) => t(ROOF_LABEL_KEY[r as RoofType])).join(", "),
	].filter(Boolean);
	return (
		<div className="border-border-subtle bg-surface-secondary mt-4 rounded-xs border px-4 py-3.5 sm:px-5">
			<p className="text-text-primary text-base font-semibold">
				{row.makeName} {row.modelName} <span className="text-text-secondary">{row.generationName}</span>
				{!row.accepted && (
					<span className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed ml-2 rounded px-1.5 py-0.5 align-middle text-xs font-normal">
						{t("applicationsProvisional")}
					</span>
				)}
			</p>
			<p className="text-text-secondary mt-1 text-sm">{facts.join(" · ")}</p>
		</div>
	);
}

export function ProductVehicleApplications({ saleorProductId, initial }: Props) {
	const t = useTranslations("fitment");
	const [page, setPage] = useState<ApplicationPage>(initial);
	const [rows, setRows] = useState<ApplicationRow[]>(initial.rows);
	const [query, setQuery] = useState("");
	const [pending, startTransition] = useTransition();

	if (initial.unavailable) {
		return (
			<section aria-labelledby="fitment-applications">
				<h2 id="fitment-applications" className="text-text-primary text-lg font-semibold">
					{t("applicationsTitle")}
				</h2>
				<p className="text-text-tertiary mt-2 text-sm">{t("applicationsUnavailable")}</p>
			</section>
		);
	}

	const runSearch = (next: string) => {
		setQuery(next);
		startTransition(async () => {
			const result = await listProductApplications(saleorProductId, { query: next, offset: 0 });
			setPage(result);
			setRows(result.rows);
		});
	};

	const loadMore = () => {
		startTransition(async () => {
			const result = await listProductApplications(saleorProductId, { query, offset: rows.length });
			setPage(result);
			setRows((current) => [...current, ...result.rows]);
		});
	};

	return (
		<section
			aria-labelledby="fitment-applications"
			className="border-border-subtle bg-surface-card rounded-sm border p-5 shadow-xs sm:p-8 lg:p-10"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2
					id="fitment-applications"
					className="text-text-primary text-2xl font-bold tracking-[-0.02em] sm:text-[1.75rem]"
				>
					{t("applicationsTitle")}
				</h2>
				<p className="text-text-tertiary text-sm">{t("applicationsCount", { count: page.total })}</p>
			</div>

			{initial.total === 0 && !query ? (
				<p className="text-text-tertiary mt-2 text-sm">{t("applicationsEmpty")}</p>
			) : initial.total === 1 && initial.rows.length === 1 ? (
				// One car: its name and its facts, not a search field and a table of one row.
				<SingleApplication row={initial.rows[0]} />
			) : (
				<>
					{/* A search only where there is something to search: a set for three cars lists
					    them. */}
					{initial.total > SEARCH_FROM && (
						<div className="relative mt-3">
							<Search
								className="text-text-tertiary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
								aria-hidden="true"
							/>
							<Input
								type="search"
								value={query}
								onChange={(event) => runSearch(event.target.value)}
								aria-label={t("applicationsSearchLabel")}
								placeholder={t("applicationsSearchPlaceholder")}
								className="pl-9"
							/>
						</div>
					)}

					{/* The table scrolls in its own container. A wide table must never make
					    the whole page scroll sideways on a phone. */}
					<div className="mt-3 overflow-x-auto">
						<table className="w-full min-w-[34rem] text-left text-sm">
							<thead className="text-text-tertiary border-border-default border-b text-xs tracking-wide uppercase">
								<tr>
									<th scope="col" className="py-2 pr-3 font-medium">
										{t("brand")}
									</th>
									<th scope="col" className="py-2 pr-3 font-medium">
										{t("model")}
									</th>
									<th scope="col" className="py-2 pr-3 font-medium">
										{t("labelYear")}
									</th>
									<th scope="col" className="py-2 font-medium">
										{t("labelRoofType")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-border-subtle divide-y">
								{rows.map((row) => (
									<tr key={row.applicationId}>
										<td className="text-text-primary py-2 pr-3">{row.makeName}</td>
										<td className="text-text-primary py-2 pr-3">
											{row.modelName} <span className="text-text-tertiary">{row.generationName}</span>
											{!row.accepted && (
												<span className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed ml-2 rounded px-1.5 py-0.5 text-xs">
													{t("applicationsProvisional")}
												</span>
											)}
										</td>
										<td className="text-text-secondary py-2 pr-3 whitespace-nowrap">{yearsOf(row, t)}</td>
										<td className="text-text-secondary py-2">
											{row.roofTypes
												? row.roofTypes.map((r) => t(ROOF_LABEL_KEY[r as RoofType])).join(", ")
												: "—"}
											{row.bodyTypes && (
												<span className="text-text-tertiary block text-xs">
													{row.bodyTypes.map((b) => t(BODY_LABEL_KEY[b as BodyType])).join(", ")}
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{rows.length === 0 && query && (
						<p className="text-text-tertiary mt-3 text-sm">{t("applicationsNoMatch")}</p>
					)}

					{page.hasMore && (
						<Button
							type="button"
							variant="outline-solid"
							onClick={loadMore}
							disabled={pending}
							className="mt-3"
						>
							{pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							{t("applicationsShowMore")}
						</Button>
					)}
				</>
			)}
		</section>
	);
}
