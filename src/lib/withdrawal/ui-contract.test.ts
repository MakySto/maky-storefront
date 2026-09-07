import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { withdrawalCustomerStatement } from "./contract";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function source(relativePath: string): string {
	return readFileSync(join(root, relativePath), "utf8").replace(/\s+/g, " ");
}

describe("Returns V2 storefront copy", () => {
	it("uses one exact customer statement builder for whole and partial withdrawals", () => {
		expect(withdrawalCustomerStatement(" ORD-1042 ", "wholeOrder")).toBe(
			"Odstupujem od zmluvy k objednávke ORD-1042 v celom rozsahu.",
		);
		expect(withdrawalCustomerStatement("ORD-1042", "selectedItems")).toBe(
			"Odstupujem od zmluvy k objednávke ORD-1042 v rozsahu uvedených položiek.",
		);
		expect(withdrawalCustomerStatement("ORD-\u00851042", "wholeOrder")).toBe(
			"Odstupujem od zmluvy k objednávke ORD- 1042 v celom rozsahu.",
		);
	});

	it("offers merchant pickup without making it a precondition of returning the goods", () => {
		const form = source("src/ui/components/withdrawal/withdrawal-form.tsx");
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx");
		const returnsPage = source("src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx");
		const rendered = `${form} ${page}`;

		expect(form).toContain("withdrawalCustomerStatement(statementOrderNumber, scope)");
		expect(form).toContain("[číslo objednávky]");
		expect(form).toContain("manualItems.length >= WITHDRAWAL_LIMITS.items");
		expect(source("src/app/[channel]/(main)/odstupenie-od-zmluvy/actions.ts")).not.toContain(
			"parsed.slice(0, WITHDRAWAL_LIMITS.items)",
		);

		// Pickup is still offered, and a PAID pickup still needs an explicit yes.
		expect(rendered).toContain(
			"Môžete si vybrať vlastného dopravcu alebo nás požiadať o ponuku na vyzdvihnutie.",
		);
		expect(rendered).toContain("Platený zvoz objednáme až po vašom výslovnom súhlase.");

		// …but it is an offer, not a gate. Own transport needs no approval from us.
		expect(rendered).toContain("Vrátenie vlastným dopravcom nepodlieha nášmu predchádzajúcemu schváleniu.");
		expect(returnsPage).toContain("Vlastnú dopravu nemusíme vopred schvaľovať.");

		// The sentence this replaces told the customer to hold the goods until we got in
		// touch. That reads as a precondition on a statutory right the trader cannot gate,
		// and it also started the customer's own 14-day return clock without saying so.
		// Its absence is the point of this test, so assert on it directly.
		expect(`${rendered} ${returnsPage}`).not.toContain("Tovar zatiaľ neposielajte");
	});

	it("pins the refund meaning and excludes forbidden first-confirmation promises", () => {
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx");
		const returnsPage = source("src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx");
		const receipt = source("src/ui/components/withdrawal/withdrawal-receipt.tsx");
		const customerCopy = `${page} ${returnsPage} ${receipt}`;

		expect(page).toContain("Platby v rozsahu odstúpenia vám vrátime do");
		expect(page).toContain("14 dní od doručenia oznámenia");
		expect(page).toContain("Peniaze vraciame rovnakým spôsobom, akým ste platili.");
		expect(customerCopy).not.toMatch(/(?:8|13|21)\s*€/);
		expect(customerCopy).not.toMatch(/odrátame|odpočítame|automatick(?:y|é)\s+zadrž/i);
	});
});

describe("Returns V2 artifact boundary", () => {
	it("renders CMS HTML only in a scriptless, form-less, no-referrer sandbox", () => {
		const receipt = source("src/ui/components/withdrawal/withdrawal-receipt.tsx");
		expect(receipt).toContain("srcDoc={receipt.printConfirmationHTML}");
		expect(receipt).toContain('sandbox="allow-modals allow-same-origin"');
		expect(receipt).toContain('referrerPolicy="no-referrer"');
		expect(receipt).not.toContain("dangerouslySetInnerHTML");
		expect(receipt).not.toMatch(/allow-scripts|allow-forms|allow-top-navigation/);
	});
});
