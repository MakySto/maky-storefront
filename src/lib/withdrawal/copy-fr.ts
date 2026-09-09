import { type WithdrawalCopy } from "./copy-de";

/**
 * French copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Same position as `copy-it.ts`: Returns V2 pins `market: "SK"` and `locale: "sk"` as
 * literal types, so a notice submitted from `/fr` is rejected by the endpoint that stores
 * it. `servesOnlineFunction()` keeps the form Slovak-only and `/fr/odstupenie-od-zmluvy`
 * renders the "preview not activated" notice.
 *
 * France introduced the same duty on the same date: décret n° 2026-3 of 5 January 2026
 * added article D221-5 to the code de la consommation, applicable from 19 June 2026, on
 * the statutory basis of L221-21. A visible, available function; identification of the
 * person, the contract and the electronic channel; a durable acknowledgement carrying the
 * content and the date and time of SENDING.
 *
 * ## Three words that are not synonyms
 *
 * *Rétractation* is the consumer's no-reason withdrawal — this file. *Résolution* is the
 * remedy for a non-conforming product. *Résiliation* is terminating a continuing
 * contract. French law treats them separately and so must this copy; swapping one for
 * another to avoid repetition would misdescribe the right being exercised.
 *
 * `entryLabel` and `submitButton` — *Renoncer au contrat ici* and *Confirmer la
 * rétractation* — are the unambiguous labels the delivered legal research settled on.
 * They are a compliance artefact, not a translation choice.
 *
 * ## Provenance
 *
 * Generated from the delivered `data/ui.fr-FR.json` (`schema maky-editorial-ui/1`,
 * `locale fr-FR`), verbatim. See `copy-it.ts` for why these files are generated from the
 * export rather than transcribed by hand.
 *
 * `privacyHref` (`/fr/ochrana-osobnych-udajov`) and `formExtras` are in the delivered JSON
 * but not in `WithdrawalCopy`; they are in the R handoff instead.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * The three points in `copy-it.ts` apply unchanged, including the one about time:
 * `acceptedBody` promises the date and time of SENDING and nothing else. The storefront
 * itself prints no time — both time labels are dormant — so making that promise true is a
 * matter of what Payload renders into the acknowledgement, not of adding a field here.
 *
 * One French addition: the 30-day cap on bringing a product back into conformity
 * (L217-10) belongs to the defect remedy, not to withdrawal. Do not let it migrate into
 * this flow, and do not overwrite it elsewhere with the Slovak objective-cause exception.
 */
export const WITHDRAWAL_COPY_FR: WithdrawalCopy = {
	entryLabel: "Renoncer au contrat ici",
	formTitle: "Rétractation en ligne",
	intro: "Vous pouvez envoyer la déclaration sans compte client. Aucun motif n’est demandé.",
	fullName: {
		label: "Prénom et nom",
		help: "Indiquez le prénom et le nom de la personne qui se rétracte.",
		requiredError: "Indiquez votre prénom et votre nom.",
	},
	email: {
		label: "E-mail pour la confirmation",
		help: "Nous y enverrons une copie de la déclaration et la confirmation de sa réception.",
		requiredError: "Indiquez une adresse e-mail pour la confirmation.",
		invalidError: "Vérifiez que l’adresse e-mail est correcte.",
	},
	contractReference: {
		label: "Numéro de commande ou autres références d’achat",
		help: "Le numéro figure dans la confirmation de commande. À défaut, décrivez l’achat, par exemple avec le produit et la date approximative de la commande.",
		requiredError: "Indiquez des informations permettant d’identifier l’achat.",
	},
	scopeLabel: "Sur quoi porte la rétractation ?",
	scopeWhole: "Toute la commande",
	scopePartial: "Certains produits seulement",
	itemsLabel: "Produits et quantités",
	itemsHelp:
		"Indiquez le nom ou la référence du produit et la quantité. Le nom ne doit pas être strictement identique au catalogue, mais le produit doit être identifiable.",
	itemsRequiredError: "Précisez les produits concernés et leurs quantités.",
	pickupInterest: "Je souhaite un devis d’enlèvement",
	pickupHelp:
		"Il s’agit seulement d’une demande de prix. Nous ne commanderons un enlèvement payant qu’après votre acceptation expresse de son coût.",
	noteLabel: "Message complémentaire (facultatif)",
	privacyNotice:
		"Nous utilisons ces données pour recevoir et traiter votre rétractation et respecter nos obligations légales. Les détails figurent dans la politique de confidentialité.",
	reviewButton: "Vérifier les informations",
	reviewTitle: "Vérifiez votre déclaration",
	declarationWhole: "Je me rétracte par la présente de la totalité du contrat de vente identifié ci-dessous.",
	declarationPartial:
		"Je me rétracte par la présente du contrat de vente identifié ci-dessous pour les produits et quantités indiqués.",
	finalExplanation:
		"Le bouton ci-dessous envoie une déclaration de rétractation du contrat. Il ne s’agit pas d’une simple demande d’assistance.",
	editButton: "Modifier les informations",
	submitButton: "Confirmer la rétractation",
	submitting: "Envoi de la déclaration…",
	acceptedTitle: "Nous avons reçu votre déclaration de rétractation",
	acceptedBody:
		"Nous envoyons à l’adresse e-mail indiquée une confirmation contenant votre déclaration ainsi que la date et l’heure de son envoi. Nous vous informerons des prochaines étapes.",
	receiptNumberLabel: "Numéro de dossier",
	submissionTimeLabel: "Date et heure d’envoi",
	receivedTimeLabel: "Date et heure de réception",
	saveReceipt: "Enregistrer la confirmation",
	emailIssue:
		"La déclaration est enregistrée, mais la confirmation n’a pas encore pu être envoyée par e-mail. Nous renouvelons la tentative. Vous pouvez aussi l’enregistrer ici ; votre rétractation reste enregistrée comme reçue.",
	failedTitle: "La déclaration n’a pas pu être reçue",
	failedBody:
		"Réessayez ou envoyez la déclaration à info@maky.store. Vos données restent dans le formulaire.",
	unknownTitle: "Le résultat de l’envoi n’a pas pu être confirmé",
	unknownBody:
		"Nous ne pouvons pas établir avec certitude si la déclaration a été reçue. Vérifiez vos e-mails. En cas de nouvelle tentative, nous utiliserons le même identifiant pour éviter un double enregistrement. Vous pouvez aussi envoyer la déclaration à info@maky.store.",
	rateLimit: "L’envoi est temporairement limité. Réessayez plus tard ou écrivez à info@maky.store.",
	unavailable:
		"L’envoi en ligne est actuellement indisponible. Vous pouvez transmettre votre déclaration à info@maky.store ou par courrier. Nous travaillons au rétablissement de la fonction.",
	noScript:
		"La fonction interactive nécessite JavaScript. Vous pouvez également envoyer la déclaration à info@maky.store ou utiliser le formulaire à imprimer.",
};
