import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { FulfillmentStatus, OrderStatus } from "@/gql/graphql";
import { AccountAddressCard } from "./address-card";
import { OrderRow } from "./order-row";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTimeline } from "./order-timeline";

/**
 * The signed-in account's server components render in the market's language.
 *
 * Until 2026-09-26 every one of them was English on all twelve markets: "Processing",
 * "Delivered" (for an order that had only been shipped), "Order Timeline", "Payment confirmed
 * and order placed", "Default shipping", "2 items". A missing key does not fail a build — next-intl
 * prints the key path instead — so the output is searched for both the old English and raw keys.
 */

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

vi.mock("@/ui/atoms/link-with-channel", () => ({
	LinkWithChannel: ({ href, children }: { href: string; children: ReactNode }) =>
		createElement("a", { href }, children),
}));

vi.mock("@/ui/components/ui/resilient-product-image", () => ({
	ResilientProductImage: ({ alt }: { alt: string }) => createElement("img", { alt }),
}));

const ORDER = {
	id: "T3JkZXI6MQ==",
	number: "1042",
	created: "2026-09-05T10:00:00Z",
	status: OrderStatus.Fulfilled,
	statusDisplay: "Fulfilled",
	total: { gross: { amount: 249.9, currency: "EUR" } },
	lines: [{ quantity: 2, variant: null }],
	fulfillments: [
		{
			status: FulfillmentStatus.Fulfilled,
			created: "2026-09-06T08:00:00Z",
			trackingNumber: "RR123456789SK",
			lines: [{ quantity: 2 }],
		},
	],
};

const ADDRESS = {
	id: "QWRkcmVzczox",
	firstName: "Jana",
	lastName: "Nováková",
	companyName: "",
	streetAddress1: "Hlavná 1",
	streetAddress2: "",
	city: "Žilina",
	postalCode: "010 01",
	countryArea: "",
	phone: null,
	country: { code: "SK", country: "Slovensko" },
};

/** The visible text only: class names such as `items-center` would match the English words. */
async function html(element: Promise<ReactNode> | ReactNode): Promise<string> {
	return renderToStaticMarkup(createElement(Fragment, null, await element)).replace(/<[^>]+>/g, " ");
}

const ENGLISH =
	/\b(Processing|Delivered|Order Timeline|Order confirmed|Payment confirmed|Default shipping|Default billing|items?\b|Tracking number)/;
const RAW_KEY = /\b(status|timeline|orders|address|order)\.[a-zA-Z]+/;

describe.each(["sk-SK", "de-DE", "hu-HU", "en-US"])("signed-in account components in %s", (locale) => {
	const messages = load(locale) as {
		account: {
			status: Record<string, string>;
			timeline: Record<string, string>;
			address: Record<string, string>;
		};
	};

	it("the order row names the status and counts the pieces in the market's words", async () => {
		const out = await html(OrderRow({ order: ORDER as never, locale }));
		expect(out).toContain(messages.account.status.fulfilled);
		expect(out).not.toMatch(RAW_KEY);
		if (locale !== "en-US") expect(out).not.toMatch(ENGLISH);
	});

	it.each(Object.values(OrderStatus))("the badge has a word for %s", async (status) => {
		const out = await html(OrderStatusBadge({ locale, status, statusDisplay: "SALEOR_ENGLISH" }));
		expect(out).not.toContain("SALEOR_ENGLISH");
		expect(out).not.toMatch(RAW_KEY);
	});

	it("the timeline starts with the order being placed, not paid", async () => {
		const out = await html(OrderTimeline({ order: ORDER as never, locale }));
		expect(out).toContain(messages.account.timeline.placed);
		expect(out).toContain(messages.account.timeline.shipped);
		expect(out).toContain("RR123456789SK");
		expect(out).not.toMatch(RAW_KEY);
		if (locale !== "en-US") expect(out).not.toMatch(ENGLISH);
	});

	it("the address card's badges are translated", async () => {
		const out = await html(
			AccountAddressCard({
				address: ADDRESS as never,
				locale,
				isDefaultShipping: true,
				isDefaultBilling: true,
			}),
		);
		expect(out).toContain(messages.account.address.defaultShipping);
		expect(out).toContain(messages.account.address.defaultBilling);
		if (locale !== "en-US") expect(out).not.toMatch(ENGLISH);
	});
});
