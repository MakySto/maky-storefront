import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	COOLER_SKUS,
	judge,
	NUMERIC_FACTS,
	readTemplate,
	YES_FACT,
} from "../../scripts/checks/fridge-attributes.mjs";
import { FRIDGE_ATTRIBUTES, fridgeValues } from "../../scripts/sandbox/coolz-attributes.mjs";
import {
	formatProductAttributeValue,
	formatTemperatureRange,
	type AttributeInput,
} from "./product-attributes";
import { groupParameters, PRODUCT_TEMPLATES, TEMPERATURE_RANGE_REF } from "./product-templates";

/**
 * `scripts/checks/fridge-attributes.mjs` (`pnpm check:fridge`) judges the attributes a Saleor
 * serves for the five CoolZ coolers against what the car-fridge template needs. It is a second
 * reader of the template's rules, so what these tests hold is that it agrees with the first: the
 * page's own functions, run on the same rows. Rows come from the sandbox definitions
 * (`scripts/sandbox/coolz-attributes.mjs`), which carry the real keys and types.
 */
const SCRIPT = join(__dirname, "../../scripts/checks/fridge-attributes.mjs");
const TEMPLATE = PRODUCT_TEMPLATES.autochladnicka;
const template = readTemplate(readFileSync(join(__dirname, "product-templates.ts"), "utf8"));

type Change = (key: string, row: AttributeInput) => AttributeInput | null;

/** One cooler's attributes as Saleor returns them; `change` edits or drops a row by its key. */
function attributesOf(sku: string, change: Change = (_key, row) => row): AttributeInput[] {
	const values = fridgeValues(sku) as Record<string, string | boolean | undefined>;
	return FRIDGE_ATTRIBUTES.flatMap(([key, name, inputType]) => {
		const value = values[key];
		if (value === undefined) return [];
		const row: AttributeInput = {
			attribute: {
				slug: key.replace(/_/g, "-"),
				name,
				externalReference: `cfm:attribute:${key}`,
				inputType,
				unit: null,
			},
			values: [
				typeof value === "boolean"
					? { name: value ? "Yes" : "No", boolean: value }
					: { name: String(value), boolean: null },
			],
		};
		const changed = change(key, row);
		return changed ? [changed] : [];
	});
}

const productOf = (sku: string, change?: Change) => ({
	name: `CoolZ ${sku}`,
	slug: sku.toLowerCase(),
	variants: [{ sku }],
	attributes: attributesOf(sku, change),
});
const coolers = (change?: Change) => COOLER_SKUS.map((sku: string) => productOf(sku, change));

/** The page's own rows (`ProductSpecs`): a name and a value are what make a row. */
const pageRows = (attributes: AttributeInput[]) =>
	attributes
		.map((a) => ({
			ref: a.attribute.externalReference ?? "",
			label: a.attribute.name ?? "",
			values: formatProductAttributeValue(a, "sk-SK", { yes: "Áno", no: "Nie" }),
		}))
		.filter((row) => row.label && row.values.length > 0);
const pageGroups = (attributes: AttributeInput[]) => groupParameters(TEMPLATE, pageRows(attributes));
const pageRange = (attributes: AttributeInput[]) =>
	formatTemperatureRange(attributes, "sk-SK", (a, b) => `${a}–${b}`);

type Judged = {
	sku: string;
	name: string | null;
	problems: string[];
	notes: string[];
	rows: unknown[];
	known?: number;
	facts?: Record<string, unknown>;
};
const judged = (products: ReturnType<typeof coolers>) => judge(products, template) as Judged[];
const edit =
	(key: string, to: (row: AttributeInput) => AttributeInput | null): Change =>
	(k, row) =>
		k === key ? to(row) : row;
const withValue = (value: string) => (row: AttributeInput) => ({
	...row,
	values: [{ name: value, boolean: null }],
});

describe("what it reads from the template", () => {
	it("takes the references the template groups, and nothing else", () => {
		const grouped = TEMPLATE.groups
			.flatMap((group) => group.refs)
			.filter((ref) => ref !== TEMPERATURE_RANGE_REF);
		expect([...template.refs].sort()).toEqual([...new Set(grouped)].sort());
	});

	it("takes the threshold the grouping really applies", () => {
		const refs = template.refs.slice(0, 6);
		for (let n = 0; n <= 5; n++) {
			const rows = refs.slice(0, n).map((ref) => ({ ref, label: ref, values: ["x"] }));
			expect(groupParameters(TEMPLATE, rows) !== null, `${n} rows`).toBe(
				n >= (template.minGroupedRows as number),
			);
		}
	});

	it("judges the facts the template's band is made of", () => {
		const keys = TEMPLATE.facts.flatMap((fact) =>
			fact.kind === "attribute" ? [fact.ref.replace("cfm:attribute:", "")] : [],
		);
		for (const key of keys) expect([...NUMERIC_FACTS, YES_FACT], key).toContain(key);
		expect(TEMPLATE.facts.some((fact) => fact.kind === "range")).toBe(true);
		expect(NUMERIC_FACTS).toEqual(expect.arrayContaining(["temperature_min", "temperature_max"]));
	});

	it("reads nothing out of a source that is not the template", () => {
		expect(readTemplate("export const nothing = 1;")).toEqual({ refs: [], minGroupedRows: null });
	});
});

