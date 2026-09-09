import { type WithdrawalCopy } from "./copy-de";

/**
 * Hungarian copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Nothing imports this, and that is correct. Returns V2 pins `market: "SK"` and
 * `locale: "sk"` as literal types (`contract.ts`), so the Payload endpoint rejects a
 * notice submitted from `/hu`. `servesOnlineFunction()` keeps the form Slovak-only, and
 * `/hu/odstupenie-od-zmluvy` renders the "preview not activated" notice instead.
 *
 * ## Hungary's online function is a concrete duty, and it names its own controls
 *
 * 45/2014. (II. 26.) Korm. rendelet § 22 requires a trader who offers withdrawal online
 * to provide the function on the website, and prescribes how the two controls must be
 * labelled. Those labels are therefore NOT free translation choices:
 *
 * - entry control:   **„Elállás a szerződéstől”**
 * - confirm control: **„Elállás megerősítése”**
 *
 * They are pinned by `copy-pl-hu.test.ts`. Do not "improve" them into something that reads
 * more naturally — the wording is the compliance artefact. This is the one place where
 * Hungarian differs structurally from `copy-de.ts`, where the two German labels are
 * bound to the contract rather than to a statute.
 *
 * Because the duty is concrete, the missing online function is a SALES readiness question
 * for `hu`, not merely a missing convenience. Whether it blocks opening the market is
 * M's and R's call, not this file's — but it should not be discovered late.
 *
 * ## Provenance — read this before treating the strings as approved
 *
 * The two control labels are statutory and exact (see above). **Everything else in this
 * file is still my own drafting**, because no `data/ui.hu-HU.json` has reached this
 * machine: the Polish export was recovered from a later package, the Hungarian one was
 * not. Searched the whole box, including every delivered bundle — the only Hungarian
 * artefact present is a legal-differences note marked "len-historia".
 *
 * So this file is NOT in the same state as `copy-pl.ts`, which is now the delivered
 * export verbatim. Two defects that the Polish export proved were real have been fixed
 * here by hand, to the same semantics:
 *
 * 1. `acceptedBody` promised the time of sending AND of receipt. Only sending is
 *    evidenced, and it is also what the statute asks for — 45/2014 § 22(1c) says "a
 *    megküldés napját és időpontját", the day and time of SENDING. The package
 *    deliberately does not adopt the German "Eingang" here. `receivedTimeLabel` stays as
 *    a dormant label and must NOT be filled with a copy of `submittedAt`, which is the
 *    time of the database write — a third event again.
 * 2. `unknownBody` told the customer to check "az ügy állapotát". No customer-facing
 *    case-status view exists, so it pointed at nothing.
 *
 * ⚠️ When `data/ui.hu-HU.json` arrives, replace this object from it wholesale the way
 * `copy-pl.ts` was replaced, and do not assume the wording below survived. Nothing here
 * is wired, so that swap costs nothing.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * 1. The form's strings still live inline in `withdrawal-form.tsx` JSX; wiring a second
 *    language means extracting them into a copy map first. That is Returns V2's surface.
 * 2. `receivedAt` does not exist yet — see `copy-de.ts`. Do not mint a second timestamp
 *    in the storefront; a client clock is not evidence.
 * 3. **Never submit `hu` as `market: "SK"`.** It would write a legal record naming the
 *    wrong market.
 */
