# PL/HU — čo tento priečinok odovzdáva ďalším vláknam

Obsahové vlákno PL/HU je hotové a je v kóde. Tu leží to, čo **nepatrí do storefrontu**,
lebo to vlastní niekto iný.

---

## Najprv: pôvod obsahu, a čo z balíka na stroj kedy prišlo

**Balík existuje a vždy existoval.** Pri prvom preflighte 8. 9. večer nebol na tomto
stroji — `find` cez `/home/ubuntu`, `/tmp` a `/opt` vtedy našiel iba
`TEXTY_PL_SPOLU.md` a `TEXTY_HU_SPOLU.md`. To bol správny zdroj ôsmich stránok na trh
a implementovalo sa z neho; nebola to však náhrada za `formulare/`, `data/` a `interne/`.
Tvrdenie „balík neexistuje“ bolo pozorovanie o stroji, nie o balíku, a už neplatí.

**9. 9. dorazila poľská časť.** Prišla ako nemenné vstupy v `reference/` IT/FR balíka
(`/home/ubuntu/maky-podklady/2026-09-09/rozbalene-it-fr/MAKY_STORE_IT_FR/reference/`):
`ui.pl-PL.json`, `component-copy.pl-PL.json` a oba poľské e-maily. Podľa nich sa
`copy-pl.ts` prepísal **doslovne** — 21 z 38 reťazcov sa predtým líšilo — a doladili sa
poľské metadáta modelového formulára a routy odstúpenia. Dva z tých rozdielov boli vecné
chyby, nie synonymá; sú opísané v `HANDOFF_RETURNS_V2.md` § 2 a zastrážené testom.

**Čo na stroj stále neprišlo:**

| Chýba                                                | Dôsledok pre kód                                              |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `MAKY_PL_HU_REVIEW_A_OPRAVA_2026-09-09.zip`          | nečítal som `README_REVIEW.md` ani `EDITORIAL_OVERRIDES.json` |
| pôvodný PL/HU ZIP (SHA256 `1305692b…`)               | žiadny súbor na stroji ten hash nemá                          |
| `ui.hu-HU.json`, `component-copy.hu-HU.json`         | `copy-hu.ts` je naďalej moje znenie                           |
| maďarské e-maily                                     | HU e-maily neexistujú                                         |
| `formulare/vzor-odstupenia.{pl-PL,hu-HU}.{txt,html}` | vzory som skladal zo zákonných príloh                         |
| `formulare/pokyny-podla-zvozu.{pl-PL,hu-HU}.json`    | štyri stavy vratkovej dopravy nemám                           |

Overil som to hashom a hľadaním cez celý stroj, nie predpokladom o ceste.

### Poctivý pôvod toho, čo som skladal sám

Dve časti vznikli predtým, než dorazila poľská časť balíka, a **nie sú prekladom hotovej
prílohy**:

1. **Telá tlačiteľného vzoru odstúpenia.** Zložené zo zákonných vzorov — príloha č. 2
   k poľskej `ustawa o prawach konsumenta` a 2. melléklet k `45/2014. (II. 26.) Korm.
rendelet` — plus procesné polia a dve záverečné vety recenzovaného nemeckého vzoru.
   Sedem chránených prvkov (dobrovoľnosť, identifikácia nákupu, rozsah/položky/počty,
   dátum, podpis iba na papieri, nepovinný dôvod, IBAN) je overených v TXT aj
   v renderovanom tele, PL aj HU. Keď dorazí `formulare/vzor-odstupenia.*`, porovnaj
   a zosúlaď; do tej doby to nie je dôvod stránku nedržať — informačná povinnosť platí.
2. **`copy-hu.ts`.** Poľský náprotivok je už dodaný export; maďarský nie.

**Toto nie je zadanie objednať platenú revíziu rodeným hovoriacim.** Je to poznámka
o pôvode: kde dodaný text existuje, má prednosť pred mojím, a pri výmene sa nič nezapína,
lebo nič z toho nie je zapojené.

## Pre integračné vlákno (M) — `/o-nas`

