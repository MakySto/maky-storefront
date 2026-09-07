import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, Sk } from "@/ui/content/legal/reklamacie-a-vratenie";

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
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
