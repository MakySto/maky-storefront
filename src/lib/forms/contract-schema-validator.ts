/**
 * A validator that READS the vendored contract instead of restating it.
 *
 * This is the harness that makes the storefront's Payload mock strict. The distinction
 * matters more than it sounds: the previous mock was hand-written from the same
 * assumptions as the client, so it accepted every mistake the client made. Three of them
 * survived a green 367-test suite and would each have failed 100 % of real requests — a
 * millisecond timestamp, a `noticeSnapshot` in the body, a `customer.phone` the endpoint
 * did not then allow. A mock that agrees with the client is not a test, it is an echo.
 *
 * So nothing here knows what a withdrawal looks like. It walks
 * `__fixtures__/forms-backend-v1/withdrawal.schema.json`, and if Payload changes the
 * contract, re-vendoring the file changes what this accepts — without anyone remembering
 * to update a second copy of the rules.
 *
 * ## Why not a JSON Schema library
 *
 * Two reasons, in order of weight. First, `withdrawal.schema.json` is not plain JSON
 * Schema: its `x-normalization` / `x-normalizedMaxLength` / `x-normalizedLengthUnit`
 * keywords are declared **normative** by the schema itself, which states that a validator
 * ignoring them "provides only a structural precheck". A stock validator would pass
 * bodies Payload rejects — precisely the failure this file exists to prevent. Second,
 * adding a dependency for styling or tooling needs approval (CLAUDE.md §10), and none is
 * in the tree.
 *
 * The supported keyword set is exactly what this schema uses, and an unrecognised keyword
 * is a hard error rather than a silent skip — otherwise a future contract could add a
 * constraint and this would quietly stop enforcing it. That is the same failure mode in a
 * new coat.
 */

export interface SchemaViolation {
	/** JSON-Pointer-ish path to the offending value, e.g. `/customer/phone`. */
	readonly path: string;
	/** The keyword that rejected it — `additionalProperties`, `x-normalizedMaxLength`, … */
	readonly keyword: string;
	readonly message: string;
}

type Json = unknown;
type Schema = Record<string, Json>;

/** Keywords this walker implements. Anything else in a schema is a hard error. */
const SUPPORTED = new Set([
	"$schema",
	"$id",
	"title",
	"description",
	"$defs",
	"$ref",
	"type",
	"enum",
	"const",
	"required",
	"properties",
	"additionalProperties",
	"pattern",
	"items",
	"minItems",
	"maxItems",
	"minimum",
	"maximum",
	"allOf",
	"oneOf",
	"if",
	"then",
	"else",
	// Normative normalization vocabulary — see the schema's own
	// `x-normalizedStringSemantics` block.
	"x-normalizedStringSemantics",
	"x-normalization",
	"x-normalizedMinLength",
	"x-normalizedMaxLength",
	"x-normalizedLengthUnit",
	"x-normalizedFormat",
	"x-normalizedPattern",
	"x-normalizedPatternFlags",
]);

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Length in the unit the schema names.
 *
 * `"unicode-code-points"` is not a pedantic distinction: `"…".length` counts UTF-16 code
 * units, so a single astral character counts twice and a value Payload accepts would be
 * rejected here (or the reverse). Spreading a string iterates code points.
 */
function measure(value: string, unit: Json): number {
	if (unit === "unicode-code-points") return [...value].length;
	if (unit === "utf16-code-units" || unit === undefined) return value.length;
	throw new Error(`unsupported x-normalizedLengthUnit: ${JSON.stringify(unit)}`);
}

function typeMatches(value: Json, type: string): boolean {
	switch (type) {
		case "object":
			return isObject(value);
		case "array":
			return Array.isArray(value);
		case "string":
			return typeof value === "string";
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "null":
			return value === null;
		default:
			throw new Error(`unsupported type: ${type}`);
	}
}

export class ContractSchemaValidator {
	private readonly root: Schema;

	constructor(schema: Schema) {
		this.root = schema;
		this.assertSupported(schema, "#");
	}

	/** Every violation, not just the first — a 400 usually has one cause but not always. */
	validate(value: Json): SchemaViolation[] {
		const violations: SchemaViolation[] = [];
		this.walk(value, this.root, "", violations);
		return violations;
	}

	isValid(value: Json): boolean {
		return this.validate(value).length === 0;
	}

	/**
	 * Refuse to run against a schema using a keyword this walker does not implement.
	 *
	 * Without it, re-vendoring a contract that adds a constraint would leave the mock
	 * silently permissive again — the exact hole this whole file exists to close.
	 */
	private assertSupported(schema: Json, path: string): void {
		if (!isObject(schema)) return;
		for (const keyword of Object.keys(schema)) {
			if (!SUPPORTED.has(keyword)) {
				throw new Error(`contract schema uses unsupported keyword "${keyword}" at ${path}`);
			}
		}
		for (const key of ["properties", "$defs"] as const) {
			const group = schema[key];
			if (isObject(group)) {
				for (const [name, sub] of Object.entries(group)) this.assertSupported(sub, `${path}/${key}/${name}`);
			}
		}
		for (const key of ["allOf", "oneOf"] as const) {
			const group = schema[key];
			if (Array.isArray(group)) group.forEach((sub, i) => this.assertSupported(sub, `${path}/${key}/${i}`));
		}
		for (const key of ["if", "then", "else", "items", "additionalProperties"] as const) {
			if (key in schema) this.assertSupported(schema[key], `${path}/${key}`);
		}
	}

