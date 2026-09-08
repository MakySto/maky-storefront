# PL/HU — čo tento priečinok odovzdáva ďalším vláknam

Obsahové vlákno PL/HU je hotové a je v kóde. Tu leží to, čo **nepatrí do storefrontu**,
lebo to vlastní niekto iný.

---

## ⚠️ Najprv: čo z ohláseného balíka na stroj naozaj prišlo

Zadanie sľubovalo ZIP `MAKY_STORE_PL_HU_preklad_a_implementacia_2026-09-08.zip` so 60
súbormi — `interne/`, `formulare/`, `data/*.json`, `scripts/validate_bundle.py`,
`HANDOFF_PRE_CLAUDE_CODE_PL_HU.md`. **Ten ZIP na stroji nie je** a nikdy tam nebol;
`/home/ubuntu/maky-podklady/2026-09-08/` obsahuje iba starší handoff ZIP a rozbalené
`DE_AT/`. Overené `find`-om cez `/home/ubuntu`, `/tmp` aj `/opt`.

Čo Marek nahral (a čo v poslednej vete promptu aj sám označil za zdroj prekladov):

| Súbor                                          | Veľkosť  | Čo obsahuje                         |
| ---------------------------------------------- | -------- | ----------------------------------- |
| `/home/ubuntu/maky-podklady/TEXTY_PL_SPOLU.md` | 63 741 B | 8 poľských stránok, H1 + SEO + telá |
| `/home/ubuntu/maky-podklady/TEXTY_HU_SPOLU.md` | 70 925 B | 8 maďarských stránok, to isté       |

To je **vecné jadro balíka** a stačilo na celý obsah siedmich statických stránok aj na
O nás. Preto som nič neblokoval a implementoval som z toho.

**Čo z toho nevyplynulo a čo som teda musel zložiť sám** (a čo treba dať prečítať
rodenému hovoriacemu, kým sa zapne predaj):

1. **Telá tlačiteľného vzoru odstúpenia** (`vzorovy-formular`). Dodané dokumenty naň
   odkazujú, ale neobsahujú ho. Zložené zo zákonných vzorov — príloha č. 2 k poľskej
   `ustawa o prawach konsumenta` a 2. melléklet k `45/2014. (II. 26.) Korm. rendelet` —
   plus tie isté procesné polia a dve záverečné vety, ktoré už nesie recenzovaný nemecký
   vzor.
2. **Texty formulára Returns V2** (`src/lib/withdrawal/copy-pl.ts`, `copy-hu.ts`).
   Preložené zo schválenej slovenčiny a z nemčiny. Výnimkou sú dve maďarské označenia
   ovládacích prvkov, ktoré predpisuje § 22 — tie nie sú prekladateľskou voľbou.

Nič z toho **nie je** dôvod nenasadiť obsah; je to dôvod na jazykovú revíziu pred
spustením online funkcie.

---

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
