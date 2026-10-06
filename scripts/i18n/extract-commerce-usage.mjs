// Static extractor of commerce i18n key usage (cart.*, checkout.*, common.close).
// Used by check-commerce-i18n.mjs (runtime-closure gate) and for manifest call-site data.
//
// Handles: const t = useTranslations("ns") / await getTranslations("ns") bindings and their
// t("key") / t.rich("key") calls; unscoped getTranslations with full dotted keys; template-
// literal or variable-key calls are NOT resolved here — they must be declared in
// scripts/i18n/dynamic-commerce-keys.json (enumerated key sets with a call-site).
import fs from "node:fs";
import path from "node:path";

const COMMERCE_PREFIXES = ["cart.", "checkout."];
const COMMERCE_EXACT = new Set(["common.close"]);

export function isCommerceKey(key) {
	return COMMERCE_EXACT.has(key) || COMMERCE_PREFIXES.some((p) => key.startsWith(p));
}

function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "messages" || entry.name === "generated") {
				continue;
			}
			yield* walk(full);
		} else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
			yield full;
		}
	}
}

const BINDING_RE = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;
const BINDING_OBJECT_RE =
	/const\s+(\w+)\s*=\s*(?:await\s+)?getTranslations\(\s*\{[^}]*namespace:\s*"([^"]+)"[^}]*\}/g;
const UNSCOPED_RE = /const\s+(\w+)\s*=\s*(?:await\s+)?getTranslations\(\s*[^"){]/g;

/**
 * @param {string} repoRoot
 * @returns {{ keys: Map<string, string[]>, dynamicCallFiles: string[] }} key -> call-sites
 */
export function extractCommerceUsage(repoRoot) {
	const srcDir = path.join(repoRoot, "src");
	const keys = new Map();
	const dynamicCallFiles = new Set();

	const record = (key, site) => {
		if (!isCommerceKey(key)) return;
		if (!keys.has(key)) keys.set(key, []);
		keys.get(key).push(site);
	};

	for (const file of walk(srcDir)) {
		const rel = path.relative(repoRoot, file);
		const text = fs.readFileSync(file, "utf8");
		const lines = text.split("\n");

		// namespace bindings in this file (name -> [{ at, ns }] in source order; "" = unscoped full paths).
		// One file often binds the same name in several components, each to its own namespace
		// (`const t = useTranslations("a")` here, `const t = useTranslations("b")` further down), so a call
		// belongs to the nearest binding above it, not to whichever binding the file declares last.
		const bindings = new Map();
		const bind = (name, at, ns) => {
			if (!bindings.has(name)) bindings.set(name, []);
			bindings.get(name).push({ at, ns });
		};
		for (const match of text.matchAll(BINDING_RE)) {
			bind(match[1], match.index, match[2]);
		}
		for (const match of text.matchAll(BINDING_OBJECT_RE)) {
			bind(match[1], match.index, match[2]);
		}
		for (const match of text.matchAll(UNSCOPED_RE)) {
			bind(match[1], match.index, "");
		}

		const lineStart = [];
		let offset = 0;
		for (const line of lines) {
			lineStart.push(offset);
			offset += line.length + 1;
		}

		for (const [name, bound] of bindings) {
			bound.sort((a, b) => a.at - b.at);
			// A call above every binding (a helper that is handed `t`) takes the first one below it.
			const namespaceAt = (at) => (bound.findLast((b) => b.at <= at) ?? bound[0]).ns;
			const callRe = new RegExp(`\\b${name}(?:\\.(?:rich|markup|raw))?\\(\\s*"([^"]+)"`, "g");
			const dynRe = new RegExp(`\\b${name}(?:\\.(?:rich|markup|raw))?\\(\\s*[\`\\w[]`, "g");

			for (let i = 0; i < lines.length; i++) {
				for (const m of lines[i].matchAll(callRe)) {
					const ns = namespaceAt(lineStart[i] + m.index);
					record(ns ? `${ns}.${m[1]}` : m[1], `${rel}:${i + 1}`);
				}
				if (dynRe.test(lines[i])) {
					dynamicCallFiles.add(rel);
				}
				dynRe.lastIndex = 0;
			}
		}
	}

	return { keys, dynamicCallFiles: [...dynamicCallFiles].sort() };
}

export function loadDynamicKeys(repoRoot) {
	const file = path.join(repoRoot, "scripts/i18n/dynamic-commerce-keys.json");
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Merged static + declared-dynamic usage: key -> call-sites. */
export function extractAllCommerceUsage(repoRoot) {
	const { keys, dynamicCallFiles } = extractCommerceUsage(repoRoot);
	const dynamic = loadDynamicKeys(repoRoot);

	for (const entry of dynamic.patterns) {
		for (const key of entry.keys) {
			if (!keys.has(key)) keys.set(key, []);
			keys.get(key).push(`${entry.callSite} (dynamic: ${entry.pattern})`);
		}
	}

	return { keys, dynamicCallFiles, dynamicPatterns: dynamic.patterns };
}

// CLI: node scripts/i18n/extract-commerce-usage.mjs [--json]
if (process.argv[1] === new URL(import.meta.url).pathname) {
	const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../..");
	const { keys, dynamicCallFiles } = extractAllCommerceUsage(repoRoot);
	const out = Object.fromEntries([...keys.entries()].sort(([a], [b]) => a.localeCompare(b)));
	if (process.argv.includes("--json")) {
		console.log(JSON.stringify({ keys: out, dynamicCallFiles }, null, 2));
	} else {
		console.log(`${keys.size} commerce keys used at runtime`);
	}
}
