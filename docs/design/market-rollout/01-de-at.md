# Vlákno 1 — `de` (Nemecko) a `at` (Rakúsko)

Najprv `00-univerzalne-zadanie.md`. Tento súbor iba dopĺňa.

| trh | kanál    | mena | locale | jazykový kód v mape |
| --- | -------- | ---- | ------ | ------------------- |
| de  | `de-eur` | EUR  | de-DE  | `de`                |
| at  | `at-eur` | EUR  | de-AT  | `deAt`              |

## 1. Jeden jazyk, dva trhy — rozhodnuté: variant B

Dodaný balík volí **spoločnú nemčinu s vykaním „Sie"**, nie dva umelé preklady. To je
rozumné. Väčšina viet je zhodná.

Lenže mapa `APPROVED_COPY` priraďuje **trh → jazyk**, a telá dostávajú iba `channel`.
Boli dve možnosti:

- **A — jeden jazyk `de`, rozdiely vetvené vnútri tela podľa `channel`.** Menej
  súborov, ale vetvenie sa ľahko prehliadne a testy parity jazykov ho nevidia.
- **B — dva jazyky `de` a `deAt` so zdieľanými fragmentmi.** Viac kódu, ale rozdiel
  je viditeľný v type a test ho vynúti.

✅ **Implementované ako B** (2026-09-08), práve preto, že rozdiely tu nie sú kozmetické
(§ 2). Zákaznícke locale sa nemenia — `CHANNEL_MAP` naďalej hovorí `de-DE` a `de-AT`;
`deAt` je interný názov právneho textu.

Všetko, čím sa tie dva trhy naozaj líšia, je v **jednom objekte**:
`src/ui/content/legal/german-market.tsx` (`GERMANY` / `AUSTRIA`). Recenzent tak vidí celý
rozdiel na jednom mieste namiesto diffovania siedmich párov tiel. Zdieľané odseky sú
v komponente `German` v každom module, ako to robí `kontakt.tsx` pre adresy.

## 2. DE a AT nie sú právne totožné

Toto je hlavná pasca tohto vlákna a dodaný balík na ňu správne upozorňuje.

- **Terminológia.** DE = _Widerrufsrecht_. AT = _Rücktrittsrecht_. Balík ponecháva
  tlačidlá jednotné („Vertrag widerrufen" / „Widerruf bestätigen") a v AT to vysvetľuje.
  Zachovaj to — tlačidlá sú viazané na kontrakt, nadpisy na jazyk krajiny.
- **Dátumy účinnosti — overené, už to nie je otvorená položka.** Rakúske novely majú inú
  účinnosť než nemecké aj než slovenská. **Neunifikuj to.** Overené v oficiálnom RIS
  2026-09-08:

  | Predpis                                                                                                                                                   | Účinnosť        | Vzťahuje sa na zmluvy   |
  | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------- |
  | **FAGG § 20 ods. 6** — informačné povinnosti (§ 3 Z 16–20, § 4 ods. 1, § 8 ods. 1, prílohy II a III)                                                      | **27. 9. 2026** | uzavreté po 26. 9. 2026 |
  | **FAGG § 20 ods. 5** — online funkcia odstúpenia **§ 13a**, §§ 18a–18d, príloha I                                                                         | **1. 10. 2026** | uzavreté po 30. 9. 2026 |
  | **VGG § 29 ods. 4** — Warenreparaturrichtlinie-Umsetzungsgesetz, BGBl. I Nr. 60/2026 (§ 6 ods. 2 Z 5, § 10 ods. 2a, § 12 ods. 2a, § 13 ods. 1a a 2, § 31) | **1. 10. 2026** | uzavreté po 30. 9. 2026 |

  Zdroje: `ris.bka.gv.at` — FAGG `Gesetzesnummer=20008847&Paragraf=20`, VGG
  `Gesetzesnummer=20011654&Paragraf=29`. Nemecký § 356a BGB je účinný od 19. 6. 2026 —
  **nepriraďuj rakúskej novele nemecký dátum** len podľa transpozičnej lehoty smernice.

  ⚠️ Neskoršia rakúska účinnosť **nie je** dôvod, prečo by slovenský predajca mohol na AT
  predávať bez dokončenia príslušných povinností. Voľba slovenského práva zostáva
  východiskom a kogentné rakúske pravidlá sa ňou nevypínajú.

- **ePrivacy pre cookies.** Balík uvádza **§ 25 TDDDG** pre DE a **§ 165 ods. 3
  TKG 2021** pre AT. Sú to rôzne predpisy — neprenášaj jeden do druhého.
