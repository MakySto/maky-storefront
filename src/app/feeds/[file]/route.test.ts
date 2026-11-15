import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import { GET } from "./route";

/**
 * `/feeds/<name>` hands out the feed files the timer wrote, and only those: a name is a known market's
 * feed or it is a 404, and a market whose file is not there is a 404 too, never an empty feed.
 */

let dir: string;

const call = (file: string) =>
	GET(new Request(`https://maky.store/feeds/${encodeURIComponent(file)}`), {
		params: Promise.resolve({ file }),
	});

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "maky-feeds-"));
	vi.stubEnv("MAKY_FEED_DIR", dir);
});

afterEach(() => {
	vi.unstubAllEnvs();
	rmSync(dir, { recursive: true, force: true });
});

describe("/feeds/[file]", () => {
	it("serves a market's feed as the gzip file it is", async () => {
		const xml = "<rss><channel><item><g:id>V1</g:id></item></channel></rss>";
		writeFileSync(join(dir, "google-sk.xml.gz"), gzipSync(xml));

		const res = await call("google-sk.xml.gz");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/gzip");
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
		expect(res.headers.get("last-modified")).toBeTruthy();
		const body = Buffer.from(await res.arrayBuffer());
		expect(res.headers.get("content-length")).toBe(String(body.length));
		expect(gunzipSync(body).toString()).toBe(xml);
	});

	it("is a 404 for a market whose feed has not been written, or is empty", async () => {
		expect((await call("google-cz.xml.gz")).status).toBe(404);
		writeFileSync(join(dir, "google-cz.xml.gz"), "");
		expect((await call("google-cz.xml.gz")).status).toBe(404);
	});

	it("serves nothing else from the directory", async () => {
		writeFileSync(join(dir, "status.json"), "{}");
		writeFileSync(join(dir, "google-sk.xml.gz.tmp-123"), "half a file");
		writeFileSync(join(dir, "google-xx.xml.gz"), gzipSync("<rss/>"));

		for (const name of [
			"status.json",
			"google-sk.xml.gz.tmp-123",
			"google-xx.xml.gz",
			"google-sk.xml",
			"../google-sk.xml.gz",
			"..%2Fstatus.json",
			"google-SK.xml.gz",
			"",
		]) {
			const res = await call(name);
			expect(res.status, name).toBe(404);
			expect(res.headers.get("x-robots-tag"), name).toBe("noindex");
		}
	});
});
