import { type WithdrawalCopy } from "./copy-de";

/**
 * Polish copy for the online withdrawal function — PREPARED, NOT WIRED.
 *
 * Nothing imports this, and that is correct. Returns V2 pins `market: "SK"` and
 * `locale: "sk"` as literal types (`contract.ts`), so the Payload endpoint rejects a
 * notice submitted from `/pl`. Rendering the form there would offer a customer a button
 * that cannot produce a legal record — the one outcome the feature exists to prevent.
 * `servesOnlineFunction()` keeps the form Slovak-only, and `/pl/odstupenie-od-zmluvy`
 * renders the "preview not activated" notice instead.
 *
 * ## Why it is here anyway
 *
 * So that the copy is not the thing holding up the release that switches the function on.
 * The same reasoning as `copy-de.ts`, with one difference worth stating precisely:
 *
 * **Poland's position is open, not settled.** For Germany the missing online function is
 * a demonstrable sales blocker (§ 356a BGB since 2026-06-19). For Hungary it is a
 * concrete duty with prescribed control labels (45/2014. (II. 26.) Korm. rendelet § 22).
 * For Poland the delivered package deliberately did NOT close the question of which
 * published provision transposes the online-function requirement and from when. That is
 * recorded as an open item for M/R — it is emphatically NOT a finding that e-mail always
 * suffices in Poland, and this file must not be read as one.
 *
 * ## Provenance
 *
 * ⚠️ Unlike `copy-de.ts`, these strings did NOT come from a delivered `data/ui.*.json`.
 * The PL/HU package arrived on this machine as the two page-copy Markdown documents
 * only. They are translated from the reviewed Slovak form copy and the German file above,
 * and no Polish speaker has reviewed them. Flagged in the handoff: treat them as a
 * complete draft that still needs a native-speaker pass before the form goes live.
 *
 * ## What the owner of Returns V2 needs to know before using this
 *
 * 1. The form's strings still live inline in `withdrawal-form.tsx` JSX. Wiring a second
 *    language means extracting them into a copy map first. That file is the Returns V2
 *    surface, so the extraction is deliberately not done here.
 * 2. `receivedAt` does not exist yet — see `copy-de.ts` for the full note. Do not mint a
 *    second timestamp in the storefront; a client clock is not evidence.
 * 3. **Never submit `pl` as `market: "SK"`.** It would write a legal record naming the
 *    wrong market.
 */
export const WITHDRAWAL_COPY_PL: WithdrawalCopy = {
	entryLabel: "Odstąp od umowy",
	formTitle: "Odstąpienie online",
	intro: "Oświadczenie można wysłać bez konta klienta. Nie trzeba podawać przyczyny.",
	fullName: {
		label: "Imię i nazwisko",
		help: "Prosimy podać imię i nazwisko osoby odstępującej od umowy.",
		requiredError: "Prosimy podać imię i nazwisko.",
	},
	email: {
		label: "Adres e-mail do potwierdzenia",
		help: "Na ten adres wyślemy kopię oświadczenia i potwierdzenie jego otrzymania.",
		requiredError: "Prosimy podać adres e-mail do potwierdzenia.",
		invalidError: "Prosimy sprawdzić poprawność adresu e-mail.",
	},
	contractReference: {
		label: "Numer zamówienia lub inne dane zakupu",
		help: "Numer zamówienia znajduje się w potwierdzeniu zamówienia. Jeżeli nie mają go Państwo pod ręką, prosimy opisać zakup, na przykład nazwą produktu i przybliżoną datą zamówienia.",
		requiredError: "Prosimy podać dane, które pozwolą nam przyporządkować zakup.",
	},
	scopeLabel: "Czego dotyczy odstąpienie?",
	scopeWhole: "Całego zamówienia",
	scopePartial: "Tylko wybranych produktów",
	itemsLabel: "Produkty i liczba sztuk",
	itemsHelp:
		"Prosimy podać nazwę lub numer produktu oraz liczbę sztuk. Nazwa nie musi dokładnie odpowiadać katalogowi, ale musi być jasne, o które produkty chodzi.",
	itemsRequiredError: "Prosimy wskazać, których produktów i ilu sztuk dotyczy odstąpienie.",
	pickupInterest: "Chcę otrzymać wycenę odbioru przesyłki",
	pickupHelp:
		"To wyłącznie zapytanie. Płatny odbiór zlecimy dopiero po wyraźnym zaakceptowaniu ceny przez Państwa.",
	noteLabel: "Dodatkowa wiadomość (opcjonalnie)",
	privacyNotice:
		"Podane informacje wykorzystujemy do przyjęcia i rozpatrzenia odstąpienia oraz do wykonania obowiązków prawnych. Szczegóły opisujemy w polityce prywatności.",
	reviewButton: "Sprawdź dane",
	reviewTitle: "Prosimy sprawdzić oświadczenie",
	declarationWhole: "Niniejszym odstępuję od wskazanej niżej umowy sprzedaży w całości.",
	declarationPartial:
		"Niniejszym odstępuję od wskazanej niżej umowy sprzedaży w zakresie wymienionych produktów i liczby sztuk.",
	finalExplanation:
		"Poniższym przyciskiem wysyłają Państwo oświadczenie o odstąpieniu od umowy. Nie jest to jedynie zapytanie do obsługi klienta.",
	editButton: "Zmień dane",
	submitButton: "Potwierdź odstąpienie",
	submitting: "Wysyłamy oświadczenie…",
	acceptedTitle: "Oświadczenie o odstąpieniu zostało przyjęte",
	acceptedBody:
		"Na podany adres e-mail wyślemy potwierdzenie z treścią oświadczenia oraz datą i godziną jego wysłania i otrzymania. O dalszym postępowaniu poinformujemy Państwa.",
	receiptNumberLabel: "Numer sprawy",
	submissionTimeLabel: "Data i godzina wysłania",
	receivedTimeLabel: "Data i godzina otrzymania",
	saveReceipt: "Zapisz potwierdzenie",
	emailIssue:
		"Oświadczenie zostało zapisane. Potwierdzenia nie udało się dotąd wysłać e-mailem. Ponawiamy próbę wysyłki. Potwierdzenie można też zapisać tutaj; odstąpienie pozostaje zarejestrowane jako otrzymane.",
	failedTitle: "Nie udało się przyjąć oświadczenia",
	failedBody:
		"Prosimy spróbować ponownie lub wysłać oświadczenie na info@maky.store. Wprowadzone dane pozostają w formularzu.",
	unknownTitle: "Nie udało się potwierdzić wyniku wysyłki",
	unknownBody:
		"Nie mogliśmy wiarygodnie ustalić, czy oświadczenie do nas dotarło. Prosimy sprawdzić wiadomość z potwierdzeniem lub stan sprawy. Przy ponownej próbie użyjemy tego samego identyfikatora, aby nie powstała podwójna sprawa. Odstąpienie można też wysłać na info@maky.store.",
	rateLimit:
		"Wysyłka jest chwilowo ograniczona. Prosimy spróbować później lub wysłać oświadczenie na info@maky.store.",
	unavailable:
		"Wysyłka online jest obecnie niedostępna. Oświadczenie można wysłać na info@maky.store lub pocztą. Pracujemy nad przywróceniem funkcji online.",
	noScript:
		"Funkcja interaktywna wymaga JavaScriptu. Oświadczenie można też wysłać na info@maky.store lub skorzystać z formularza do wydruku.",
};