describe("judge", () => {
	it("passes the five coolers with the sandbox attributes, and the page's own code agrees", () => {
		const result = judged(coolers());
		expect(result).toHaveLength(5);
		for (const [i, item] of result.entries()) {
			expect(item.problems, item.sku).toEqual([]);
			expect(item.notes, item.sku).toEqual([]);
			const attributes = coolers()[i].attributes;
			expect(pageGroups(attributes), item.sku).not.toBeNull();
			expect(pageRange(attributes), item.sku).not.toBeNull();
		}
		expect(result[1].facts).toEqual({
			volume: "32",
			rated_power: "60",
			temperature_min: "-20",
			temperature_max: "20",
			bluetooth_app_control: true,
		});
	});

	it("does not judge what is not a cooler", () => {
		const accessory = {
			name: "CoolZ Power",
			slug: "coolz-power",
			variants: [{ sku: "TK20414" }],
			attributes: [],
		};
		const result = judged([...coolers(), accessory]);
		expect(result.map((item) => item.sku)).toEqual(COOLER_SKUS);
		expect(result.every((item) => item.problems.length === 0)).toBe(true);
	});

	it("fails when no row carries a reference, and the page then keeps its flat list", () => {
		const noRefs: Change = (_key, row) => ({
			...row,
			attribute: { ...row.attribute, externalReference: null },
		});
		const [first] = judged(coolers(noRefs));
		expect(first.problems.length).toBeGreaterThanOrEqual(NUMERIC_FACTS.length + 1);
		expect(first.problems.join("\n")).toMatch(/volume: no row/);
		expect(first.problems.join("\n")).toMatch(/0 of \d+ rows are named by the template/);
		const attributes = coolers(noRefs)[0].attributes;
		expect(pageGroups(attributes)).toBeNull();
		expect(pageRange(attributes)).toBeNull();
	});

	it("fails on a number written as text, because the page would show it without a unit", () => {
		const change = edit("volume", withValue("32 L"));
		const [, second] = judged(coolers(change));
		expect(second.problems).toEqual([expect.stringMatching(/volume: "32 L" is not a plain number/)]);
		// What the page does with it: the text as it came, so the band's volume fact is not a number.
		const row = attributesOf("TK20410", change).find(
			(a) => a.attribute.externalReference === "cfm:attribute:volume",
		);
		expect(formatProductAttributeValue(row as AttributeInput, "sk-SK")).toEqual(["32 L"]);
	});

	it("fails when one end of the temperature range is missing or the ends are the wrong way round", () => {
		const missing = judged(coolers(edit("temperature_max", () => null)));
		expect(missing[0].problems).toEqual([expect.stringMatching(/temperature_max: no row/)]);
		expect(pageRange(coolers(edit("temperature_max", () => null))[0].attributes)).toBeNull();

		const turned = judged(coolers(edit("temperature_min", withValue("30"))));
		expect(turned[0].problems).toEqual([expect.stringMatching(/30 is above 20/)]);
		expect(pageRange(coolers(edit("temperature_min", withValue("30")))[0].attributes)).toBeNull();
	});

	it("fails when fewer rows than the grouping needs are named, and the page then keeps its flat list", () => {
		// Only the volume and power rows keep their reference: two named rows.
		const keep: Change = (key, row) =>
			["volume", "rated_power"].includes(key)
				? row
				: { ...row, attribute: { ...row.attribute, externalReference: null } };
		const [first] = judged(coolers(keep));
		expect(first.problems.join("\n")).toMatch(
			/2 of \d+ rows are named by the template \(at least 3 needed\)/,
		);
		expect(pageGroups(coolers(keep)[0].attributes)).toBeNull();
	});

	it("only notes a Bluetooth fact that is not a yes: the band still has its numbers", () => {
		const no = judged(
			coolers(edit(YES_FACT, (row) => ({ ...row, values: [{ name: "No", boolean: false }] }))),
		);
		expect(no[0].problems).toEqual([]);
		expect(no[0].notes).toEqual([expect.stringMatching(/a no, so no Bluetooth fact/)]);

		const missing = judged(coolers(edit(YES_FACT, () => null)));
		expect(missing[0].problems).toEqual([]);
		expect(missing[0].notes).toEqual([expect.stringMatching(/no row/)]);

		const text = judged(
			coolers(
				edit(YES_FACT, (row) => ({ ...row, attribute: { ...row.attribute, inputType: "PLAIN_TEXT" } })),
			),
		);
		expect(text[0].notes).toEqual([expect.stringMatching(/PLAIN_TEXT instead of BOOLEAN/)]);
	});

	it("fails for a cooler the channel did not return", () => {
		const result = judged(coolers().filter((product) => product.variants[0].sku !== "TK20412"));
		const missing = result.find((item) => item.sku === "TK20412");
		expect(missing?.problems).toEqual([expect.stringMatching(/not returned/)]);
		expect(result.filter((item) => item.problems.length > 0)).toHaveLength(1);
	});

	it("ignores a row the page would not draw (no name, no value)", () => {
		const drop: Change = (key, row) =>
			key === "volume" ? { ...row, attribute: { ...row.attribute, name: "" } } : row;
		const [first] = judged(coolers(drop));
		expect(first.problems).toEqual([expect.stringMatching(/volume: no row/)]);
		expect(pageRows(coolers(drop)[0].attributes).some((row) => row.ref === "cfm:attribute:volume")).toBe(
			false,
		);
	});
});