	private resolve(schema: Schema): Schema {
		const ref = schema.$ref;
		if (typeof ref !== "string") return schema;
		if (!ref.startsWith("#/$defs/")) throw new Error(`unsupported $ref: ${ref}`);
		const defs = this.root.$defs;
		const target = isObject(defs) ? defs[ref.slice("#/$defs/".length)] : undefined;
		if (!isObject(target)) throw new Error(`unresolvable $ref: ${ref}`);
		return target;
	}

	private matches(value: Json, schema: Schema): boolean {
		const found: SchemaViolation[] = [];
		this.walk(value, schema, "", found);
		return found.length === 0;
	}

	private walk(value: Json, rawSchema: Schema, path: string, out: SchemaViolation[]): void {
		const schema = this.resolve(rawSchema);
		const at = (keyword: string, message: string) => out.push({ path: path || "/", keyword, message });

		// --- type -------------------------------------------------------------
		const type = schema.type;
		if (typeof type === "string" && !typeMatches(value, type)) {
			return void at("type", `expected ${type}`);
		}
		if (Array.isArray(type) && !type.some((t) => typeMatches(value, String(t)))) {
			return void at("type", `expected one of ${type.join(" | ")}`);
		}

		// --- enum / const -----------------------------------------------------
		if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
			at("enum", `expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`);
		}
		if ("const" in schema && value !== schema.const) {
			at("const", `expected ${JSON.stringify(schema.const)}`);
		}

		// --- strings ----------------------------------------------------------
		if (typeof value === "string") this.checkString(value, schema, path, out);

		// --- numbers ----------------------------------------------------------
		if (typeof value === "number") {
			if (typeof schema.minimum === "number" && value < schema.minimum) {
				at("minimum", `must be >= ${schema.minimum}`);
			}
			if (typeof schema.maximum === "number" && value > schema.maximum) {
				at("maximum", `must be <= ${schema.maximum}`);
			}
		}

		// --- objects ----------------------------------------------------------
		if (isObject(value)) {
			const properties = isObject(schema.properties) ? schema.properties : {};

			if (Array.isArray(schema.required)) {
				for (const key of schema.required) {
					if (!(String(key) in value)) at("required", `missing required property "${String(key)}"`);
				}
			}

			// The single most valuable rule in this contract: Payload answers 400 to one
			// extra key, at every level.
			if (schema.additionalProperties === false) {
				for (const key of Object.keys(value)) {
					if (!(key in properties)) {
						out.push({
							path: `${path}/${key}`,
							keyword: "additionalProperties",
							message: `unknown property "${key}" is not on the allowlist`,
						});
					}
				}
			}

			for (const [key, sub] of Object.entries(properties)) {
				if (key in value && isObject(sub)) this.walk(value[key], sub, `${path}/${key}`, out);
			}
		}

		// --- arrays -----------------------------------------------------------
		if (Array.isArray(value)) {
			if (typeof schema.minItems === "number" && value.length < schema.minItems) {
				at("minItems", `expected at least ${schema.minItems} item(s)`);
			}
			if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
				at("maxItems", `expected at most ${schema.maxItems} item(s)`);
			}
			if (isObject(schema.items)) {
				value.forEach((entry, i) => this.walk(entry, schema.items as Schema, `${path}/${i}`, out));
			}
		}

		// --- combinators ------------------------------------------------------
		if (Array.isArray(schema.allOf)) {
			for (const sub of schema.allOf) if (isObject(sub)) this.walk(value, sub, path, out);
		}

		if (Array.isArray(schema.oneOf)) {
			const matched = schema.oneOf.filter((sub) => isObject(sub) && this.matches(value, sub)).length;
			if (matched !== 1) at("oneOf", `expected exactly one branch to match, ${matched} did`);
		}

		if (isObject(schema.if)) {
			const branch = this.matches(value, schema.if) ? schema.then : schema.else;
			if (isObject(branch)) this.walk(value, branch, path, out);
		}
	}

	/**
	 * String checks, including the normative normalization vocabulary.
	 *
	 * The order is the contract's own: trim first, then measure and match the TRIMMED
	 * value. `pattern` is the exception — it applies to the raw value, because its job in
	 * this contract is to reject control characters, and trimming would hide a trailing
	 * newline that is exactly what it is guarding against.
	 */
	private checkString(value: string, schema: Schema, path: string, out: SchemaViolation[]): void {
		const at = (keyword: string, message: string) => out.push({ path: path || "/", keyword, message });

		if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
			at("pattern", `does not match ${schema.pattern}`);
		}

		const normalization = schema["x-normalization"];
		if (normalization === undefined) return;
		if (normalization !== "trim-required" && normalization !== "trim-empty-to-null") {
			throw new Error(`unsupported x-normalization: ${JSON.stringify(normalization)}`);
		}

		const trimmed = value.trim();

		// `trim-empty-to-null` means a blank string IS a valid way to say null. Length and
		// format checks do not apply to a value that normalizes away.
		if (normalization === "trim-empty-to-null" && trimmed.length === 0) return;

		const unit = schema["x-normalizedLengthUnit"];
		const length = measure(trimmed, unit);

		const min = schema["x-normalizedMinLength"];
		if (typeof min === "number" && length < min) {
			at("x-normalizedMinLength", `normalized length ${length} is below ${min}`);
		}
		const max = schema["x-normalizedMaxLength"];
		if (typeof max === "number" && length > max) {
			at("x-normalizedMaxLength", `normalized length ${length} exceeds ${max} (${String(unit)})`);
		}

		const normalizedPattern = schema["x-normalizedPattern"];
		if (typeof normalizedPattern === "string") {
			const flags = schema["x-normalizedPatternFlags"];
			if (!new RegExp(normalizedPattern, typeof flags === "string" ? flags : undefined).test(trimmed)) {
				at("x-normalizedPattern", `normalized value does not match ${normalizedPattern}`);
			}
		}
	}
}
