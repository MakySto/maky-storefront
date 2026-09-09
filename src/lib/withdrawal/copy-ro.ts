import { type WithdrawalCopy } from "./copy-de";

/**
 * Romanian copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Nothing imports this, and that is correct. Returns V2 pins `market: "SK"` and
 * `locale: "sk"` as literal types (`contract.ts`), so the Payload endpoint rejects a
 * notice submitted from `/ro`. Rendering the form there would offer a customer a button
 * that cannot produce a legal record — the one outcome the feature exists to prevent.
 * `servesOnlineFunction()` keeps the form Slovak-only, and `/ro/odstupenie-od-zmluvy`
 * renders the "preview not activated" notice instead.
 *
 * ## Why the gap matters here, and why it does NOT transfer to Spain
 *
 * Romania has required an online withdrawal function since 19 June 2026: OUG 18/2026
 * art. II inserts art. 11^1 into OUG 34/2014, and its art. IV sets that date — the same
 * date as Italy and France. So the preview state is a gap for R and M to close, not a
 * lawful permanent substitute, and not something `noindex` resolves; the duty attaches to
 * serving Romanian consumers.
 *
 * The Spanish file is deliberately NOT in the same position. See `copy-es.ts`: the
 * equivalent Spanish transposing instrument was not established, and that stays an open
 * question for M rather than being settled by analogy with this one.
 *
 * Separately, the same Romanian instrument carries provisions that only take effect on
 * 27 September 2026 (the green-transition and harmonised guarantee-information parts).
 * Those are a joint M/K item for a release after that date, not a duty this copy claims
 * today, and not a reason to hold this file up.
 *
 * ## Diacritics are load-bearing
 *
 * Comma-below `ș`/`ț` (U+0219/U+021B) throughout, never cedilla `ş`/`ţ` (U+015F/U+0163).
 * They are different code points, only the comma-below pair is correct Romanian, and no
 * compiler, linter or build step would notice the wrong one. `copy-es-ro.test.ts` checks
 * this file and the printable form for cedillas.
 *
 * ## Provenance
 *
 * Every string is the delivered editorial value, verbatim, from `data/ui.ro-RO.json`
 * (`schema maky-editorial-ui/1`, `locale ro-RO`), GENERATED from that JSON rather than
 * typed out — a hand-written Polish draft once drifted from the approved export in 21 of
 * 38 strings.
 *
 * `privacyHref` (`/ro/ochrana-osobnych-udajov`) and the `formExtras` block are in the
 * delivered JSON but not in `WithdrawalCopy`. They are recorded in the R handoff rather
 * than bolted onto a shared type this thread does not own.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * 1. The form's strings still live inline in `withdrawal-form.tsx` JSX. Wiring a second
 *    language means extracting them into a copy map first.
 * 2. **The storefront prints no time at all, and must not start.** `WithdrawalV2Accepted`
 *    carries no timestamp, `withdrawal-form.tsx` renders none, and `formsTimestampSeconds()`
 *    is the HMAC replay window, not a business time. Both time labels are dormant.
 *    `acceptedBody` promises the time the notice was SENT, so an ordinary check that
 *    Payload's confirmation prints that is enough. Never mint a second timestamp here.
 * 3. **Never submit `ro` as `market: "SK"`.** It would write a legal record naming the
 *    wrong market.
 */
export const WITHDRAWAL_COPY_RO: WithdrawalCopy = {
	entryLabel: "Retrage-te din contract aici",
	formTitle: "Retragere online",
	intro: "Poți trimite declarația fără cont de client. Nu trebuie să indici un motiv.",
	fullName: {
		label: "Nume și prenume",
		help: "Indică numele persoanei care se retrage din contract.",
		requiredError: "Completează numele și prenumele.",
	},
	email: {
		label: "E-mail pentru confirmare",
		help: "Trimitem la această adresă o copie a declarației și confirmarea primirii.",
		requiredError: "Completează o adresă de e-mail pentru confirmare.",
		invalidError: "Verifică dacă adresa de e-mail este corectă.",
	},
	contractReference: {
		label: "Numărul comenzii sau alte date ale cumpărăturii",
		help: "Găsești numărul în confirmarea comenzii. Dacă nu îl ai la îndemână, descrie cumpărătura, de exemplu prin produs și data aproximativă a comenzii.",
		requiredError: "Completează date care ne permit identificarea cumpărăturii.",
	},
	scopeLabel: "La ce se referă retragerea?",
	scopeWhole: "La întreaga comandă",
	scopePartial: "Numai la anumite produse",
	itemsLabel: "Produse și cantități",
	itemsHelp:
		"Indică numele sau codul produsului și cantitatea. Denumirea nu trebuie să fie identică cu cea din catalog, dar trebuie să permită identificarea produsului.",
	itemsRequiredError: "Indică produsele vizate și cantitățile lor.",
	pickupInterest: "Doresc o ofertă pentru ridicarea coletului",
	pickupHelp:
		"Este doar o solicitare de preț. Comandăm o ridicare contra cost numai după acceptarea ta expresă a prețului.",
	noteLabel: "Mesaj suplimentar (opțional)",
	privacyNotice:
		"Folosim datele pentru primirea și gestionarea retragerii și pentru obligațiile legale. Detaliile sunt în Politica de confidențialitate.",
	reviewButton: "Verifică datele",
	reviewTitle: "Verifică declarația",
	declarationWhole: "Prin prezenta mă retrag integral din contractul de vânzare identificat mai jos.",
	declarationPartial:
		"Prin prezenta mă retrag din contractul de vânzare identificat mai jos în privința produselor și cantităților indicate.",
	finalExplanation:
		"Butonul de mai jos trimite o declarație de retragere din contract. Nu este doar o întrebare pentru serviciul de asistență.",
	editButton: "Modifică datele",
	submitButton: "Confirmă retragerea",
	submitting: "Se trimite declarația…",
	acceptedTitle: "Am primit declarația de retragere",
	acceptedBody:
		"Trimitem la adresa de e-mail indicată confirmarea cu textul declarației și data și ora transmiterii. Îți vom comunica pașii următori.",
	receiptNumberLabel: "Număr de înregistrare",
	submissionTimeLabel: "Data și ora transmiterii",
	receivedTimeLabel: "Data și ora primirii",
	saveReceipt: "Salvează confirmarea",
	emailIssue:
		"Declarația a fost înregistrată, dar nu am reușit încă să trimitem confirmarea prin e-mail. Vom reîncerca. Poți salva confirmarea și aici; retragerea rămâne înregistrată ca primită.",
	failedTitle: "Declarația nu a putut fi înregistrată",
	failedBody:
		"Încearcă din nou sau trimite declarația la info@maky.store. Datele introduse rămân în formular.",
	unknownTitle: "Nu am putut confirma rezultatul trimiterii",
	unknownBody:
		"Nu putem stabili cu certitudine dacă declarația a fost primită. Verifică e-mailul. La reîncercare folosim același identificator pentru a evita înregistrarea dublă. Poți trimite declarația și la info@maky.store.",
	rateLimit:
		"Trimiterea este limitată temporar. Încearcă mai târziu sau trimite declarația la info@maky.store.",
	unavailable:
		"Trimiterea online nu este disponibilă acum. Poți trimite declarația la info@maky.store sau prin poștă. Lucrăm la restabilirea funcției.",
	noScript:
		"Funcția interactivă necesită JavaScript. Poți trimite declarația și la info@maky.store sau folosi formularul de imprimat.",
};
