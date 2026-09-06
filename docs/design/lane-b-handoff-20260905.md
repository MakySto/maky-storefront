# Vlákno B — odovzdanie (2026-09-05, po B2 oprave)

> **Historický dokument (stav po B2 oprave, 2026-09-05 ráno).** Aktuálny stav je v
> `lane-b-handoff-20260906.md`; „spätné čítanie košíka" v §2/§5/§7 nižšie už neplatí — cart
> ide cez typovaný `addVariantToCart` vlákna A. Uzavreté rozhodnutia a §6 pre CFM platia.

Vetva: `claude/sf-b-vehicles`, odbočená z Legal `a4d78cb`. S1 nemergované. Branch-only,
nič nasadené, produkcia nedotknutá.

---

## 1. Stav

```
GUEST_GARAGE_FUNCTIONAL         = YES   [FIXTURE]
CONFIGURATOR_FUNCTIONAL         = YES   [FIXTURE]
PRODUCT_APPLICATIONS_FUNCTIONAL = YES   [FIXTURE]
PROVIDER_CONNECTED              = NO
REAL_SNAPSHOT                   = NO    (čaká sa CFM, viď §6)
LIVE_OFFER                      = NO    (žiadny reálny fitment ⇒ žiadna reálna ponuka)
ACCOUNT_SYNC_IMPLEMENTED        = NO
PUBLIC_ACTIVATION_PERFORMED     = NO
```

**Nič v konfigurátore dnes nespája reálny produkt s vymyslenou kompatibilitou.** To bola
podstata výhrady a je to opravené na úrovni dát aj kódu.

---

## 2. Čo bolo zlé a čo sa zmenilo

Diagnóza z revízie bola presná vo všetkých bodoch. Overil som každý z nich vo vlastnom
kóde predtým, než som ho opravoval.

| defekt                                                                                                                                                                                          | oprava                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture mapovala vymyslené fitment riadky na **reálne Saleor ID** → skutočný strešný box a nosič lyží dostali vymyslený štítok „kompletná zostava", vymyslenú nosnosť a vymyslenú kompatibilitu | Demo dataset je **sebestačný**: syntetické ID vozidiel **aj vlastný katalóg**, inštancia `demo.invalid`. Offer vrstva ho obslúži **bez jediného dotazu na Saleor**, takže si nemá odkiaľ požičať názov, fotku ani cenu.                                                                                                           |
| `completeSet.includes` stačilo na štítok „kompletná zostava"                                                                                                                                    | **`productKind` je povinný**, pochádza zo zdroja a vynucuje sa **na dvoch nezávislých vrstvách** (resolver aj offers). Do konfigurátora vstupuje iba `roof-rack-set`.                                                                                                                                                             |
| Obsah sady sa dopĺňal šablónou „priečniky + pätky + kit"                                                                                                                                        | Obsah je per-sada zo zdroja. Prázdny `includes` validátor odmietne; chýbajúci sa nezobrazí. Fixpoint systém bez kitu už nedostane kit.                                                                                                                                                                                            |
| `externalReference` sa iba prebral z fitment riadku                                                                                                                                             | Pri reálnych dátach sa **overuje voči produktu, ktorý sa vrátil**. Nesúlad = `identity-mismatch`, produkt sa neponúkne.                                                                                                                                                                                                           |
| `collectFittingProducts()` púšťalo `UNKNOWN`; offers nekontrolovalo `verificationStatus`                                                                                                        | Ponúka sa **iba `VERIFIED_FIT`**. Provisional, year-hold, stale a konflikt sa vysvetlia, nepredávajú.                                                                                                                                                                                                                             |
| Globálny resolver spájal riadky rôznych produktov → „sada A pasuje, sada B nie" = `AMBIGUOUS` a **neponúklo sa nič**                                                                            | Každý kandidát sa rieši **na vlastnej identite pred agregáciou**. Doložené testom aj v prehliadači: pri jednom negatívnom a jednom year-hold zázname sa **ponúknu 3 sady**, ktoré pasujú.                                                                                                                                         |
| `completeForMakeIds` bez rozsahu → „nič na vašu Škodu nepasuje"                                                                                                                                 | `coverage.scope.programId` je povinný. „Kompletné pre Škodu" platí **v rámci programu**, nie pre celý obchod.                                                                                                                                                                                                                     |
| `ConditionList` čítal iba hardcoded mapu kódov, `condition.text[locale]` **ignoroval** → montážne obmedzenie ticho zmizlo a zelený štítok zostal                                                | Poradie: **zdrojový text pre locale → známy kód → nedostupné**. Nedostupná podmienka **zníži verdikt na „Overené s podmienkami"**, nezmizne. Nie je to `NO_FIT` — chýbajúci preklad nie je dôkaz nekompatibility. `de-AT` číta `de-DE`; **na cudzí trh sa nikdy nepustí slovenský text**. Deduplikuje sa podľa kódu **aj textu**. |
| `addConfiguredSetToCart` vracalo `ok:true` po `void` akcii                                                                                                                                      | Znovu načíta **aktívne vozidlo**, znovu vyrieši **fitment pre ten konkrétny produkt**, overí variant, pri demo dátach **serverovo odmietne**, a potom **prečíta košík späť** a potvrdí, že riadok pribudol. Nečitateľný košík = `lookup-failed`, **žiadny slepý retry**.                                                          |
| `quantityAvailable < 1` ako vlastná interpretácia skladu                                                                                                                                        | Používa sa kanonický `resolveAvailability`. Katalóg je sale-to-order: `trackInventory` je false a Saleor vracia **syntetický strop 50** pre každý variant (overené naživo).                                                                                                                                                       |
| Cena padala na `priceRange.start`                                                                                                                                                               | Cena **výhradne z konkrétneho variantu**, inak sa nezobrazí.                                                                                                                                                                                                                                                                      |
| Všetky chyby → „outOfStock"                                                                                                                                                                     | Sedem rozlíšených stavov: `simulation`, `provider-unavailable`, `vehicle-changed`, `not-verified`, `not-available`, `out-of-stock`, `cart-rejected`, `lookup-failed`.                                                                                                                                                             |
| Horný zelený panel tvrdil „Táto zostava je overená" nad zoznamom, kde ešte nič nebolo vybrané; prázdny zoznam hlásil „Tento produkt nepasuje"                                                   | Hore je **iba zhrnutie vozidla** (auto, rok, karoséria, strecha, Zmeniť vozidlo, Moja garáž). Verdikt a podmienky sú **na karte konkrétnej sady**. Prázdny stav má **päť rôznych správ**.                                                                                                                                         |
| `FitmentProductsByIds.graphql` bez `$lang`                                                                                                                                                      | Doplnené `translation` pre názov a kategóriu. Lookup ostáva podľa **ID**, takže sa nemôže zopakovať `slugLanguageCode` zlyhanie.                                                                                                                                                                                                  |
| HTTP provider `cache: no-store`                                                                                                                                                                 | Zdieľané načítanie s `revalidate` + React `cache()` pre dedup v rámci renderu. Dataset neobsahuje nič zákaznícke.                                                                                                                                                                                                                 |