- **Úrad na ochranu údajov.** DE je federálne členité — balík správne odkazuje na
  **krajinské úrady**, nie na jediný spolkový. AT má **Österreichische
  Datenschutzbehörde**. Slovenský ÚOOÚ zostáva ako úrad predajcu.
- **Cezhraničná podpora.** Balík uvádza EVZ Deutschland / EVZ Österreich.

## 3. Nekopíruj 35 kg

Balík ju zámerne nevložil. Zisti skutočné metódy `de-eur` a `at-eur` (§ 8 univerzálneho
zadania). Ak metódy nemenujú dopravcu, netvrď „FedEx a Slovenská pošta" bez potvrdenia —
hoci balík to tak uvádza a **je to tvoj skutočný dopravca podľa CLAUDE.md §9**, over,
či pre DE/AT platí to isté.

## 4. Časový údaj v potvrdení — dva trhy, dve rôzne udalosti

**§ 356a ods. 4 BGB** žiada, aby potvrdenie obsahovalo obsah vyhlásenia **a dátum a čas
jeho prijatia** („das Datum und die Uhrzeit ihres Eingangs"). Ods. 3 je niečo iné —
potvrdzovací krok, teda tlačidlo „Widerruf bestätigen".
_(Overené na `dejure.org/gesetze/BGB/356a.html`, 2026-09-08; `gesetze-im-internet.de` je
z tohto stroja nedostupný.)_

⚠️ **Skoršie znenie tohto odseku bolo nesprávne** a tvrdilo, že `submittedAt` „**je** čas
prijatia, len sa nepravdivo opisuje". Nie je. `submittedAt` generuje Payload pri
**uložení záznamu** — to je čas zápisu. Blíži sa prijatiu, ale nie je s ním totožný.
Slovenský § 20a ods. 5 zákona 108/2024 žiada čas **odoslania**, čo je zase iná udalosť;
či ju čas zápisu dostatočne zastupuje, je otázka pre Returns V2, nie pre prekladové
vlákno. Slovenské znenie teda nechávame tak, ako je schválené.

Takže:

- ✅ slovenské znenie je pre SK správne — **neprepisuj ho**,
- ❌ pre DE chýba samostatný, dôveryhodný čas **prijatia**.

**Nepremenúvaj existujúce pole a nevyrábaj druhý čas v storefronte** — hodinám klienta sa
veriť nedá. Je to serverová zmena kontraktu a vlastní ju vlákno **Returns V2**. Nemecké
znenie oboch údajov je pripravené v `src/lib/withdrawal/copy-de.ts`
(`submissionTimeLabel`, `receivedTimeLabel`) a v e-mailových šablónach v
`docs/design/market-rollout/de-at/`.

## 5. Formulár odstúpenia — dočasne nie, ale je to blokátor spustenia

Kontrakt Returns V2 je zamknutý na `market: "SK"` (§ 6 univerzálneho zadania), takže
podanie z `/de` alebo `/at` by Payload odmietol. **Tvoje vlákno formulár nezapína.**

⚠️ **Nie je to však prijateľný konečný stav pre DE.** Nemecký **§ 356a BGB** online
funkciu odstúpenia priamo predpokladá a upravuje aj obsah potvrdenia. Kým ju backend
nevie prijať, **DE sa nedá spustiť do predaja** — nie je to len chýbajúca vymoženosť.

Rozšírenie kontraktu vlastní vlákno **Returns V2** (`06-returns-v2.md`). Ty naň
**nečakáš**:

- dodaj nemecké texty formulára, potvrdení a chybových stavov z balíka, aby boli
  pripravené na zapojenie;
- značky `[[WITHDRAWAL_ONLINE_SECTION]]` a `[[WITHDRAWAL_TERMS_FUNCTION]]` **nevymaž
  aj s okolitými vetami** — okolie nesmie sľubovať funkciu, ktorá zatiaľ nebeží;
- do odovzdávky napíš, že DE čaká na Returns V2, a označ to ako blokátor **predaja**,
  nie obsahu.

❌ Nikdy nepodávaj DE/AT ako `market: "SK"`.

## 6. `/o-nas`

Balík má nemecké „Über uns". Podľa § 3.5 univerzálneho zadania treba **aj** rozšíriť
`cmsPageRoute`, **aj** publikovať dokument v Payloade. Ak dokument nie je, nechaj
`o-nas` mimo DE/AT a napíš to do odovzdávky.

## 7. Kontrola pred odovzdaním

Nad rámec § 9 univerzálneho zadania:

- žiadna `[[…]]` značka v `src/`,
- 16 stránok (8 × 2 trhy) s HTTP kódom v správe,
- `sk` a `cz` nedotknuté — `git diff --stat` nesmie ukázať slovenské ani české telá,
- v `company.test.ts` doplň nemeckú negáciu tvrdenia o DPH.
