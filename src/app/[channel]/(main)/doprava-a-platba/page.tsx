import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Doprava a platba"),
	description:
		"Spôsoby doručenia a platby v MAKY.STORE — kuriér FedEx a online platba cez Stripe. Cenu dopravy vidíte v pokladni.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Doprava a platba">
			<h3>Doprava</h3>
			<p>
				Tovar doručujeme kuriérskou službou FedEx. Cena dopravy závisí od rozmerov, hmotnosti a adresy
				doručenia a zákazník ju vidí v pokladni ešte pred odoslaním objednávky.
			</p>
			<p>
				Predpokladaný termín dodania závisí od dostupnosti tovaru a zvolenej dopravy. Ak je pri objednávke
				uvedený odhadovaný termín doručenia, slúži ako orientačný.
			</p>
			<h3>Platba</h3>
			<p>
				Platba prebieha online prostredníctvom zabezpečenej platobnej brány Stripe. Podporované platobné
				metódy sa zákazníkovi zobrazia pri platbe.
			</p>
		</LegalPage>
	);
}
