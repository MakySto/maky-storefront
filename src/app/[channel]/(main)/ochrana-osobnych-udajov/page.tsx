import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Fr, Hu, It, Pl, Sk } from "@/ui/content/legal/ochrana-osobnych-udajov";

const route = legalRoute({
	path: "/ochrana-osobnych-udajov",
	copy: {
		sk: {
			title: "Ochrana osobných údajov",
			description:
				"Ako MAKY.STORE spracúva osobné údaje pri objednávkach, zákazníckom účte, reklamáciách a návšteve webu. Účely, uchovávanie a vaše práva.",
			Body: Sk,
		},
		cs: {
			title: "Ochrana osobních údajů",
			description:
				"Jak MAKY.STORE zpracovává osobní údaje při objednávkách, vedení účtu, reklamacích a návštěvě webu. Účely, uchovávání a vaše práva.",
			Body: Cs,
		},
		de: {
			title: "Datenschutzhinweise",
			description:
				"Welche personenbezogenen Daten MAKY.STORE verarbeitet, zu welchen Zwecken und wie lange. Informationen über Empfänger, Datenschutzrechte und Kontakt.",
			Body: De,
		},
		deAt: {
			title: "Datenschutzhinweise",
			description:
				"Welche personenbezogenen Daten MAKY.STORE verarbeitet, zu welchen Zwecken und wie lange. Informationen über Empfänger, Datenschutzrechte und Kontakt.",
			Body: DeAt,
		},
		pl: {
			title: "Polityka prywatności",
			description:
				"Jak MAKY.STORE przetwarza dane osobowe: cele, podstawy prawne, odbiorcy, przechowywanie danych i przysługujące Państwu prawa.",
			Body: Pl,
		},
		hu: {
			title: "Adatkezelési tájékoztató",
			description:
				"Milyen adatokat kezel a MAKY.STORE, milyen célból és meddig? Adatkezelési jogalapok, címzettek, az Ön jogai és kapcsolattartási lehetőségei.",
			Body: Hu,
		},
		it: {
			title: "Informativa sulla privacy",
			description:
				"Come MAKY.STORE tratta i dati di ordini, account e richieste: finalità, basi giuridiche, servizi utilizzati, conservazione e diritti sulla privacy.",
			Body: It,
		},
		fr: {
			title: "Politique de confidentialité",
			description:
				"Comment MAKY.STORE utilise les données des commandes, comptes et demandes : finalités, bases légales, destinataires, conservation et droits.",
			Body: Fr,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
