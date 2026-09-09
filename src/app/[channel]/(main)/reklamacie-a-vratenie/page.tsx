import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Fr, Hu, It, Pl, Sk } from "@/ui/content/legal/reklamacie-a-vratenie";

const route = legalRoute({
	path: "/reklamacie-a-vratenie",
	copy: {
		sk: {
			title: "Reklamácie a vrátenie tovaru",
			description:
				"Chcete vrátiť objednávku alebo reklamovať vadný výrobok? Tu nájdete postup, lehoty, adresu na zaslanie a informácie o vrátení peňazí.",
			Body: Sk,
		},
		cs: {
			title: "Reklamace a vrácení zboží",
			description:
				"Chcete vrátit objednávku nebo reklamovat vadný výrobek? Zde najdete postup, lhůty, adresu pro zaslání a informace o vrácení peněz.",
			Body: Cs,
		},
		de: {
			title: "Reklamationen und Rücksendungen",
			description:
				"Artikel zurückgeben oder einen Mangel reklamieren: So erreichen Sie uns. Informationen zu Rücktransport, Erstattung und Ihren gesetzlichen Rechten.",
			Body: De,
		},
		deAt: {
			title: "Reklamationen und Rücksendungen",
			description:
				"Artikel zurückgeben oder einen Mangel reklamieren: So erreichen Sie uns. Informationen zu Rücktransport, Erstattung und Ihren gesetzlichen Rechten.",
			Body: DeAt,
		},
		pl: {
			title: "Reklamacje i zwroty",
			description:
				"Jak zwrócić zakup lub zgłosić wadliwy produkt w MAKY.STORE. Terminy, koszty transportu, zwrot pieniędzy i prawa przy niezgodności towaru z umową.",
			Body: Pl,
		},
		hu: {
			title: "Reklamáció és visszaküldés",
			description:
				"Terméket küldene vissza, vagy hibát észlelt? Az elállás, a reklamáció, a szavatosság és a visszaszállítás menete a MAKY.STORE-nál.",
			Body: Hu,
		},
		it: {
			title: "Reclami, prodotti difettosi e resi",
			heading: "Reclami e resi",
			description:
				"Come restituire un acquisto o segnalare un prodotto difettoso a MAKY.STORE: procedure, tempi, rimborso, costi di trasporto e indirizzo per il reso.",
			Body: It,
		},
		fr: {
			title: "Réclamations, garanties et retours",
			heading: "Réclamations et retours",
			description:
				"Retour d’un achat ou produit défectueux : démarches auprès de MAKY.STORE, délais, remboursement, frais de transport et adresse de retour en Slovaquie.",
			Body: Fr,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
