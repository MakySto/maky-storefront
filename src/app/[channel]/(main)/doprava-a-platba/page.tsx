import { legalRoute } from "@/lib/legal/legal-route";
import { Cs, Sk } from "@/ui/content/legal/doprava-a-platba";

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
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
