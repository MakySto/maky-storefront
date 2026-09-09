import { legalRoute } from "@/lib/legal/legal-route";
import { Ca, Cs, De, DeAt, Es, Fr, Hu, It, Pl, Ro, Sk, Us } from "@/ui/content/legal/obchodne-podmienky";

const route = legalRoute({
	path: "/obchodne-podmienky",
	copy: {
		sk: {
			title: "Všeobecné obchodné podmienky",
			description:
				"Obchodné podmienky MAKY.STORE: objednávka, platba, doručenie, odstúpenie od zmluvy, zodpovednosť za vady a riešenie spotrebiteľských sporov.",
			Body: Sk,
		},
		cs: {
			title: "Všeobecné obchodní podmínky",
			description:
				"Obchodní podmínky MAKY.STORE: objednávka, platba, doručení, odstoupení od smlouvy, odpovědnost za vady a řešení spotřebitelských sporů.",
			Body: Cs,
		},
		de: {
			title: "Allgemeine Geschäftsbedingungen",
			description:
				"Die AGB von MAKY.STORE für Bestellungen aus Deutschland: Vertragsschluss, Zahlung, Lieferung, Widerruf und gesetzliche Mängelrechte.",
			Body: De,
		},
		deAt: {
			title: "Allgemeine Geschäftsbedingungen",
			description:
				"Die AGB von MAKY.STORE für Bestellungen aus Österreich: Vertragsschluss, Zahlung, Lieferung, Widerruf und gesetzliche Mängelrechte.",
			Body: DeAt,
		},
		pl: {
			title: "Regulamin sklepu – Polska",
			heading: "Regulamin sklepu",
			description:
				"Zasady zakupów w MAKY.STORE: zamówienie, płatność, dostawa, odstąpienie od umowy, reklamacje i prawa konsumenta.",
			Body: Pl,
		},
		hu: {
			title: "Általános szerződési feltételek",
			description:
				"A MAKY.STORE vásárlási feltételei: megrendelés, fizetés, szállítás, elállás, reklamáció, szavatosság és fogyasztói jogok.",
			Body: Hu,
		},
		it: {
			title: "Condizioni generali di vendita",
			description:
				"Condizioni di acquisto su MAKY.STORE: ordini, prezzi, pagamento, consegna, recesso, garanzia legale e risoluzione delle controversie.",
			Body: It,
		},
		fr: {
			title: "Conditions générales de vente",
			description:
				"Les conditions d’achat MAKY.STORE : commande, prix, paiement, livraison, rétractation, garanties, réclamations et règlement des litiges.",
			Body: Fr,
		},
		es: {
			title: "Condiciones de venta",
			description:
				"Condiciones de compra en MAKY.STORE: pedidos, pagos, entrega, desistimiento, devoluciones y garantía legal. Vendedor establecido en Eslovaquia.",
			Body: Es,
		},
		ro: {
			title: "Termeni și condiții de vânzare",
			description:
				"Condițiile cumpărăturilor MAKY.STORE: comenzi, plată, livrare, retragere, retururi și garanție legală. Vânzător stabilit în Slovacia.",
			Body: Ro,
		},
		enUs: {
			title: "Terms of sale",
			description:
				"MAKY.STORE terms for the United States: ordering, payment, delivery, cancellations, returns, product remedies and your consumer rights.",
			Body: Us,
		},
		enCa: {
			title: "Terms of sale",
			description:
				"MAKY.STORE terms for Canada: ordering, payment, delivery, cancellations, returns, product remedies and your consumer rights.",
			Body: Ca,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
