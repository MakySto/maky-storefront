# IT/FR — krátke zadanie

Sprievodca k `PRVY_PROMPT.txt`. Detaily balíka a overenia sú v `PREFLIGHT.md`; toto je
rozsah, vlastníctvo a brány na jednej strane.

## 1. Čo vlákno vlastní

**Vlastní:** talianske a francúzske telá siedmich statických právnych stránok, ich
metadáta (`h1` a `metaTitle` oddelene), tlačiteľný vzor odstúpenia na oboch trhoch,
jazykové testy a pripravené — nezapojené — texty Returns V2.

**Nevlastní:** CMS publikáciu O nás (M), Returns V2 kontrakt a jeho zapojenie (R),
katalóg, meny, dane, dopravu a Stripe (K), `<html lang>` a integračnú vetvu (M).

Minimálne spoločné zapojenie smie pripraviť v **samostatnom commite pre M**. Do cudzej
rozpracovanej vetvy nezapisuje nič.

## 2. Rozsah

|               |                                                                                      |
| ------------- | ------------------------------------------------------------------------------------ |
| Trhy          | `it` → `it-eur` / EUR / `it-IT`, `fr` → `fr-eur` / EUR / `fr-FR`                     |
| Stránky       | 8 na jazyk — 7 statických + O nás (CMS)                                              |
| Ďalšia routa  | `/odstupenie-od-zmluvy/vzorovy-formular` — **deviata**, nie náhrada O nás            |
| VOP / privacy | po 10 sekcií, neskracovať                                                            |
| Zdroj         | celý balík: `pages/`, `data/`, `formulare/`, `interne/` — nie iba `TEXTY_*_SPOLU.md` |

PL a HU nezdieľali prózu a mali samostatné exporty; IT a FR rovnako — **žiadny zdieľaný
komponent ako `german-market.tsx`**. Firemné údaje, adresy a tabuľkové komponenty sa
naopak zdieľajú a iba rozširujú.

## 3. Čo je pripravené a čo je pasca

**Pripravené:** `legalRoute` má voliteľné `heading` (commit `12e30e3`) — `<h1>` je
`heading ?? title`, `<title>` ostáva `title`, suffix dopĺňa `formatPageTitle`. Rovnaké
pravidlo je aj v samostatnej routе odstúpenia. Druhý helper sa nepíše.

**Pasca:** `it` je dnes negatívna fixtúra „trh bez schváleného textu“ a `fr` je v tom
istom zozname. Rola prešla `de` → `pl` → `it`. Po pridaní IT/FR musí prejsť na ďalší
skutočne nepokrytý trh. **Assertion sa nemaže** — zmazaná nechá štyri zelené testy
kontrolovať nič. Presné riadky sú v prompte.

## 4. Stavy namiesto prísľubov

Returns V2 prijíma na referenčnom SHA len `SK`/`sk`. Formulárové texty idú do kódu ako
**PREPARED a nezapojené**, so strážcom.

Tri stavy zostávajú oddelené: `previewNotActivated`, `active`, `temporarilyUnavailable`.
Telo, VOP, navigácia aj metadáta musia hovoriť o **tej istej reálnej capability** —
aktívnu prózu nasadiť až vtedy, keď trh naozaj vie prijať podanie a vyrobiť správny
záznam. Preview stav nie je právna náhrada funkcie.

Dve chyby, ktoré sa práve opravovali v PL/HU a nemajú sa zopakovať:

1. potvrdenie **nesmie sľubovať dva časy**, keď je doložený jeden — `receivedTimeLabel`
   smie zostať dormant, ale nevyplní sa kópiou `submittedAt`;
2. neistý výsledok **nesmie odkazovať na neexistujúci verejný „stav prípadu“**.

## 5. Francúzsko — dve neuzavreté položky

Formálna zhoda garančného boxu s **D211-2 / Annexe A** a doloženie skutočne príslušnej
**ADR cesty** vrátane povinných kontaktov sú integračné položky, nie certifikácia.
Členstvo MAKY vo francúzskej mediácii sa **nevymýšľa**. `rétractation`, `résolution`
a `résiliation` sa nezamieňajú a francúzsky 30-dňový limit nápravy sa neprepisuje
slovenskou výnimkou.

## 6. Brány

Validátor balíka → typecheck → lint → testy → parita kľúčov a premenných → reálny build
→ URL matica → 360 a 1280 px → regresia proti skutočnému základu.

Matica je **8 statických rout × práve podporované právne trhy** (so šiestimi doterajšími
plus IT/FR = 64 statických URL), O nás/CMS sa reportuje zvlášť, plus aspoň jeden
nepodporovaný trh ako negatívna kontrola.

Negatívny dôkaz sa robí cez **submit-capability**, nie počtom `<form>`: v hlavičke
a pätičke sú dva vyhľadávacie formuláre aj bez akéhokoľvek odstúpenia. Pri
`WITHDRAWAL_BACKEND_LIVE=true` musí zostať `sk` = 3 formy / 1 submit a ostatné trhy
2 / 0.

Staging beží len na schválenom env allowliste — **bez Stripe, bez HMAC, bez živých
podaní**. Build nikdy v `/opt/storefront`. Vlastné PID a worktree sa upratujú.

## 7. Odovzdanie

Presný base, HEAD, vetva, commity, zdrojové odchýlky, **vykonané vs nevykonané** testy
a závislosti s vlastníkom. Osem stavov sa reportuje oddelene a nezlučuje:

`CONTENT_PREPARED` · `CONTENT_REVIEWED` · `ROUTE_READY` · `CMS_PUBLISHED` ·
`BACKEND_READY` · `DEPLOYED` · `SELLABLE` · `INDEXABLE`

Noindex nie je blokácia nákupu. Počet offline kontrol nie je dôkaz o implementácii.
Produkčný SHA a BUILD_ID sa čítajú z `MAKY_DEPLOY_META`, nevymýšľajú sa.
