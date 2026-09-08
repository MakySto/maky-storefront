import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Sk } from "@/ui/content/legal/ochrana-osobnych-udajov";

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
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
