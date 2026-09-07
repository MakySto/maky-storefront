// Every `animate-*` utility used in src/ must actually emit a rule in the built CSS.
//
//   pnpm build && node scripts/checks/css-utilities.mjs
//
// Why this exists: Tailwind v4 emits NOTHING for an undefined `--animate-*`. No error,
// no warning, a green build — and the element keeps whatever it had, which for a skeleton
// is `opacity-0`. Commit 467d9ef deleted three animation tokens on 2026-03-21 and it took
// five and a half months and a customer-visible outage for anyone to notice that 13
// skeletons across 12 files had been invisible the whole time.
//
// CLAUDE.md §11: "`next build` passing does NOT certify token correctness." This is the
// check that does. It reads the built stylesheet, which is the only thing that knows.
//
// Scope is deliberately `animate-*` only. Colour utilities have the same failure mode
// (§4.2) but a far higher false-positive rate here, because class names are assembled
// dynamically in `cn()` calls; widening this without solving that would produce a check
// people learn to ignore, which is worse than no check.
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const cssDir = path.join(repoRoot, ".next/static/chunks");

if (!fs.existsSync(cssDir)) {
	console.error("no built CSS at .next/static/chunks — run a build first");
	process.exit(2);
}

const css = fs
	.readdirSync(cssDir)
	.filter((f) => f.endsWith(".css"))
	.map((f) => fs.readFileSync(path.join(cssDir, f), "utf8"))
	.join("");

if (!css) {
	console.error("built CSS is empty — the build did not produce a stylesheet");
	process.exit(2);
}

// Collect `animate-*` class names as they appear in source. Matching on a quote,
// backtick or whitespace boundary keeps `data-animate-x` and similar out.
const used = new Map();
const walk = (dir) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "gql" || entry.name === "node_modules") continue;
			walk(full);
			continue;
		}
		if (!/\.tsx?$/.test(entry.name)) continue;
		const text = fs.readFileSync(full, "utf8");
		for (const m of text.matchAll(/["'`\s](animate-[a-z0-9][a-z0-9-]*)/g)) {
			const rel = path.relative(repoRoot, full);
			if (!used.has(m[1])) used.set(m[1], new Set());
			used.get(m[1]).add(rel);
		}
	}
};
walk(path.join(repoRoot, "src"));

const dead = [];
for (const [cls, files] of [...used].sort()) {
	// Escaped or not, a real rule contains the class name followed by a non-name char.
	if (new RegExp(`\\.${cls.replace(/[-]/g, "\\-")}(?![a-zA-Z0-9_-])`).test(css)) continue;
	dead.push([cls, [...files].sort()]);
}

if (dead.length === 0) {
	console.log(`css utilities OK — ${used.size} animate-* classes, all emitted`);
	process.exit(0);
}

console.error(`\n${dead.length} animate-* class(es) used in src/ but ABSENT from the built CSS.`);
console.error("Tailwind emitted no rule, so these do nothing at runtime and the build cannot tell you.\n");
for (const [cls, files] of dead) {
	console.error(`  ${cls}`);
	for (const f of files) console.error(`      ${f}`);
}
console.error("\nDefine the token in src/styles/brand.css, or remove the class from the markup.");
console.error("If it is paired with opacity-0, the element is invisible right now.\n");
process.exit(1);
