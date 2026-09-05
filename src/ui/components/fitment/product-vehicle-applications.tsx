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
		<section aria-labelledby="fitment-applications">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="fitment-applications" className="text-text-primary text-lg font-semibold">
					{t("applicationsTitle")}
				</h2>
				<p className="text-text-tertiary text-sm">{t("applicationsCount", { count: page.total })}</p>
			</div>

			{initial.total === 0 && !query ? (
				<p className="text-text-tertiary mt-2 text-sm">{t("applicationsEmpty")}</p>
			) : (
				<>
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
											{!row.verified && (
												<span className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed ml-2 rounded px-1.5 py-0.5 text-xs">
													{t("applicationsProvisional")}
												</span>
											)}
										</td>
										<td className="text-text-secondary py-2 pr-3 whitespace-nowrap">
											{row.yearTo === null
												? t("yearFromOnly", { from: row.yearFrom })
												: t("yearRange", { from: row.yearFrom, to: row.yearTo })}
										</td>
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
