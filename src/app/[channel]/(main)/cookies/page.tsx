import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Zásady používania cookies"),
	description: "Aké cookies používame na maky.store a ako spravovať svoj súhlas.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Zásady používania cookies">
			<p>
				Cookies sú malé textové súbory, ktoré pomáhajú zabezpečiť fungovanie webu, košíka, prihlásenia,
				merania návštevnosti a prípadne marketingových funkcií.
			</p>
			<p>Používame tieto typy cookies:</p>
			<ul>
				<li>
					<strong>Nevyhnutné cookies</strong> — sú potrebné na fungovanie webu, košíka, prihlásenia a
					zabezpečenia. Ukladajú sa bez súhlasu.
				</li>
				<li>
					<strong>Analytické cookies</strong> — pomáhajú nám rozumieť návštevnosti a používaniu webu. Ukladajú
					sa iba s vaším súhlasom.
				</li>
				<li>
					<strong>Marketingové cookies</strong> — pomáhajú zobrazovať relevantnejší obsah a reklamu. Ukladajú
					sa iba s vaším súhlasom.
				</li>
			</ul>
			<p>
				Svoj súhlas môžete kedykoľvek zmeniť alebo odvolať cez tlačidlo „Nastavenia súkromia“ v pätičke nášho
				webu. Cookies môžete obmedziť aj v nastaveniach svojho internetového prehliadača.
			</p>
		</LegalPage>
	);
}
