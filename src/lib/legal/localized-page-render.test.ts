import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ShippingPage, { generateMetadata } from "@/app/[channel]/(main)/doprava-a-platba/page";

afterEach(() => vi.unstubAllEnvs());

describe("the real informational page renders the URLs advertised to search engines", () => {
	it("renders English shipping content, localized cross-links and a reciprocal canonical", async () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,de,us,ca");
		vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,de,us,ca");
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
		const props = { params: Promise.resolve({ channel: "us-usd" }) };
		const html = renderToStaticMarkup(await ShippingPage(props));
		const metadata = await generateMetadata(props);

		expect(html).toContain("Shipping and payment</h1>");
		for (const href of ["/us/contact", "/us/cancellations-and-returns", "/us/returns-and-complaints"]) {
			expect(html).toContain(`href="${href}"`);
		}
		expect(html).not.toContain('href="/us/kontakt"');
		expect(html).not.toContain('href="/us/odstupenie-od-zmluvy"');
		expect(metadata.alternates?.canonical).toBe("/us/shipping-and-payment");
		expect(metadata.alternates?.languages?.["en-US"]).toBe("https://maky.store/us/shipping-and-payment");
		expect(metadata.alternates?.languages?.["de-DE"]).toBe("https://maky.store/de/versand-und-zahlung");
		expect(metadata.openGraph?.url).toBe("/us/shipping-and-payment");
	});
});