`cmsPageRoute` má `isSlovakChannel()` na dvoch miestach, takže `/pl/o-nas` aj
`/hu/o-nas` sú dnes **404** — a `proxy.test.ts` to tvrdí ako zámer, nie ako defekt.
Podľa `00-univerzalne-zadanie.md` §3.5 treba **oboje**: rozšíriť bránu **a** publikovať
dokument v Payloade. Bootstrap v kóde nestačí a druhý autoritatívny zdroj v kóde vzniknúť
nesmie — preto je text tu ako súbor a nie ako komponent.

**Poľsko**

- `h1` — `O nas`
- `title` — `O nas – wyposażenie samochodu i podróży | MAKY.STORE`
- `description` — `Poznaj MAKY.STORE: bagażniki dachowe, boksy, uchwyty rowerowe i
akcesoria. Pomagamy dobrać wyposażenie do samochodu i planów na podróż.`
- **telo:** `o-nas.pl.md`

**Maďarsko**

- `h1` — `Rólunk`
- `title` — `Rólunk – felszerelés autóhoz és utazáshoz | MAKY.STORE`
- `description` — `Ismerje meg a MAKY.STORE-t: tetőcsomagtartók, tetőboxok,
kerékpárszállítók és autós kiegészítők. Segítünk az autójához és útjaihoz illő
választásban.`
- **telo:** `o-nas.hu.md`

`/<trh>/kontakt` v oboch súboroch nahraď `/pl/kontakt`, resp. `/hu/kontakt` — rovnako ako
pri DE/AT.

### H1 vs SEO titulok — hotové, v samostatnom commite

`legalRoute` niesol jeden reťazec pre `<title>` aj `<h1>`, lebo pre slovenčinu a češtinu
to naozaj jeden reťazec je. Dodané balíky ich dávajú oddelene a niekoľko stránok sa líši
(poľská doprava je `Dostawa i płatności` nad textom a `Dostawa i płatności – Polska`
v karte prehliadača).

`LegalCopy` má preto voliteľné `heading`; `<h1>` je `heading ?? title`, `<title>` sa
nemení. Je to **výstupne neutrálne z konštrukcie**, nie z kontroly: sk, cs, de a deAt
`heading` nemajú a test to drží. `heading` je nastavené len tam, kde sa dodaná kópia
naozaj líši; kde je rovnaká, tretie znenie sa nevymýšľa.

Rovnaké pravidlo dostala aj samostatná routa odstúpenia — jej `META` je teraz anotovaná
namiesto `as const`, lebo pod `as const` sa každá položka zúži na vlastný literálový tvar
a čítanie `META[locale].heading` padne na jazykoch, ktoré ho nemajú.

Je to samostatný commit, lebo sa dotýka zdieľanej továrne a nie je na ňom nič PL/HU.
`pages.pl-PL.json` na stroj neprišiel, takže hodnoty pochádzajú z riadkov `# H1`
a `**SEO title:**` v dodaných agregátoch, ktoré nesú oboje.

### A ešte jedna vec pre M, ktorá nie je moja

`src/app/layout.tsx:22` nastavuje `<html lang>` natvrdo na
`LOCALE_MAP[DEFAULT_LOCALE].htmlLang`, teda `sk`. Je to **koreňový** layout nad
`[channel]`, takže o trhu nevie. Dôsledok: `/cz`, `/de`, `/at`, `/pl` aj `/hu` servírujú
právne texty v cudzom jazyku pod `lang="sk"`. Overené aj na produkcii
(`https://maky.store/cz/kontakt` → `lang="sk"`), takže to **nie je** regresia tohto
vlákna a netýka sa to iba PL/HU.

Neopravil som to zámerne: v App Routeri smie `<html>` emitovať iba koreňový layout, takže
oprava je architektonická (presun stromu, alebo prenos locale do koreňa) a dotkla by sa
každej stránky. To je plocha M, nie prekladového vlákna.

---

## Pre vlákno Returns V2 (R)

Texty sú v kóde ako `src/lib/withdrawal/copy-pl.ts` a `copy-hu.ts` — typované, kompletné,
**nič ich neimportuje**. `copy-pl-hu.test.ts` to stráži.

