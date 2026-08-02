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

	it("shows merchant pickup as the primary flow and keeps own transport conditional", () => {
		const form = source("src/ui/components/withdrawal/withdrawal-form.tsx");
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx");
		const rendered = `${form} ${page}`;

		expect(form).toContain("withdrawalCustomerStatement(statementOrderNumber, scope)");
		expect(form).toContain("[číslo objednávky]");
		expect(form).toContain("manualItems.length >= WITHDRAWAL_LIMITS.items");
		expect(source("src/app/[channel]/(main)/odstupenie-od-zmluvy/actions.ts")).not.toContain(
			"parsed.slice(0, WITHDRAWAL_LIMITS.items)",
		);
		expect(rendered).toContain("Zvoz tovaru zabezpečíme my");
		expect(rendered).toContain(
			"Tovar zatiaľ neposielajte. Ozveme sa vám e-mailom s presnou cenou zvozu a navrhneme termín vyzdvihnutia.",
		);
		expect(rendered).toContain("Zvoz objednáme až po vašom výslovnom súhlase.");
		expect(rendered).toContain(
			"Ak potrebujete zabezpečiť dopravu vlastným spôsobom, kontaktujte nás pred odoslaním tovaru.",
		);
		expect(page).toContain(
			"Ak sa s nami dohodnete na odoslaní tovaru vlastnou dopravou, použite túto adresu:",
		);
	});

	it("pins the refund meaning and excludes forbidden first-confirmation promises", () => {
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx");
		const returnsPage = source("src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx");
		const receipt = source("src/ui/components/withdrawal/withdrawal-receipt.tsx");
		const customerCopy = `${page} ${returnsPage} ${receipt}`;

		expect(page).toContain(
			"Platby v rozsahu vášho odstúpenia vám vrátime najneskôr do 14 dní odo dňa, keď nám bolo doručené vaše oznámenie o odstúpení.",
		);
		expect(page).toContain(
			"Vrátime ich rovnakým spôsobom, akým ste platili, ak sa spolu bez ďalších poplatkov nedohodneme inak.",
		);
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
