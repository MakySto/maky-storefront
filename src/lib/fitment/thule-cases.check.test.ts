import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
	EMPTY_GARAGE,
	encodeGarageCookie,
	fromVehicleSelection,
	type GaragePayload,
} from "@/lib/garage/cookie";
import type { FitmentDataset, VehicleSelection } from "./contract";
import { resolveVehicleOutcome } from "./resolve";
import { validateFitmentDataset } from "./validate";

/**
 * CFM's 28 cases (`M_TEST_CASES.json`), asked of THIS build's resolver — and, where it is given the
 * garage secret, turned into the cookies a browser would hold, so the same 28 can be walked over
 * HTTP against a running server and intersected with what the shop really sells.
 *
 *   M_CASES=<M_TEST_CASES.json> M_CASES_DATASET=<dataset>.json M_CASES_OUT=<report>.json \
 *   [MAKY_GARAGE_COOKIE_SECRET=…] npx vitest run src/lib/fitment/thule-cases.check.test.ts
 *
 * What it checks is the SECOND half of CFM's own sentence: "the expected resolver answer in the file
 * is not yet the expected commercial offer". This is the resolver half — do the two resolvers agree on
 * every product and every verdict — and nothing here says a product may be bought. That is Saleor's
 * answer, and it is asked over HTTP.
 *
 * Skipped without the three paths. The secret is read from the environment and never written out; the
 * cookies it produces select a car and nothing else, and belong in a scratch directory.
 */
const CASES = process.env.M_CASES?.trim();
const DATASET = process.env.M_CASES_DATASET?.trim();
const OUT = process.env.M_CASES_OUT?.trim();
const available = Boolean(CASES && DATASET && OUT);

type Expected = {
	saleorProductId: string;
	verdict?: string;
	reason?: string;
	conditions?: string[];
};

type Case = {
	category: string;
	note: string;
	set: { saleorProductId: string; externalReference: string; sourceRef: string; sourceWindow: string };
	vehicle: { make: string; model: string; generation: string; urlPath: string | null };
	selection: VehicleSelection;
	setOffered?: boolean;
	/** Absent in a case list we generated ourselves: there is then nothing of CFM's to compare with. */
	answer?: { verified: Expected[]; unconfirmed: Expected[]; rejected: Expected[]; unanswerable: boolean };
};

describe.skipIf(!available)("CFM's 28 cases against this build's resolver", () => {
	it("agrees on every product and every verdict", () => {
		const file = JSON.parse(readFileSync(CASES as string, "utf8")) as {
			dataset: { datasetHash: string };
			cases: Case[];
		};
		const text = readFileSync(DATASET as string, "utf8");
		const result = validateFitmentDataset(JSON.parse(text), {
			expectedSaleorInstance: "api.maky.store",
			rawText: text,
		});
		if (!result.ok) throw new Error(result.errors.join("; "));
		const dataset: FitmentDataset = result.dataset;
		expect(dataset.datasetHash, "the cases were made against another dataset").toBe(file.dataset.datasetHash);

		const secret = process.env.MAKY_GARAGE_COOKIE_SECRET?.trim() || null;
		const rows = file.cases.map((c, index) => {
			const outcome = resolveVehicleOutcome(dataset, c.selection);
			const ours = {
				verified: outcome.verified.map((o) => o.ref.saleorProductId).sort(),
				unconfirmed: outcome.unconfirmed.map((o) => `${o.ref.saleorProductId}:${o.result.verdict}`).sort(),
				rejected: outcome.rejected.map((o) => o.ref.saleorProductId).sort(),
			};
			// A case list we generated has no CFM answer: it is then compared with itself, so the parity
			// column reads "agrees" and the file is used only for what it carries — the selections.
			const expected = c.answer ?? null;
			const theirs = expected
				? {
						verified: expected.verified.map((e) => e.saleorProductId).sort(),
						unconfirmed: expected.unconfirmed.map((e) => `${e.saleorProductId}:${e.verdict}`).sort(),
						rejected: expected.rejected.map((e) => e.saleorProductId).sort(),
					}
				: ours;
			const conditionsOurs = outcome.verified
				.filter((o) => o.result.conditions.length > 0)
				.map((o) => `${o.ref.saleorProductId}:${o.result.conditions.map((x) => x.code).join("+")}`)
				.sort();
			const conditionsTheirs = expected
				? expected.verified
						.filter((e) => (e.conditions ?? []).length > 0)
						.map((e) => `${e.saleorProductId}:${(e.conditions ?? []).join("+")}`)
						.sort()
				: conditionsOurs;
			const offered = ours.verified.includes(c.set.saleorProductId);

			let cookie: string | null = null;
			if (secret) {
				const payload: GaragePayload = {
					...EMPTY_GARAGE,
					u: fromVehicleSelection(c.selection),
					dv: dataset.datasetVersion,
				};
				cookie = encodeGarageCookie(payload, secret);
			}

			return {
				index: index + 1,
				category: c.category,
				vehicle: `${c.vehicle.make} ${c.vehicle.model} ${c.vehicle.generation}`,
				selection: {
					year: c.selection.year,
					roofType: c.selection.roofType ?? null,
					bodyType: c.selection.bodyType ?? null,
				},
				set: c.set.externalReference,
				setProductId: c.set.saleorProductId,
				cfm: {
					setOffered: c.setOffered ?? null,
					counts: {
						verified: theirs.verified.length,
						unconfirmed: theirs.unconfirmed.length,
						rejected: theirs.rejected.length,
					},
				},
				ours: {
					setOffered: offered,
					counts: {
						verified: ours.verified.length,
						unconfirmed: ours.unconfirmed.length,
						rejected: ours.rejected.length,
					},
					unanswerable: outcome.unanswerable,
				},
				verifiedIds: ours.verified,
				agrees:
					JSON.stringify(ours) === JSON.stringify(theirs) &&
					offered === (c.setOffered ?? offered) &&
					outcome.unanswerable === (expected?.unanswerable ?? outcome.unanswerable) &&
					JSON.stringify(conditionsOurs) === JSON.stringify(conditionsTheirs),
				differences: {
					verifiedOnlyOurs: ours.verified.filter((id) => !theirs.verified.includes(id)),
					verifiedOnlyTheirs: theirs.verified.filter((id) => !ours.verified.includes(id)),
					unconfirmedOnlyOurs: ours.unconfirmed.filter((id) => !theirs.unconfirmed.includes(id)),
					unconfirmedOnlyTheirs: theirs.unconfirmed.filter((id) => !ours.unconfirmed.includes(id)),
					conditionsOurs,
					conditionsTheirs,
				},
				cookie,
			};
		});

		const summary = {
			dataset: dataset.datasetVersion,
			datasetHash: dataset.datasetHash,
			cases: rows.length,
			agree: rows.filter((r) => r.agrees).length,
			disagree: rows.filter((r) => !r.agrees).map((r) => r.index),
			cookiesWritten: rows.filter((r) => r.cookie).length,
		};
		writeFileSync(OUT as string, JSON.stringify({ summary, rows }, null, 1));
		console.log(JSON.stringify(summary));
		expect(summary.disagree).toEqual([]);
	}, 120_000);
});