**Celé odovzdanie pre teba je v `HANDOFF_RETURNS_V2.md`** v tomto priečinku: mapovanie
source → target, zachované premenné oboch e-mailových šablón, čo ešte nie je zapojené
a čo na stroj neprišlo.

⚠️ Reťazce formulára sú stále **priamo v JSX** vo `withdrawal-form.tsx`; zapojenie druhého
jazyka začína ich vytiahnutím do mapy. To je plocha R, preto som to neurobil.

### Maďarsko: online funkcia je konkrétna povinnosť s predpísanými popiskami

`45/2014. (II. 26.) Korm. rendelet § 22` predpisuje označenie oboch ovládacích prvkov:

| prvok      | text                     |
| ---------- | ------------------------ |
| vstup      | `Elállás a szerződéstől` |
| potvrdenie | `Elállás megerősítése`   |

Sú zapnuté testom. **Neprepisuj ich pre plynulosť** — je to compliance artefakt.
Nemecké dva popisky sú naopak viazané na kontrakt, nie na zákon; poľské sú bežná poľština.

### Poľsko: presná transpozícia je otvorená položka, nie záver

Dodané podklady **vedome neuzavreli**, ktoré publikované ustanovenie transponuje
povinnosť online funkcie a od kedy. Neznamená to, že v Poľsku e-mail vždy stačí. Je to
konkrétna otázka pre M/R pred povolením predaja, nie pre prekladové vlákno.

### ⚠️ Zapnutie funkcie si vyžiada REBUILD, nie iba reštart PM2

Nameral som to pri negatívnom teste. Keď sa buildne s vypnutým `WITHDRAWAL_BACKEND_LIVE`
a potom sa proces spustí so zapnutým:

| `/sk/odstupenie-od-zmluvy`  | výsledok                                                      |
| --------------------------- | ------------------------------------------------------------- |
| telo stránky                | formulár **sa vykreslí** (routa je dynamická, `connection()`) |
| `<meta name="description">` | stále znenie **`withoutForm`** — o formulári mlčí             |

Metadáta sa pod `cacheComponents` zapekajú do prerenderovaného shellu v čase buildu,
takže za env premennou ísť nevedia — presne to, čo o `noindex` hovorí komentár
v `proxy.test.ts`. Nie je to regresia tohto vlákna a **PL/HU sa to netýka** (tam sú oba
stavy konzistentné: formulár sa nevykreslí a metadáta ho ani nesľubujú). Je to však
pasca pre R: po zapnutí prepínača treba znovu buildnúť, inak bude SERP popis tvrdiť opak
toho, čo stránka robí.

❌ **Nikdy neposielaj PL/HU ako `market: "SK"`.** Vyrobilo by to právny záznam
s nepravdivým trhom. Dnes to nehrozí — bránu som overil pri oboch stavoch prepínača
(§ „Čo bolo overené“ v odovzdávke).

---

## Pre obchodné vlákno (K)

- **Maďarská kötelező jótállás** (`151/2003. (IX. 22.) Korm. rendelet`, termékköry podľa
  `10/2024. (VI. 28.) IM rendelet`): 10 000–250 000 Ft → 2 roky, nad 250 000 Ft → 3 roky.
  Text **netvrdí**, že do nej spadá celý sortiment — závisí od termékkör aj ceny.
  **Zatriedenie dotknutých produktov a dodanie jótállási jegy je úloha K**, nie textu.
- **HUF a desatinné miesta.** Texty o nich nesľubujú nič, zámerne. Formátovanie ceny je
  plocha K.
- **Suma priamych nákladov na vrátenie nadrozmerného tovaru** naďalej chýba a je to
  **predzmluvná** povinnosť. Neodhadoval som ju ani pre PL/HU.

---

## Čo tu zámerne NIE JE

- Zoznam zmluvných subjektov poskytovateľov a mechanizmy prenosov mimo EHP — zmluvné
  fakty, ktoré repozitár nevie overiť. Stránky odkazujú na `info@maky.store`.
- Obsah GTM kontajnera — nastavenie v GTM, nie v kóde.
- Akákoľvek zmena `MAKY_LIVE_MARKETS`, `WITHDRAWAL_BACKEND_LIVE`, Saleoru, Stripe,
  cien alebo dopravy.
