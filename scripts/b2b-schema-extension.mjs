// The MAKY-B2B-V1 part of the backend's GraphQL schema, as an extension of the Saleor schema production runs.
//
//   node scripts/b2b-schema-extension.mjs <maky-saleor checkout>/saleor/graphql/schema.graphql           # write
//   node scripts/b2b-schema-extension.mjs <maky-saleor checkout>/saleor/graphql/schema.graphql --check   # compare
//
// `src/checkout/lib/b2b/maky-b2b-v1.graphql` is what `graphql.test.ts` validates the storefront's B2B documents
// against, and runs the readiness probe on. It is not written by hand: this derives it from the schema the backend
// commits (`saleor/graphql/schema.graphql` of MakySto/maky-saleor) as everything that schema adds to the pinned
// Saleor 3.23.31 (`SALEOR_SCHEMA` in generate-offline.mjs), and nothing else.
//
// It refuses a backend schema that removes or changes anything 3.23.31 already has (the storefront's generated types
// would no longer describe that backend), and it proves its own result: the pinned schema extended by the file has
// exactly the backend's types, fields, arguments and enum values. The provenance (repository, commit, file hash) goes
// into the file's header; the commit is read from the backend checkout's git, or given as `--commit <sha>`.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	buildSchema,
	extendSchema,
	GraphQLEnumType,
	GraphQLInputObjectType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	isEnumType,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
	isUnionType,
	parse,
	printType,
} from "graphql";

import { ensureSchema, SALEOR_SCHEMA } from "./generate-offline.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const EXTENSION_FILE = "src/checkout/lib/b2b/maky-b2b-v1.graphql";

/** @param {string | Uint8Array} bytes */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** @param {readonly unknown[]} values */
const sortedNames = (values) => values.map(String).sort();

/** Everything a document's validity can depend on, without descriptions: kinds, fields, arguments, enum values. */
export function schemaFingerprint(schema) {
	/** @type {Record<string, unknown>} */
	const out = {};
	// Sorted by name throughout: an extension appends, the backend's own schema may print a type or field anywhere.
	for (const [name, type] of Object.entries(schema.getTypeMap()).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	)) {
		if (name.startsWith("__")) continue;
		const entry = { kind: type.constructor.name };
		if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
			entry.fields = Object.fromEntries(
				Object.values(type.getFields())
					.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
					.map((field) => [
						field.name,
						{
							type: String(field.type),
							default: "defaultValue" in field ? JSON.stringify(field.defaultValue ?? null) : undefined,
							args: (field.args ?? []).map(
								(arg) => `${arg.name}:${arg.type}=${JSON.stringify(arg.defaultValue ?? null)}`,
							),
						},
					]),
			);
		}
		if (isObjectType(type) || isInterfaceType(type)) entry.interfaces = sortedNames(type.getInterfaces());
		if (isUnionType(type)) entry.members = sortedNames(type.getTypes());
		if (isEnumType(type)) entry.values = sortedNames(type.getValues().map((value) => value.name));
		out[name] = entry;
	}
	out["@directives"] = sortedNames(
		schema.getDirectives().map((d) => `${d.name}(${d.args.map((a) => `${a.name}:${a.type}`).join(",")})`),
	);
	return out;
}

/**
 * The extension: new types as they are, new fields of existing types as `extend type`, new values of existing enums
 * as `extend enum`. `problems` lists every change that is not an addition; the file is only written without any.
 *
 * @param {string} baseSdl
 * @param {string} backendSdl
 */
