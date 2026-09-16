import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LOCALE_MAP } from "@/config/locale";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * `scripts/checks/payment-canary.mjs` is prepared for GO-COMMERCE-LIVE and must never be able
 * to take a payment, confirm one or create an order — and must refuse to write at all without
 * the GO for the exact channel. These run it without network: the plan and the refusals happen
 * before any request.
 */
const SCRIPT = join(__dirname, "../../scripts/checks/payment-canary.mjs");
const SOURCE = readFileSync(SCRIPT, "utf8");

const run = (args: string[], env: Record<string, string | undefined> = {}) =>
	spawnSync(process.execPath, [SCRIPT, ...args], {
		encoding: "utf8",
		env: {
			PATH: process.env.PATH,
			SALEOR_API_URL: "http://127.0.0.1:9/graphql/",
			...env,
		} as unknown as NodeJS.ProcessEnv,
		timeout: 20_000,
	});

describe("payment canary script", () => {
	it("contains no mutation that pays, confirms or completes", () => {
		for (const forbidden of [
			"transactionInitialize",
			"transactionProcess",
			"checkoutComplete",
			"paymentCreate",
			"orderCreateFromCheckout",
			"stripe.confirm",
			"confirmPayment",
		]) {
			expect(SOURCE.includes(forbidden), forbidden).toBe(false);
		}
		expect(SOURCE).toContain("paymentGatewayInitialize");
	});

	it("prints the plan and exits 0 without --execute, touching nothing", () => {
		const result = run(["--channel", "at-eur", "--variant", "VmFyaWFudDox"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("PLAN (nothing written)");
		expect(result.stdout).toContain("5. STOP");
	});

	it("refuses to write without the GO for this exact channel", () => {
		const args = [
			"--execute",
			"--channel",
			"at-eur",
			"--variant",
			"VmFyaWFudDox",
			"--email",
			"x@example.com",
			"--address",
			"/nonexistent",
		];
		expect(run(args).status).toBe(2);
		expect(run(args, { MAKY_GO_COMMERCE_LIVE: "de-eur" }).status).toBe(2);
		expect(run(args, { MAKY_GO_COMMERCE_LIVE: "yes" }).stderr).toContain("MAKY_GO_COMMERCE_LIVE=at-eur");
		expect(run(args, { MAKY_GO_COMMERCE_LIVE: "at-eur", MAKY_SALEOR_WRITES: "block" }).status).toBe(2);
	});

	it("refuses a channel the storefront does not serve", () => {
		expect(run(["--channel", "at", "--variant", "x"]).status).toBe(2);
	});

	it("knows each channel's currency and editorial language exactly as the storefront does", () => {
		// Read from the source: importing the script would run it.
		const CHANNELS = Object.fromEntries(
			[
				...SOURCE.matchAll(/"([a-z]{2}-[a-z]{3})": \{ currency: "([A-Z]{3})", languageCode: "([A-Z_]+)" \}/g),
			].map(([, channel, currency, languageCode]) => [
				channel!,
				{ currency: currency!, languageCode: languageCode! },
			]),
		) as Record<string, { currency: string; languageCode: string }>;
		expect(Object.keys(CHANNELS).sort()).toEqual(
			Object.values(CHANNEL_MAP)
				.map((c) => c.saleorSlug)
				.sort(),
		);
		for (const config of Object.values(CHANNEL_MAP)) {
			expect(CHANNELS[config.saleorSlug]?.currency, config.saleorSlug).toBe(config.currency);
			expect(CHANNELS[config.saleorSlug]?.languageCode, config.saleorSlug).toBe(
				LOCALE_MAP[config.locale]!.graphqlLanguageCode,
			);
		}
	});
});
