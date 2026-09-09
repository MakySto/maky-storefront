import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Fr, Hu, It, Pl, Sk } from "@/ui/content/legal/cookies";

const route = legalRoute({
	path: "/cookies",
	copy: {
		sk: {
			title: "Zásady používania cookies",
			description:
				"Čo sú cookies a podobné technológie, na čo ich MAKY.STORE používa a ako si môžete nastaviť alebo odvolať súhlas s analytikou a marketingom.",
			Body: Sk,
		},
		cs: {
			title: "Zásady používání cookies",
			description:
				"Co jsou cookies a podobné technologie, k čemu je MAKY.STORE používá a jak si můžete nastavit nebo odvolat souhlas s analytikou a marketingem.",
			Body: Cs,
		},
		de: {
			title: "Cookies und Datenschutzeinstellungen",
			description:
				"Informationen über Cookies und ähnliche Technologien bei MAKY.STORE. Optionale Zwecke auswählen, ablehnen oder Ihre Datenschutzeinstellungen ändern.",
			Body: De,
		},
		deAt: {
			title: "Cookies und Datenschutzeinstellungen",
			description:
				"Informationen über Cookies und ähnliche Technologien bei MAKY.STORE. Optionale Zwecke auswählen, ablehnen oder Ihre Datenschutzeinstellungen ändern.",
			Body: DeAt,
		},
		pl: {
			title: "Pliki cookies i ustawienia prywatności",
			description:
				"Informacje o cookies, pamięci przeglądarki i zgodach w MAKY.STORE. Jak zaakceptować, odrzucić lub zmienić opcjonalne ustawienia.",
			Body: Pl,
		},
		hu: {
			title: "Sütik és adatvédelmi beállítások",
			description:
				"Tájékoztató a MAKY.STORE sütijeiről, böngészőtárhelyéről és hozzájárulásairól. Az opcionális elemzés és marketing beállítása vagy elutasítása.",
			Body: Hu,
		},
		it: {
			title: "Cookie e preferenze sulla privacy",
			heading: "Cookie e preferenze",
			description:
				"Cookie, memoria del browser e strumenti di misura di MAKY.STORE: finalità, durata e scelta delle preferenze. Puoi rifiutare analisi e marketing facoltativi.",
			Body: It,
		},
		fr: {
			title: "Cookies et préférences de confidentialité",
			heading: "Cookies et préférences",
			description:
				"Cookies, stockage du navigateur et mesure sur MAKY.STORE : finalités, durées et choix. Refusez les mesures et publicités facultatives sans bloquer vos achats.",
			Body: Fr,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
