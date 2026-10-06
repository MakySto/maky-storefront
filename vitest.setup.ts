import { beforeEach, vi } from "vitest";

/**
 * The default `node` test environment has no Web Storage, but several checkout
 * payment modules persist state in `sessionStorage`. Provide a minimal in-memory
 * implementation on `globalThis` instead of pulling in a full DOM environment.
 *
 * It deliberately lives on `globalThis` (not inside a module) so it survives
 * `vi.resetModules()` — the orphan-detection tests rely on storage outliving a
 * simulated page reload.
 */
class MemoryStorage implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.has(key) ? this.store.get(key)! : null;
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
}

function isUsableStorage(value: unknown): value is Storage {
	return typeof (value as Storage | undefined)?.clear === "function";
}

if (!isUsableStorage(globalThis.sessionStorage)) {
	globalThis.sessionStorage = new MemoryStorage();
}

if (!isUsableStorage(globalThis.localStorage)) {
	globalThis.localStorage = new MemoryStorage();
}

beforeEach(() => {
	globalThis.sessionStorage.clear();
	globalThis.localStorage.clear();
});

/**
 * `"use cache"` is a directive Next compiles; under vitest it is only a string, so a cached function
 * simply runs. What it declares about itself — `cacheLife()` and `cacheTag()` — has no cache scope to
 * talk to here, and the real ones throw outside one. They do nothing unless a test says otherwise, so
 * a route or a component that reads through a cached function can be rendered in a test; a test that
 * wants to see what a function declares replaces them with its own `vi.mock("next/cache", …)`, as
 * `src/lib/cms/availability.test.ts` does.
 */
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: () => {},
}));
