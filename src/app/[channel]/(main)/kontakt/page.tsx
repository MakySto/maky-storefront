import { legalRoute } from "@/lib/legal/legal-route";
import { ContactSection } from "@/ui/components/contact/contact-section";
import { Ca, Cs, De, DeAt, Es, Fr, Hu, It, Pl, Ro, Sk, Us } from "@/ui/content/legal/kontakt";

const route = legalRoute({
	path: "/kontakt",
	// The form, where it is switched on. The approved contact copy above it is
	// untouched and is served in every market whether the form is offered or not.
	After: ContactSection,
	copy: {
		sk: {
			title: "Kontakt",
			description:
				"Potrebujete poradiť s výberom alebo objednávkou? Kontaktujte MAKY.STORE. Nájdete tu e-mail, telefón, fakturačné údaje aj adresu na vrátenie tovaru.",
			Body: Sk,
		},
		cs: {
			title: "Kontakt",
			description:
				"Potřebujete poradit s výběrem nebo objednávkou? Kontaktujte MAKY.STORE. Najdete zde e-mail, telefon, fakturační údaje i adresu pro vrácení zboží.",
			Body: Cs,
		},
		de: {
			title: "Kontakt",
			description:
				"Fragen zu Produkten, Fahrzeugkompatibilität oder Ihrer Bestellung? Hier finden Sie unsere Kontaktdaten, Unternehmensangaben und Rücksendeadresse.",
			Body: De,
		},
		deAt: {
			title: "Kontakt",
			description:
				"Fragen zu Produkten, Fahrzeugkompatibilität oder Ihrer Bestellung? Hier finden Sie unsere Kontaktdaten, Unternehmensangaben und Rücksendeadresse.",
			Body: DeAt,
		},
		pl: {
			title: "Kontakt",
			description:
				"Pytania o produkt, dopasowanie akcesoriów lub zamówienie? Dane kontaktowe MAKY.STORE, informacje o sprzedawcy i adres do zwrotów.",
			Body: Pl,
		},
		hu: {
			title: "Kapcsolat",
			description:
				"Kérdése van egy termékről, az autójához való illeszkedésről vagy a rendeléséről? Itt találja elérhetőségeinket, cégadatainkat és a visszaküldési címet.",
			Body: Hu,
		},
		it: {
			title: "Contatti e assistenza",
			heading: "Contatti",
			description:
				"Hai una domanda su un prodotto o un ordine? Contatta MAKY.STORE. Trovi qui i nostri recapiti, i dati aziendali e l’indirizzo per resi e reclami.",
			Body: It,
		},
		fr: {
			title: "Contact et assistance",
			heading: "Contact",
			description:
				"Une question sur un produit ou une commande ? Contactez MAKY.STORE. Retrouvez nos coordonnées, les informations sur la société et l’adresse de retour.",
			Body: Fr,
		},
		es: {
			title: "Contacto y atención al cliente",
			heading: "Contacto",
			description:
				"¿Necesitas ayuda para elegir un accesorio o consultar un pedido? Contacta con MAKY.STORE. Aquí tienes nuestros datos y la dirección para devoluciones.",
			Body: Es,
		},
		ro: {
			title: "Contact și asistență",
			heading: "Contact",
			description:
				"Ai nevoie de ajutor pentru un produs sau o comandă? Contactează MAKY.STORE. Aici găsești datele firmei și adresa pentru retururi și reclamații.",
			Body: Ro,
		},
		enUs: {
			title: "Contact and customer support",
			heading: "Contact us",
			description:
				"Questions about a product, fit or order? Contact MAKY.STORE. Find our email, phone number, company details and return address in Slovakia.",
			Body: Us,
		},
		enCa: {
			title: "Contact and customer support",
			heading: "Contact us",
			description:
				"Questions about a product, fit or order? Contact MAKY.STORE. Find our email, phone number, company details and return address in Slovakia.",
			Body: Ca,
		},
	},
});

export const generateMetadata = route.generateMetadata;

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	return route.Page(props);
}
