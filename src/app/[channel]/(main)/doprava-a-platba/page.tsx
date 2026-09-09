import { legalRoute } from "@/lib/legal/legal-route";
import { Ca, Cs, De, DeAt, Es, Fr, Hu, It, Pl, Ro, Sk, Us } from "@/ui/content/legal/doprava-a-platba";

const route = legalRoute({
	path: "/doprava-a-platba",
	copy: {
		sk: {
			title: "Doprava a platba",
			description:
				"Tovar doručujeme cez FedEx a Slovenskú poštu. Pozrite si informácie o cene dopravy, dodaní objednávky a online platbe cez Stripe.",
			Body: Sk,
		},
		cs: {
			title: "Doprava a platba",
			description:
				"Zboží doručujeme přes FedEx a Slovenskou poštu. Přečtěte si informace o ceně dopravy, dodání objednávky a online platbě přes Stripe.",
			Body: Cs,
		},
		de: {
			title: "Versand und Zahlung – Deutschland",
			description:
				"Informationen zu Versand nach Deutschland, Lieferzeiten, Versandkosten und Online-Zahlung bei MAKY.STORE. Verfügbare Optionen sehen Sie vor dem Kauf.",
			Body: De,
		},
		deAt: {
			title: "Versand und Zahlung – Österreich",
			description:
				"Informationen zu Versand nach Österreich, Lieferzeiten, Versandkosten und Online-Zahlung bei MAKY.STORE. Verfügbare Optionen sehen Sie vor dem Kauf.",
			Body: DeAt,
		},
		pl: {
			title: "Dostawa i płatności – Polska",
			heading: "Dostawa i płatności",
			description:
				"Dostawa do Polski przez FedEx i Slovenská pošta, koszty wysyłki, dostępność towaru oraz płatność z góry przez Stripe. Bez pobrania.",
			Body: Pl,
		},
		hu: {
			title: "Szállítás és fizetés – Magyarország",
			heading: "Szállítás és fizetés",
			description:
				"Szállítás Magyarországra, szállítási díjak, várható kézbesítés és előre fizetés a Stripe rendszerén keresztül. Ismerje meg a rendelés feltételeit.",
			Body: Hu,
		},
		it: {
			title: "Spedizione e pagamento in Italia",
			heading: "Spedizione e pagamento",
			description:
				"Spediamo in Italia dalla Slovacchia con FedEx e Slovenská pošta. Informazioni su consegna, costi, disponibilità e pagamento anticipato tramite Stripe.",
			Body: It,
		},
		fr: {
			title: "Livraison et paiement en France",
			heading: "Livraison et paiement",
			description:
				"Livraison en France depuis la Slovaquie avec FedEx et Slovenská pošta : frais, disponibilité, délais et paiement anticipé par Stripe, sans contre-remboursement.",
			Body: Fr,
		},
		es: {
			title: "Envíos y pagos — España",
			heading: "Envíos y pagos",
			description:
				"Envíos desde Eslovaquia a España con FedEx y Slovenská pošta. Consulta costes, disponibilidad y pago anticipado mediante Stripe, sin contrarreembolso.",
			Body: Es,
		},
		ro: {
			title: "Livrare și plată — România",
			heading: "Livrare și plată",
			description:
				"Livrare din Slovacia în România prin FedEx și Slovenská pošta. Informații despre costuri, disponibilitate și plata în avans prin Stripe, fără ramburs.",
			Body: Ro,
		},
		enUs: {
			title: "Shipping and payment — United States",
			heading: "Shipping and payment",
			description:
				"Shipping from Slovakia to the US: delivery options, import costs, availability and advance payment through Stripe. No cash on delivery.",
			Body: Us,
		},
		enCa: {
			title: "Shipping and payment — Canada",
			heading: "Shipping and payment",
			description:
				"Shipping from Slovakia to Canada: delivery options, import costs, availability and advance payment through Stripe. No cash on delivery.",
			Body: Ca,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
