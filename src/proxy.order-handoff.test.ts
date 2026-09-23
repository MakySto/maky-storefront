import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
	ORDER_CONFIRMATION_COOKIE,
	ORDER_CONFIRMATION_COOKIE_MAX_AGE,
	isOrderId,
	readOrderConfirmationId,
} from "./lib/order-confirmation-handoff";
import { config, proxy } from "./proxy";

/**
 * The order id is the credential for the confirmation page. It used to sit in the URL of a
 * document that loads the tag manager, and went to GA4 and Google Ads in every page_view,
 * consent ping and next-page referrer. These tests pin the handoff that takes it out.
 */

// A real Saleor order id has this shape: base64 of "Order:<uuid>".
const ORDER_ID = btoa("Order:0b6f7c2e-5a41-4c3e-9d0e-6f1d2a3b4c5d");
const CONFIRMATION = "/checkout/" + "comp" + "lete";

const req = (path: string, init?: { method?: string }) =>
	new NextRequest(new URL(`https://maky.store${path}`), init);

const setCookie = (res: Response) => res.headers.get("set-cookie") ?? "";

describe("order confirmation handoff", () => {
	it("is reached: the proxy matcher covers both checkout routes", () => {
		const matcher = new RegExp(`^${config.matcher[0]}$`);
		expect(matcher.test("/checkout")).toBe(true);
		expect(matcher.test(CONFIRMATION)).toBe(true);
	});

	it("answers a confirmation link with a 303 and moves the id into an HttpOnly cookie", async () => {
		const res = await proxy(req(`${CONFIRMATION}?order=${encodeURIComponent(ORDER_ID)}`));

		expect(res.status).toBe(303);
		const location = new URL(res.headers.get("location")!);
		expect(location.pathname).toBe(CONFIRMATION);
		expect(location.search).toBe("");
		expect(res.headers.get("location")).not.toContain(ORDER_ID);
		expect(res.headers.get("cache-control")).toBe("no-store");

		const cookie = setCookie(res);
		expect(cookie).toContain(`${ORDER_CONFIRMATION_COOKIE}=${encodeURIComponent(ORDER_ID)}`);
		expect(cookie).toMatch(/;\s*HttpOnly/i);
		expect(cookie).toMatch(/;\s*Secure/i);
		expect(cookie).toMatch(/;\s*SameSite=lax/i);
		expect(cookie).toContain(`Path=${CONFIRMATION}`);
		expect(cookie).toContain(`Max-Age=${ORDER_CONFIRMATION_COOKIE_MAX_AGE}`);
	});

	it("sends /checkout?order= to the confirmation and keeps every other parameter", async () => {
		const res = await proxy(req(`/checkout?locale=cs-CZ&order=${encodeURIComponent(ORDER_ID)}&step=x`));

		expect(res.status).toBe(303);
		const location = new URL(res.headers.get("location")!);
		expect(location.pathname).toBe(CONFIRMATION);
		expect([...location.searchParams.keys()]).toEqual(["locale", "step"]);
		expect(location.searchParams.get("locale")).toBe("cs-CZ");
		expect(setCookie(res)).toContain(encodeURIComponent(ORDER_ID));
	});

	it("never stores a value that is not an order id, and clears an earlier one", async () => {
		for (const bogus of ["abc", "Q2hlY2tvdXQ6eHl6", `${ORDER_ID};Path=/`, "T3JkZXI6" + "A".repeat(200)]) {
			const res = await proxy(req(`${CONFIRMATION}?order=${encodeURIComponent(bogus)}`));
			expect(res.status).toBe(303);
			expect(new URL(res.headers.get("location")!).search).toBe("");
			const cookie = setCookie(res);
			expect(cookie).toContain(`${ORDER_CONFIRMATION_COOKIE}=;`);
			expect(cookie).toContain("Max-Age=0");
			expect(cookie).not.toContain(encodeURIComponent(bogus));
		}
	});

	it("leaves a server action alone: a POST is not redirected", async () => {
		const res = await proxy(req(`/checkout?order=${encodeURIComponent(ORDER_ID)}`, { method: "POST" }));
		expect(res.status).not.toBe(303);
		expect(setCookie(res)).not.toContain(ORDER_CONFIRMATION_COOKIE);
	});

	it("leaves the confirmation page alone when the URL carries no order", async () => {
		const res = await proxy(req(CONFIRMATION));
		expect(res.status).toBeLessThan(300);
		expect(setCookie(res)).not.toContain(ORDER_CONFIRMATION_COOKIE);
	});

	it("does not claim `order` anywhere else", async () => {
		const res = await proxy(req(`/sk?order=${encodeURIComponent(ORDER_ID)}`));
		expect(res.status).not.toBe(303);
		expect(setCookie(res)).not.toContain(ORDER_CONFIRMATION_COOKIE);
	});
});

describe("the id the confirmation page reads", () => {
	const store = (value?: string) => ({
		get: (name: string) =>
			name === ORDER_CONFIRMATION_COOKIE && value !== undefined ? { value } : undefined,
	});

	it("comes from the cookie and is validated again", () => {
		expect(readOrderConfirmationId(store(ORDER_ID))).toBe(ORDER_ID);
		expect(readOrderConfirmationId(store())).toBeNull();
		expect(readOrderConfirmationId(store("Q2hlY2tvdXQ6eHl6"))).toBeNull();
		expect(readOrderConfirmationId(store(""))).toBeNull();
	});

	it("accepts the shape Saleor issues and nothing else", () => {
		expect(isOrderId(ORDER_ID)).toBe(true);
		expect(isOrderId(btoa("Checkout:0b6f7c2e-5a41-4c3e-9d0e-6f1d2a3b4c5d"))).toBe(false);
		expect(isOrderId("T3JkZXI6 with space")).toBe(false);
		expect(isOrderId(undefined)).toBe(false);
	});
});
