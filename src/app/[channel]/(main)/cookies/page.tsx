import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, De, DeAt, Sk } from "@/ui/content/legal/cookies";

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
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