---

## 3. Bezpečnostný interlock

Demo dáta sa **nedajú kúpiť**, a nie preto, že je tlačidlo zakázané:

```
addConfiguredSetToCart({ demo set })                      → { ok:false, reason:"simulation" }
addConfiguredSetToCart({ REAL Saleor id, demo provider }) → { ok:false, reason:"simulation" }
```

Odmietnutie nastáva **pred** čítaním cookie a **pred** prípravou akejkoľvek mutácie, a
rozhoduje o ňom **dataset, nie request**. Testy volajú akciu priamo, mimo UI — preto
nepotrebujú sieťový mock: z demo dát do živého košíka **neexistuje cesta**.

Režim sa nedá zvoliť z klienta. `MAKY_FITMENT_PROVIDER` je server-only a **nenastavený
znamená vypnuté** — bez neho niet datasetu, každý verdikt je „nevieme overiť" a nič nemôže
tvrdiť, že niečo pasuje.

---

## 4. Overené stavy (produkčný build, `next start`)

| scenár                                   | výsledok                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| A pasuje + B negatívna + C year-hold     | **3 zostavy ponúknuté**, B aj C vylúčené                         |
| iba provisional (Kodiaq)                 | „nemáme overenú sadu" — **nie** NO_FIT                           |
| overené, ale nie je v katalógu (BMW)     | „existujú, ale nie sú v predaji. Neznamená to, že nič nepasuje." |
| iba konflikt (Tiguan)                    | „nemáme overenú sadu"                                            |
| nič                                      | „nemáme v ponuke žiadnu zostavu"                                 |
| strešný box s overeným riadkom           | **vylúčený na oboch vrstvách**                                   |
| podmienka bez prekladu                   | karta „Overené s podmienkami" + výzva kontaktovať nás            |
| podvrhnutá / junk / `%` / prázdna cookie | 200, prázdna garáž, **nikdy 500**                                |

Žiadny reálny názov produktu (`Northline`, `Nordrive`, `Peruzzo`, `Thule`) sa v demo
režime v DOM nevyskytuje. Overené automaticky.

---

## 5. Integračné body pre vlákno A

Nezmenené oproti predchádzajúcemu odovzdaniu, okrem prop-ov:

- **Header** `header-nav-row.tsx:48` → `<VehicleSelectorLauncher variant="header" vehicleLabel={label} />`
  (chip je **súrodenec** Suspense na r. 45-47 → potrebuje vlastný async child s `connection()`
  a skeleton **pevnej šírky**, `layout.tsx:87` rezervuje `h-12`).
- **Hero** `hero-section.tsx:25-31` → `variant="hero"` (zmizne aj `bg-amber-500`).
- **PDP CompatibilityBox** — teraz vyžaduje `locale` a `isDemo`. ⚠️ Miesto je **vnútri
  `<form action={addToCart}>`**; `SheetTrigger` je bezpečný, `<Button>` nie.
