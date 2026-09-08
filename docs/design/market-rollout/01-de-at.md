# Vlákno 1 — `de` (Nemecko) a `at` (Rakúsko)

Najprv `00-univerzalne-zadanie.md`. Tento súbor iba dopĺňa.

| trh | kanál    | mena | locale | jazykový kód v mape             |
| --- | -------- | ---- | ------ | ------------------------------- |
| de  | `de-eur` | EUR  | de-DE  | `de`                            |
| at  | `at-eur` | EUR  | de-AT  | `de` **alebo** `deAt` — viď § 1 |

## 1. Jeden jazyk, dva trhy — a jedno rozhodnutie navyše

Dodaný balík volí **spoločnú nemčinu s vykaním „Sie"**, nie dva umelé preklady. To je
rozumné. Väčšina viet je zhodná.

Lenže mapa `APPROVED_COPY` priraďuje **trh → jazyk**, a telá dostávajú iba `channel`.
Máš dve možnosti a musíš si vybrať vedome:

- **A — jeden jazyk `de`, rozdiely vetvené vnútri tela podľa `channel`.** Menej
  súborov, ale vetvenie sa ľahko prehliadne a testy parity jazykov ho nevidia.
- **B — dva jazyky `de` a `deAt` so zdieľanými fragmentmi.** Viac kódu, ale rozdiel
  je viditeľný v type a test ho vynúti.

**Odporúčam B**, práve preto, že rozdiely tu nie sú kozmetické (§ 2). Spoločné odseky
vytiahni do zdieľaných komponentov v tom istom module, ako to robí `kontakt.tsx` pre
adresy.

## 2. DE a AT nie sú právne totožné

Toto je hlavná pasca tohto vlákna a dodaný balík na ňu správne upozorňuje.

- **Terminológia.** DE = _Widerrufsrecht_. AT = _Rücktrittsrecht_. Balík ponecháva
  tlačidlá jednotné („Vertrag widerrufen" / „Widerruf bestätigen") a v AT to vysvetľuje.
  Zachovaj to — tlačidlá sú viazané na kontrakt, nadpisy na jazyk krajiny.
- **Dátumy účinnosti.** Balík tvrdí, že rakúske novely majú inú účinnosť než slovenská
  (uvádza 27. 9. a 1. 10. 2026) a preto AT verziu **neoznačuje za totožnú s DE**.
  **Neunifikuj to.** Ak si dátum nevieš overiť, nechaj znenie z balíka a daj to do
  otvorených položiek.
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

## 4. Časový údaj v potvrdení — over, nepremenúvaj

Balík upozorňuje, že **§ 356a BGB** vyžaduje v potvrdení samotnú deklaráciu **a čas jej
prijatia**.

Overil som stav: `submittedAt` **generuje Payload pri uložení**, takže to **je** čas
prijatia — ale slovenský text ho volá „čas odoslania". Čiže:

- ✅ údaj existuje a má správny význam,
- ❌ opisuje sa nepravdivo.

**Nepremenúvaj pole ani nevyrábaj druhý čas v storefronte** (hodinám klienta sa nedá
veriť). Opíš existujúci údaj pravdivo. Ak DE/AT vyžaduje **oba** časy, je to zmena
kontraktu na strane Payloadu — nahlás ju, nerieš.

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