export function deriveExtension(baseSdl, backendSdl) {
	const base = buildSchema(baseSdl);
	const backend = buildSchema(backendSdl);
	/** @type {string[]} */
	const problems = [];
	/** @type {Array<[string, string]>} */
	const added = [];
	/** @type {Array<[string, string]>} */
	const extended = [];
	const baseTypes = base.getTypeMap();

	for (const [name, type] of Object.entries(backend.getTypeMap())) {
		if (name.startsWith("__")) continue;
		const old = baseTypes[name];
		if (!old) {
			added.push([name, printType(type)]);
			continue;
		}
		if (old.constructor !== type.constructor) {
			problems.push(`${name}: ${old.constructor.name} became ${type.constructor.name}`);
			continue;
		}
		if (isEnumType(type)) {
			const before = new Set(old.getValues().map((value) => value.name));
			for (const value of before) if (!type.getValue(value)) problems.push(`${name}.${value} removed`);
			const values = Object.fromEntries(
				Object.entries(type.toConfig().values).filter(([value]) => !before.has(value)),
			);
			if (Object.keys(values).length) {
				extended.push([
					name,
					printType(new GraphQLEnumType({ name, values })).replace(/^enum /, "extend enum "),
				]);
			}
			continue;
		}
		if (isUnionType(type)) {
			if (sortedNames(old.getTypes()).join() !== sortedNames(type.getTypes()).join()) {
				problems.push(`${name}: union members changed`);
			}
			continue;
		}
		if (!(isObjectType(type) || isInterfaceType(type) || isInputObjectType(type))) continue;

		const before = old.getFields();
		const after = type.getFields();
		for (const [fieldName, field] of Object.entries(before)) {
			const next = after[fieldName];
			if (!next) {
				problems.push(`${name}.${fieldName} removed`);
				continue;
			}
			if (String(field.type) !== String(next.type)) {
				problems.push(`${name}.${fieldName}: ${field.type} became ${next.type}`);
			}
			const oldArgs = new Map((field.args ?? []).map((arg) => [arg.name, arg]));
			for (const arg of next.args ?? []) {
				const was = oldArgs.get(arg.name);
				if (!was) {
					if (String(arg.type).endsWith("!") && arg.defaultValue === undefined) {
						problems.push(`${name}.${fieldName}(${arg.name}) is a new required argument`);
					}
					continue;
				}
				if (String(was.type) !== String(arg.type)) {
					problems.push(`${name}.${fieldName}(${arg.name}): ${was.type} became ${arg.type}`);
				}
				oldArgs.delete(arg.name);
			}
			for (const gone of oldArgs.keys()) problems.push(`${name}.${fieldName}(${gone}) removed`);
		}
		if (!isInputObjectType(type)) {
			if (sortedNames(old.getInterfaces()).join() !== sortedNames(type.getInterfaces()).join()) {
				problems.push(`${name}: implemented interfaces changed`);
			}
		}
		const fields = Object.fromEntries(
			Object.entries(type.toConfig().fields).filter(([field]) => !before[field]),
		);
		for (const [field, config] of Object.entries(fields)) {
			if (isInputObjectType(type) && String(config.type).endsWith("!") && config.defaultValue === undefined) {
				problems.push(`${name}.${field} is a new required input field`);
			}
		}
		if (!Object.keys(fields).length) continue;
		const [Ctor, keyword] = isInputObjectType(type)
			? [GraphQLInputObjectType, "input"]
			: isInterfaceType(type)
				? [GraphQLInterfaceType, "interface"]
				: [GraphQLObjectType, "type"];
		extended.push([
			name,
			printType(new Ctor({ name, fields })).replace(new RegExp(`^${keyword} `), `extend ${keyword} `),
		]);
	}
	for (const name of Object.keys(baseTypes)) {
		if (!name.startsWith("__") && !backend.getType(name)) problems.push(`${name} removed`);
	}
	const directives = (schema) => sortedNames(schema.getDirectives().map((d) => d.name)).join();
	if (directives(base) !== directives(backend)) problems.push("directives changed");

	const byName = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
	const sdl = [...added.sort(byName), ...extended.sort(byName)].map(([, printed]) => printed).join("\n\n");

	// The proof: what the storefront validates against is, type for type, what the backend serves.
	if (!problems.length) {
		const rebuilt = extendSchema(base, parse(sdl));
		const want = JSON.stringify(schemaFingerprint(backend));
		const got = JSON.stringify(schemaFingerprint(rebuilt));
		if (want !== got) problems.push("the pinned schema extended by the result is not the backend's schema");
	}
	return {
		sdl: `${sdl}\n`,
		problems,
		addedTypes: added.map(([name]) => name),
		extendedTypes: extended.map(([name]) => name),
	};
}

