import { generateOffline, missingGeneratedFiles } from "./scripts/generate-offline.mjs";

/**
 * The generated GraphQL types (`src/gql`, `src/checkout/graphql/generated`) are gitignored build output,
 * and a great many modules import them, so a checkout without them does not fail one test: it fails every
 * file that reaches them, on import, with "Cannot find package '@/gql/graphql'". A sandbox's fresh clone is
 * exactly that, and the dozens of failures that followed were taken for the suite's own baseline.
 *
 * When they are missing this generates them from the schema of the Saleor version production runs
 * (`scripts/generate-offline.mjs`) before the first test, and says so. A tree that already has them, which
 * is every deployed one, costs a file check. If they cannot be generated the run stops here with that
 * reason, instead of reporting the consequences as failing tests.
 */
export default async function setup() {
	const missing = missingGeneratedFiles().join(", ");
	if (!missing) return;

	console.warn(
		`[vitest] Missing ${missing}: generating the GraphQL types offline (pnpm run generate:offline)`,
	);
	try {
		await generateOffline({ quiet: true });
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(
			[
				`The generated GraphQL types are missing (${missing}) and could not be generated offline.`,
				reason,
				"Without them most tests fail on import. Run `pnpm run generate:all` against a reachable Saleor, then run the tests again.",
			].join("\n"),
			{ cause: error },
		);
	}
}
