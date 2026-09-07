import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, Sk } from "@/ui/content/legal/obchodne-podmienky";

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
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
