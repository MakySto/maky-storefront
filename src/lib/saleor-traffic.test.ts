import { afterEach, describe, expect, it, vi } from "vitest";

import {
	formatTrafficLine,
	recordSaleorWire,
	startSaleorTrafficLog,
	takeSaleorTraffic,
} from "./saleor-traffic";

afterEach(() => {
	takeSaleorTraffic();
	vi.useRealTimers();
});

describe("saleor traffic", () => {
	it("counts the requests by operation with their time, and the failed and the slow ones", () => {
		recordSaleorWire("ProductDetails", 40, true);
		recordSaleorWire("ProductDetails", 60, true);
		recordSaleorWire("CategoryPrices", 2_500, false);

		const line = formatTrafficLine(takeSaleorTraffic(), new Date("2026-11-15T19:20:00Z"), 60);

		expect(line).toBe(
			"[saleor-traffic] t=2026-11-15T19:20:00.000Z window=60s total=3 failed=1 slow=1" +
				" | ProductDetails=2(avg 50ms) CategoryPrices=1(avg 2500ms, 1 slow, 1 failed)",
		);
	});

	it("says nothing for a minute without requests, and starts from zero after a line", () => {
		expect(formatTrafficLine(takeSaleorTraffic(), new Date(), 60)).toBeNull();
		recordSaleorWire("A", 1, true);
		takeSaleorTraffic();
		expect(formatTrafficLine(takeSaleorTraffic(), new Date(), 60)).toBeNull();
	});

	it("lists the busiest operations and sums the rest", () => {
		for (let i = 0; i < 14; i += 1) {
			for (let n = 0; n <= i; n += 1) recordSaleorWire(`Op${i}`, 10, true);
		}
		const line = formatTrafficLine(takeSaleorTraffic(), new Date(), 60)!;
		expect(line).toContain("Op13=14(");
		expect(line).not.toContain("Op0=");
		expect(line).toMatch(/\| other=3$/);
	});

	it("prints a line each interval while there is traffic, from one timer however often it is started", () => {
		vi.useFakeTimers();
		const lines: string[] = [];
		const stop = startSaleorTrafficLog(60, (line) => lines.push(line));
		expect(startSaleorTrafficLog(60, (line) => lines.push(line))).toBe(stop);

		recordSaleorWire("ProductDetails", 30, true);
		vi.advanceTimersByTime(60_000);
		vi.advanceTimersByTime(60_000);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("total=1");
		stop();
	});
});