- **PDP ProductVehicleApplications** — `listProductApplications(product.id)` na serveri.
- **PLP** — `collections/[slug]/page.tsx:181` je **tretie** call site `buildFilterVariables`.
  ⚠️ **Vehicle filter cez Saleor atribúty nezapájaj**: všetkých 8 slugov v Saleore
  neexistuje a filter na neexistujúci atribút vracia `totalCount: 0`, nie chybu.
- **Spoločná add-to-cart výsledková cesta**: keď ju A dodá, `cart-actions.ts` na ňu prejde.
  Dovtedy potvrdzujem pridanie **spätným čítaním košíka** — nedotýkam sa zdieľaného
  checkoutu.

---

## 6. Pre CFM

Kontrakt je `schemaVersion 2.0.0` (breaking). Potrebujeme **reprezentatívny read-only
snapshot ~10–20 skutočných Nordrive aplikácií**, dostupný zo storefront prostredia
schválenou cestou. **Hidden produkty kvôli tomu nepublikujte.**

Každý produktový odkaz musí niesť:

```
externalReference        cfm:product:…   (živý formát je cfm:product:CFMP-TAZ-<sku>-X-<hash>)
saleorProductId          instance-bound
saleorVariantId          konkrétny variant, nikdy odvodený
productKind              roof-rack-set | roof-box | ski-carrier | … — POVINNÉ
completeSet.includes     skutočný obsah TEJTO sady, nie šablóna
facets                   normalizované; nosnosť je bezpečnostné číslo, nikdy nedopĺňaná
conditions[].text        per-locale schválený text (bez neho verdikt klesne na „s podmienkami")
```

Plus `coverage.scope.programId` — bez rozsahu nemá tvrdenie o úplnom pokrytí význam.

**Dve opravy predchádzajúceho CFM odovzdania:**

1. **Plošná typová migrácia 39 PLAIN_TEXT atribútov NIE JE potrebná.** Merané:
   `where:{attributes:[{slug:"material", value:{name:{eq:"ABS plast"}}}]}` → **21**;
   legacy `filter:{attributes:[{slug,values:[…]}]}` → **0**. Legacy cesta zlyháva tak, že
   vráti nulu namiesto chyby — preto to vyzeralo ako nemožné. ⚠️ `eq` je
   case-sensitive a katalóg už obsahuje varianty tej istej hodnoty
   (`rýchloupínací systém` vs `Rýchloupínací systém`, 9 + 9). Hodnoty treba
   normalizovať. `filter` a `where` sa v jednej query nemiešajú.
2. **`metafield("cfm_availability_mode")` je na produktoch `null`.** Storefront preto
   nevie povedať „Na objednávku" a `resolveAvailability` správne nezobrazí nič.
   `quantityAvailable` je syntetický strop 50 a nesmie sa čítať ako sklad.

---

## 7. Známé obmedzenia

- **Fitment dáta sú vymyslené.** Provider je defaultne vypnutý, demo je označené v UI a
  serverovo nekúpiteľné. `PROVIDER_CONNECTED = NO` je pravdivé.
- **`addListingItemToCart` stále neinšpektuje `checkoutLinesAdd.errors`.** Obchádzam to
  spätným čítaním košíka; správna oprava je typovaná výsledková cesta a patrí A (§10
  zakazuje prepisovať cart). Do tej doby je moje potvrdenie post-condition, nie odpoveď
  mutácie — rozdiel je zapísaný v kóde.
- **Viacriadkové zostavy nejdú** a v1 ich nepotrebuje (jedna sada = jeden variant).
- **Boxy a nosiče lyží** ostávajú v bežnom katalógu nedotknuté. Ako odporúčané
  príslušenstvo k vybranej sade sú samostatná neskoršia etapa; kontrakt už rozlišuje typ,
  takže sa to nebude prerábať.
- **Anonymný rate-limit na server actions nie je.** Selector actions sú read-only.
- **Lokalizované route slugy** (`/konfigurator` je slovenské slovo vo všetkých trhoch) sú
  otvorená otázka pre vlastníka tvaru URL.

---

## 8. Pasca, ktorú stojí za to zapísať

Inštančný guard datasetu som napísal správne — a **vypol ním demo**. Demo dataset zámerne
nesie `demo.invalid`, guard ho odmietol, provider vrátil nič a konfigurátor hlásil
„najprv vyberte vozidlo" pri vozidle, ktoré bolo vybrané.

`next build` prešiel. **Všetkých 109 testov prešlo.** Funkcia bola vypnutá. Testy to
neodhalili, lebo validátor volali bez očakávanej inštancie — teda presne bez toho
argumentu, ktorý dodáva produkcia.

Chytila to až kontrola v prehliadači. Preto je akceptácia tejto vlny prehliadač nad
produkčným buildom, nie zelená tabuľka.