describe("the script", () => {
	/** A bare environment: the script must not find an address by accident. */
	const bareEnv = (extra: Record<string, string> = {}) =>
		({ PATH: process.env.PATH ?? "", NODE_ENV: "test", ...extra }) as NodeJS.ProcessEnv;
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	const response = (products: ReturnType<typeof coolers>) => ({
		data: { category: { products: { edges: products.map((node) => ({ node })) } } },
	});
	function run(body: unknown, extra: string[] = []) {
		const dir = mkdtempSync(join(tmpdir(), "fridge-attributes-"));
		dirs.push(dir);
		const file = join(dir, "response.json");
		writeFileSync(file, JSON.stringify(body));
		const result = spawnSync(process.execPath, [SCRIPT, "--from-file", file, ...extra], {
			encoding: "utf8",
			timeout: 20_000,
			env: bareEnv(),
		});
		return { code: result.status, out: result.stdout, err: result.stderr };
	}

	it("exits 0 and says so when every cooler gets the approved page", () => {
		const { code, out } = run(response(coolers()));
		expect(code).toBe(0);
		expect(out).toMatch(/PASS: every cooler gets the approved page/);
		expect(out).toMatch(
			/band: volume 32 · rated_power 60 · temperature_min -20 · temperature_max 20 · bluetooth yes/,
		);
	});

	it("exits 1 and names the cooler and the row when one would not", () => {
		const body = response([...coolers(edit("rated_power", withValue("60 W")))]);
		const { code, out } = run(body);
		expect(code).toBe(1);
		expect(out).toMatch(/FAIL {2}TK20409/);
		expect(out).toMatch(/rated_power: "60 W" is not a plain number/);
		expect(out).toMatch(/FAIL: 5 of 5 coolers would not/);
	});

	it("answers the same in JSON, with the template it read", () => {
		const { code, out } = run(response(coolers()), ["--json"]);
		const report = JSON.parse(out) as { pass: boolean; refs: string[]; checked: unknown[] };
		expect(code).toBe(0);
		expect(report.pass).toBe(true);
		expect(report.refs).toEqual(template.refs);
		expect(report.checked).toHaveLength(5);
	});

	it("narrows to the coolers it is told about", () => {
		const { code, out } = run(response(coolers()), ["--sku", "TK20410", "--json"]);
		expect(code).toBe(0);
		expect((JSON.parse(out) as { checked: { sku: string }[] }).checked.map((item) => item.sku)).toEqual([
			"TK20410",
		]);
	});

	it("lists every row with --verbose", () => {
		const { out } = run(response(coolers()), ["--verbose", "--sku", "TK20410"]);
		expect(out).toMatch(/cfm:attribute:volume \[NUMERIC\] Objem: 32/);
	});

	it("exits 2, which is not a pass, when it cannot judge", () => {
		for (const [name, body] of [
			["GraphQL errors", { errors: [{ message: "boom" }] }],
			["no category", { data: { category: null } }],
			["no data", {}],
		] as const) {
			const { code, err } = run(body);
			expect(code, name).toBe(2);
			expect(err, name).toMatch(/check could not run/);
		}
	});

	it("exits 2 with nothing to ask when there is no address, and never prints one it was given", () => {
		const bare = spawnSync(process.execPath, [SCRIPT], {
			encoding: "utf8",
			timeout: 20_000,
			env: bareEnv(),
		});
		expect(bare.status).toBe(2);
		expect(bare.stderr).toMatch(/no address/);

		const secret = "http://127.0.0.1:9/graphql/?token=never-print-this";
		const refused = spawnSync(process.execPath, [SCRIPT], {
			encoding: "utf8",
			timeout: 20_000,
			env: bareEnv({ NEXT_PUBLIC_SALEOR_API_URL: secret }),
		});
		expect(refused.status).toBe(2);
		expect(refused.stdout + refused.stderr).not.toMatch(/never-print-this|127\.0\.0\.1/);
	});
});
