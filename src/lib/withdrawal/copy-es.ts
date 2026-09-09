import { type WithdrawalCopy } from "./copy-de";

/**
 * Spanish copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Nothing imports this, and that is correct. Returns V2 pins `market: "SK"` and
 * `locale: "sk"` as literal types (`contract.ts`), so the Payload endpoint rejects a
 * notice submitted from `/es`. Rendering the form there would offer a customer a button
 * that cannot produce a legal record — the one outcome the feature exists to prevent.
 * `servesOnlineFunction()` keeps the form Slovak-only, and `/es/odstupenie-od-zmluvy`
 * renders the "preview not activated" notice instead.
 *
 * ## Spain's position is NOT Italy's or France's, and must not be described as if it were
 *
 * For Italy and France the delivered research established a transposed online-withdrawal
 * duty in force from 19 June 2026, with the instrument named in each case. For Spain it
 * did not. What was verified is Directive (EU) 2023/2673 — art. 1(3) inserting art. 11bis,
 * applicable 19 June 2026 — as published in the BOE, which is the EU text appearing in a
 * Spanish official journal and NOT a Spanish transposing instrument.
 *
 * That is the boundary of what was checked, and it points in neither direction: it is not
 * a finding that Spain has the duty, and it is not a finding that e-mail suffices in Spain
 * indefinitely. It is an open question for M. Do not resolve it by analogy to Italy, and
 * do not let the absence of a citation here become an argument that nothing is required.
 *
 * ## Provenance
 *
 * Every string is the delivered editorial value, verbatim, from `data/ui.es-ES.json`
 * (`schema maky-editorial-ui/1`, `locale es-ES`). This file was GENERATED from that JSON
 * rather than typed out, for the same reason the Italian one was: a hand-written Polish
 * draft once drifted from the approved export in 21 of 38 strings.
 *
 * `privacyHref` (`/es/ochrana-osobnych-udajov`) and the `formExtras` block are in the
 * delivered JSON but not in `WithdrawalCopy`. They are recorded in the R handoff rather
 * than bolted onto a shared type this thread does not own.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * 1. The form's strings still live inline in `withdrawal-form.tsx` JSX. Wiring a second
 *    language means extracting them into a copy map first. That file is the Returns V2
 *    surface, so the extraction is deliberately not done here.
 * 2. **The storefront prints no time at all, and must not start.** `WithdrawalV2Accepted`
 *    carries no timestamp, `withdrawal-form.tsx` renders none, and the only clock on the
 *    submit path is `formsTimestampSeconds()` — the HMAC replay window, not a business
 *    time. `submissionTimeLabel` and `receivedTimeLabel` are dormant labels for a UI that
 *    does not exist yet. `acceptedBody` promises the acknowledgement will carry the time
 *    the notice was SENT, so an ordinary check that Payload's confirmation prints that is
 *    enough. Never mint a second timestamp here, and never fill `receivedTimeLabel` by
 *    copying another field.
 * 3. **Never submit `es` as `market: "SK"`.** It would write a legal record naming the
 *    wrong market.
 */
export const WITHDRAWAL_COPY_ES: WithdrawalCopy = {
	entryLabel: "Desistir del contrato aquí",
	formTitle: "Desistimiento online",
	intro: "Puedes enviar la declaración sin una cuenta de cliente. No tienes que indicar un motivo.",
	fullName: {
		label: "Nombre y apellidos",
		help: "Indica el nombre de la persona que desiste del contrato.",
		requiredError: "Introduce tu nombre y apellidos.",
	},
	email: {
		label: "Correo electrónico para la confirmación",
		help: "Enviaremos a esta dirección una copia de la declaración y la confirmación de su recepción.",
		requiredError: "Introduce un correo electrónico para la confirmación.",
		invalidError: "Comprueba que el correo electrónico sea correcto.",
	},
	contractReference: {
		label: "Número de pedido u otros datos de la compra",
		help: "Encontrarás el número en la confirmación del pedido. Si no lo tienes a mano, describe la compra, por ejemplo con el producto y la fecha aproximada del pedido.",
		requiredError: "Introduce datos que nos permitan identificar la compra.",
	},
	scopeLabel: "¿A qué afecta el desistimiento?",
	scopeWhole: "A todo el pedido",
	scopePartial: "Solo a algunos productos",
	itemsLabel: "Productos y cantidades",
	itemsHelp:
		"Indica el nombre o código del producto y la cantidad. El nombre no tiene que coincidir exactamente con el catálogo, pero debe permitir identificar el producto.",
	itemsRequiredError: "Indica los productos afectados y sus cantidades.",
	pickupInterest: "Quiero un presupuesto de recogida",
	pickupHelp:
		"Es solo una consulta de precio. Contrataremos una recogida de pago únicamente cuando aceptes expresamente su coste.",
	noteLabel: "Mensaje adicional (opcional)",
	privacyNotice:
		"Utilizamos estos datos para recibir y gestionar el desistimiento y cumplir nuestras obligaciones legales. Consulta los detalles en la Política de privacidad.",
	reviewButton: "Revisar los datos",
	reviewTitle: "Revisa la declaración",
	declarationWhole:
		"Por la presente desisto de la totalidad del contrato de compraventa identificado a continuación.",
	declarationPartial:
		"Por la presente desisto del contrato de compraventa identificado a continuación respecto de los productos y cantidades indicados.",
	finalExplanation:
		"El botón siguiente envía una declaración de desistimiento del contrato. No es solo una consulta al servicio de atención al cliente.",
	editButton: "Modificar los datos",
	submitButton: "Confirmar desistimiento",
	submitting: "Enviando la declaración…",
	acceptedTitle: "Hemos recibido tu declaración de desistimiento",
	acceptedBody:
		"Enviamos al correo indicado la confirmación con el contenido de la declaración y la fecha y hora de su envío. Te indicaremos cómo continuar.",
	receiptNumberLabel: "Número de referencia",
	submissionTimeLabel: "Fecha y hora de envío",
	receivedTimeLabel: "Fecha y hora de recepción",
	saveReceipt: "Guardar la confirmación",
	emailIssue:
		"La declaración ha quedado registrada, pero todavía no hemos podido enviar la confirmación por correo. Volveremos a intentarlo. Puedes guardar la confirmación aquí; el desistimiento sigue registrado como recibido.",
	failedTitle: "No se ha podido registrar la declaración",
	failedBody:
		"Vuelve a intentarlo o envía la declaración a info@maky.store. Los datos introducidos permanecen en el formulario.",
	unknownTitle: "No hemos podido confirmar el resultado del envío",
	unknownBody:
		"No podemos determinar con certeza si la declaración se ha recibido. Revisa tu correo. Al volver a intentarlo utilizaremos el mismo identificador para evitar una doble presentación. También puedes enviarla a info@maky.store.",
	rateLimit:
		"El envío está limitado temporalmente. Inténtalo más tarde o envía la declaración a info@maky.store.",
	unavailable:
		"El envío online no está disponible en este momento. Puedes enviar la declaración a info@maky.store o por correo postal. Estamos trabajando para restablecer la función.",
	noScript:
		"La función interactiva necesita JavaScript. También puedes enviar la declaración a info@maky.store o utilizar el formulario para imprimir.",
};