/** @param {{ repository: string, commit: string, backendSha256: string }} source */
export function extensionHeader(source) {
	return [
		"# MAKY-B2B-V1: the B2B part of the backend's GraphQL schema, as an extension of the Saleor schema production runs.",
		"#",
		"# GENERATED, do not edit: node scripts/b2b-schema-extension.mjs <maky-saleor>/saleor/graphql/schema.graphql",
		`# Source: ${source.repository} ${source.commit}, saleor/graphql/schema.graphql`,
		`#         sha256 ${source.backendSha256}`,
		`# Base:   Saleor ${SALEOR_SCHEMA.version} (${SALEOR_SCHEMA.commit}), sha256 ${SALEOR_SCHEMA.sha256}`,
		"#",
		"# The pinned schema extended by this file has exactly the backend's types, fields, arguments and enum values",
		"# (the script checks it). Kept outside `src/checkout/graphql/**` on purpose: that glob is what",
		"# `pnpm generate:checkout` sends to the LIVE Saleor before every build, and a document the live Saleor does not",
		"# know would fail the production build until the backend patch is live.",
		"",
		"",
	].join("\n");
}

function git(dir, ...args) {
	try {
		return execFileSync("git", ["-C", dir, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

function argument(argv, name) {
	const at = argv.indexOf(name);
	return at >= 0 ? argv[at + 1] : undefined;
}

async function main(argv) {
	const backendPath = argv.find((value) => !value.startsWith("--") && value.endsWith(".graphql"));
	if (!backendPath) {
		console.error(
			"usage: node scripts/b2b-schema-extension.mjs <maky-saleor>/saleor/graphql/schema.graphql [--check] [--commit <sha>] [--repository <owner/name>]",
		);
		return 2;
	}
	const backendBytes = readFileSync(backendPath);
	const backendDir = path.dirname(path.resolve(backendPath));
	const commit = argument(argv, "--commit") ?? git(backendDir, "rev-parse", "HEAD");
	const remote = git(backendDir, "remote", "get-url", "origin");
	const repository =
		argument(argv, "--repository") ??
		(remote.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1] || "unknown repository");
	if (!/^[0-9a-f]{40}$/.test(commit)) {
		console.error(
			"the backend commit is unknown: run this inside the maky-saleor checkout or pass --commit <full sha>",
		);
		return 2;
	}

	const basePath = await ensureSchema({ cacheDir: path.join(repoRoot, "node_modules/.cache/saleor-schema") });
	const { sdl, problems, addedTypes, extendedTypes } = deriveExtension(
		readFileSync(basePath, "utf8"),
		backendBytes.toString("utf8"),
	);
	if (problems.length) {
		console.error("The backend schema changes more than it adds; nothing was written:");
		for (const problem of problems) console.error(`  - ${problem}`);
		return 1;
	}
	const text = extensionHeader({ repository, commit, backendSha256: sha256(backendBytes) }) + sdl;
	const target = path.join(repoRoot, EXTENSION_FILE);

	if (argv.includes("--check")) {
		let current = "";
		try {
			current = readFileSync(target, "utf8");
		} catch {
			current = "";
		}
		if (current !== text) {
			console.error(
				`${EXTENSION_FILE} is not what this backend schema gives; run without --check to rewrite it.`,
			);
			return 1;
		}
		console.log(`${EXTENSION_FILE} matches ${repository} ${commit.slice(0, 12)}.`);
		return 0;
	}
	writeFileSync(target, text);
	console.log(
		`${EXTENSION_FILE}: ${addedTypes.length} new types (${addedTypes.join(
			", ",
		)}), extended ${extendedTypes.join(", ")}; from ${repository} ${commit.slice(0, 12)}.`,
	);
	return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2));
}
