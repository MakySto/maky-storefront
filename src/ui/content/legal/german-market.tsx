import { type ReactNode } from "react";

/**
 * What actually differs between the German and the Austrian legal copy.
 *
 * The two markets share one German text. They do not share one law, and this file is
 * the list of every place where that matters — kept in one object so a reviewer can see
 * the whole difference at once instead of diffing seven pairs of page bodies.
 *
 * Everything absent from here is genuinely identical and lives in the shared body
 * components, which take a `GermanMarket` and render the right variant. That is the
 * point of splitting `de` and `deAt` in `LEGAL_LOCALES`: the differences below are
 * values the compiler tracks, not `channel` comparisons buried inside prose.
 *
 * Sources for each entry are recorded in
 * `docs/design/market-rollout/01-de-at.md` and in the delivered package's
 * `interne/PRAVNE_ROZDIELY_A_ZDROJE.md`. Do not "normalise" one market to the other.
 */
export interface GermanMarket {
	/** `Deutschland` / `Österreich`. Used in prose, never to pick a currency or route. */
	readonly countryName: string;

	/**
	 * What the right to withdraw is called locally.
	 *
	 * Germany: *Widerrufsrecht*. Austria: *Rücktrittsrecht* (FAGG). Used for headings and
	 * link text. The two form controls stay `Vertrag widerrufen` / `Widerruf bestätigen`
	 * in BOTH markets, because those are bound to the Returns V2 contract rather than to
	 * the local vocabulary — Austria explains the mismatch in prose instead.
	 */
	readonly withdrawalTerm: string;

	/** The mandatory-consumer-law carve-out under Art. 6 Rome I, in local terms. */
	readonly mandatoryLawSentence: string;

	/** The ePrivacy rule governing access to a terminal device. Different statutes. */
	readonly ePrivacyStatute: string;

	/** The local data-protection authority, and how to reach it. */
	readonly dataProtectionAuthority: ReactNode;

	/** The ECC-Net body for cross-border help, as a link. */
	readonly consumerCentre: ReactNode;

	/**
	 * Austria only: one sentence reconciling the Austrian *Rücktritt* with the *Widerruf*
	 * wording used by the controls. `null` for Germany, where there is nothing to
	 * reconcile.
	 *
	 * ⚠️ Deliberately phrased so it is true whether or not the online function runs. The
	 * delivered package worded it "Für die Online-Funktion verwenden wir die eindeutigen
	 * Bezeichnungen …", which asserts in the present tense that a function exists — and on
	 * `at` it does not (Returns V2 accepts `SK` only). That wording belongs to the release
	 * that switches the function on; it is kept as `terminologyNoteWhenFormLive` below so
	 * it is not lost, and swapped in at the same time as the form.
	 */
	readonly terminologyNote: string | null;

	/**
	 * The Austrian terminology note for when the online function IS served.
	 *
	 * Not rendered anywhere today. Wire it in the same change that makes
	 * `servesOnlineFunction()` true for `at`, and not before — it names controls the
	 * customer would not be able to find.
	 */
	readonly terminologyNoteWhenFormLive: string | null;
}

export const GERMANY: GermanMarket = {
	countryName: "Deutschland",
	withdrawalTerm: "Widerrufsrecht",
	mandatoryLawSentence:
		"Zwingende deutsche Verbraucherschutzvorschriften, insbesondere zu Mängelrechten und Verjährung, bleiben unter den Voraussetzungen von Artikel 6 der Rom-I-Verordnung unberührt. Die hier beschriebenen günstigeren Rechte werden dadurch nicht verkürzt.",
	ePrivacyStatute: "§ 25 TDDDG",
	dataProtectionAuthority: (
		<>
			In Deutschland können Sie sich insbesondere an die Datenschutzaufsichtsbehörde Ihres Bundeslandes
			wenden. Eine{" "}
			<a
				href="https://www.lda.brandenburg.de/lda/de/datenschutz/zustaendigkeiten/datenschutzaufsichtsbehoerden-in-bund-und-laendern/"
				rel="noopener noreferrer"
				target="_blank"
			>
				Übersicht der Datenschutzaufsichtsbehörden des Bundes und der Länder
			</a>{" "}
			hilft Ihnen, die zuständige Stelle zu finden. Welche Behörde zuständig ist, richtet sich nach dem
			konkreten Sachverhalt.
		</>
	),
	consumerCentre: (
		<>
			Bei einem grenzüberschreitenden Kauf von Deutschland aus kann Sie das{" "}
			<a href="https://www.evz.de/fragen-beschwerden/" rel="noopener noreferrer" target="_blank">
				Europäische Verbraucherzentrum Deutschland
			</a>{" "}
			beraten und bei einer außergerichtlichen Lösung unterstützen. Diese Unterstützung ersetzt weder ein
			zuständiges Streitbeilegungsverfahren noch den Rechtsweg.
		</>
	),
	terminologyNote: null,
	terminologyNoteWhenFormLive: null,
};

export const AUSTRIA: GermanMarket = {
	countryName: "Österreich",
	withdrawalTerm: "Rücktrittsrecht",
	mandatoryLawSentence:
		"Zwingende österreichische Verbraucherschutzvorschriften, insbesondere aus dem Verbrauchergewährleistungsgesetz und dem Konsumentenschutzgesetz, bleiben unter den Voraussetzungen von Artikel 6 der Rom-I-Verordnung unberührt. Die hier beschriebenen günstigeren Rechte werden dadurch nicht verkürzt.",
	ePrivacyStatute: "§ 165 Absatz 3 TKG 2021",
	dataProtectionAuthority: (
		<>
			In Österreich können Sie sich an die <strong>Österreichische Datenschutzbehörde</strong>, Barichgasse
			40–42, 1030 Wien, wenden. E-Mail: <a href="mailto:dsb@dsb.gv.at">dsb@dsb.gv.at</a>. Informationen zur
			Beschwerde finden Sie auf{" "}
			<a href="https://dsb.gv.at/eingabe-an-die-dsb/beschwerde" rel="noopener noreferrer" target="_blank">
				dsb.gv.at
			</a>
			.
		</>
	),
	consumerCentre: (
		<>
			Bei einem grenzüberschreitenden Kauf von Österreich aus kann Sie das{" "}
			<a href="https://europakonsument.at/" rel="noopener noreferrer" target="_blank">
				Europäische Verbraucherzentrum Österreich
			</a>{" "}
			beraten und bei einer außergerichtlichen Lösung unterstützen. Diese Unterstützung ersetzt weder ein
			zuständiges Streitbeilegungsverfahren noch den Rechtsweg.
		</>
	),
	terminologyNote:
		"In Österreich wird dieses Recht als Rücktrittsrecht bezeichnet. Wo in diesen Texten und in unseren Formularen die Bezeichnungen „Vertrag widerrufen“ und „Widerruf bestätigen“ erscheinen, ist dasselbe Recht gemeint.",
	terminologyNoteWhenFormLive:
		"In Österreich wird dieses Recht als Rücktrittsrecht bezeichnet. Für die Online-Funktion verwenden wir die eindeutigen Bezeichnungen „Vertrag widerrufen“ und „Widerruf bestätigen“.",
};

/** The country line for a German-language postal address block. */
export const SLOVAKIA_DE = "Slowakei";