export const WITHDRAWAL_COPY_HU: WithdrawalCopy = {
	entryLabel: "Elállás a szerződéstől",
	formTitle: "Online elállás",
	intro: "A nyilatkozatot vásárlói fiók nélkül is elküldheti. Indokolást nem kérünk.",
	fullName: {
		label: "Teljes név",
		help: "Annak a személynek a nevét adja meg, aki eláll a vásárlástól.",
		requiredError: "Kérjük, adja meg a nevét.",
	},
	email: {
		label: "E-mail-cím a visszaigazoláshoz",
		help: "Erre a címre küldjük el a nyilatkozat másolatát és a beérkezés visszaigazolását.",
		requiredError: "Kérjük, adjon meg egy e-mail-címet a visszaigazoláshoz.",
		invalidError: "Kérjük, ellenőrizze az e-mail-cím helyességét.",
	},
	contractReference: {
		label: "Rendelési szám vagy a vásárlás egyéb adata",
		help: "A rendelési szám a rendelés visszaigazolásában található. Ha nincs kéznél, írja le a vásárlást, például a termék nevével és a rendelés hozzávetőleges dátumával.",
		requiredError: "Kérjük, adjon meg olyan adatot, amellyel a vásárlás azonosítható.",
	},
	scopeLabel: "Mire vonatkozik az elállás?",
	scopeWhole: "A teljes rendelésre",
	scopePartial: "Csak egyes termékekre",
	itemsLabel: "Érintett termékek és darabszám",
	itemsHelp:
		"Adja meg a termék nevét vagy cikkszámát és a darabszámot. A megnevezésnek nem kell pontosan egyeznie a katalógussal, de legyen felismerhető, mely termékekről van szó.",
	itemsRequiredError: "Kérjük, adja meg, mely termékekre és hány darabra vonatkozik az elállás.",
	pickupInterest: "Árajánlatot kérek a termék elszállítására",
	pickupHelp:
		"Ez csak érdeklődés. Fizetős elszállítást kizárólag az ár kifejezett elfogadása után rendelünk meg.",
	noteLabel: "További üzenet (nem kötelező)",
	privacyNotice:
		"A megadott adatokat az elállás befogadásához és intézéséhez, valamint jogi kötelezettségeink teljesítéséhez használjuk. A részleteket az adatkezelési tájékoztató ismerteti.",
	reviewButton: "Adatok ellenőrzése",
	reviewTitle: "Kérjük, ellenőrizze a nyilatkozatát",
	declarationWhole: "Ezennel teljes egészében elállok az alább megjelölt adásvételi szerződéstől.",
	declarationPartial:
		"Ezennel elállok az alább megjelölt adásvételi szerződéstől a felsorolt termékek és darabszámok tekintetében.",
	finalExplanation:
		"Az alábbi gombbal elállási nyilatkozatot küld el. Ez nem pusztán megkeresés az ügyfélszolgálat felé.",
	editButton: "Adatok módosítása",
	submitButton: "Elállás megerősítése",
	submitting: "A nyilatkozat küldése folyamatban…",
	acceptedTitle: "Elállási nyilatkozatát megkaptuk",
	acceptedBody:
		"A visszaigazolást a nyilatkozat szövegével, valamint az elküldés napjával és időpontjával a megadott e-mail-címre küldjük el. A további teendőkről tájékoztatjuk.",
	receiptNumberLabel: "Ügyszám",
	submissionTimeLabel: "Az elküldés dátuma és időpontja",
	receivedTimeLabel: "A beérkezés dátuma és időpontja",
	saveReceipt: "Visszaigazolás mentése",
	emailIssue:
		"A nyilatkozatot elmentettük. A visszaigazolást eddig nem sikerült e-mailben elküldeni. Újra megkíséreljük a küldést. A visszaigazolást itt is elmentheti; elállása beérkezettként marad nyilvántartva.",
	failedTitle: "A nyilatkozatot nem sikerült befogadni",
	failedBody:
		"Próbálja meg újra, vagy küldje el nyilatkozatát az info@maky.store címre. A beírt adatok megmaradnak az űrlapon.",
	unknownTitle: "A küldés eredményét nem sikerült megerősíteni",
	unknownBody:
		"Nem tudjuk megbízhatóan megállapítani, hogy a nyilatkozat beérkezett-e. Kérjük, ellenőrizze a postaládáját. Ismételt küldésnél ugyanazt az azonosítót használjuk, hogy ne jöjjön létre kettős ügy. Nyilatkozatát az info@maky.store címre is elküldheti.",
	rateLimit:
		"A küldés átmenetileg korlátozott. Próbálja meg később, vagy küldje el nyilatkozatát az info@maky.store címre.",
	unavailable:
		"Az online küldés jelenleg nem érhető el. Nyilatkozatát elküldheti az info@maky.store címre vagy postán. Dolgozunk az online funkció helyreállításán.",
	noScript:
		"Az interaktív funkcióhoz JavaScript szükséges. Nyilatkozatát elküldheti az info@maky.store címre is, vagy használhatja a nyomtatható nyilatkozatmintát.",
};
