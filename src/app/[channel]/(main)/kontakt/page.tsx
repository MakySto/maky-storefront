import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Hu, Pl, Sk } from "@/ui/content/legal/kontakt";

const route = legalRoute({
	path: "/kontakt",
	copy: {
		sk: {
			title: "Kontakt",
			description:
				"Potrebujete poradiť s výberom alebo objednávkou? Kontaktujte MAKY.STORE. Nájdete tu e-mail, telefón, fakturačné údaje aj adresu na vrátenie tovaru.",
			Body: Sk,
		},
		cs: {
			title: "Kontakt",
			description:
				"Potřebujete poradit s výběrem nebo objednávkou? Kontaktujte MAKY.STORE. Najdete zde e-mail, telefon, fakturační údaje i adresu pro vrácení zboží.",
			Body: Cs,
		},
		de: {
			title: "Kontakt",
			description:
				"Fragen zu Produkten, Fahrzeugkompatibilität oder Ihrer Bestellung? Hier finden Sie unsere Kontaktdaten, Unternehmensangaben und Rücksendeadresse.",
			Body: De,
		},
		deAt: {
			title: "Kontakt",
			description:
				"Fragen zu Produkten, Fahrzeugkompatibilität oder Ihrer Bestellung? Hier finden Sie unsere Kontaktdaten, Unternehmensangaben und Rücksendeadresse.",
			Body: DeAt,
		},
		pl: {
			title: "Kontakt",
			description:
				"Pytania o produkt, dopasowanie akcesoriów lub zamówienie? Dane kontaktowe MAKY.STORE, informacje o sprzedawcy i adres do zwrotów.",
			Body: Pl,
		},
		hu: {
			title: "Kapcsolat",
			description:
				"Kérdése van egy termékről, az autójához való illeszkedésről vagy a rendeléséről? Itt találja elérhetőségeinket, cégadatainkat és a visszaküldési címet.",
			Body: Hu,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
