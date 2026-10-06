import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractCommerceUsage } from "../../scripts/i18n/extract-commerce-usage.mjs";

/**
 * `pnpm i18n:check` chains three plain-node gates, and a chain stops at the first one that fails, so a gate
 * that is wrong hides the ones behind it. For weeks the first reported a key no component uses, and so nobody
 * saw that the second could no longer read the code it checks. These pin both against the tree.
 */
let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "i18n-usage-"));
	mkdirSync(join(root, "src"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const usedKeys = (source: string) => {
	writeFileSync(join(root, "src/component.tsx"), source);
	return Object.fromEntries(extractCommerceUsage(root).keys);
};

describe("scripts/i18n/extract-commerce-usage.mjs", () => {
	it("gives each call the namespace of the nearest binding above it", () => {
		// `address-actions.tsx` binds `t` to `account.address` in one component and to `checkout.addressForm`
		// in the next: the first one's `t("delete")` is not `checkout.addressForm.delete`.
		const keys = usedKeys(`
export function First() {
	const t = useTranslations("cart.drawer");
	return t("close");
}

export function Second() {
	const t = useTranslations("checkout.addressForm");
	return t("edit");
}
`);

		expect(keys).toEqual({
			"cart.drawer.close": ["src/component.tsx:4"],
			"checkout.addressForm.edit": ["src/component.tsx:9"],
		});
	});

	it("gives a call above every binding the first binding below it", () => {
		const keys = usedKeys(`
const label = (t) => t("title");

export function Section() {
	const t = useTranslations("checkout.summary");
	return t("total");
}
`);

		expect(Object.keys(keys).sort()).toEqual(["checkout.summary.title", "checkout.summary.total"]);
	});
});

describe("scripts/i18n/check-locale-matrix.mjs", () => {
	it("still reads LOCALE_MAP and CHANNEL_MAP, and the matrix agrees with them", () => {
		const result = spawnSync(
			process.execPath,
			[join(__dirname, "../../scripts/i18n/check-locale-matrix.mjs")],
			{
				encoding: "utf8",
				// No Saleor credentials: the optional live channel check stays off and this needs no network.
				env: { PATH: process.env.PATH } as unknown as NodeJS.ProcessEnv,
				timeout: 20_000,
			},
		);

		expect(result.stderr).not.toContain("could not parse");
		expect(result.stdout + result.stderr).toContain("locale matrix OK");
		expect(result.status).toBe(0);
	});
});
