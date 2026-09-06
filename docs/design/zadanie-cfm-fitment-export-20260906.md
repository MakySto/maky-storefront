# Zadanie pre CFM — atribúty Nordrive kohorty a reálny fitment export

Vytvorené 2026-09-06 vláknom B storefrontu. **Vlož tento dokument celý ako prvú správu
do CFM vlákna.** Je self-contained: čítajúci nepotrebuje storefront ani predchádzajúce
vlákna. Odpovedaj po slovensky.

---

## 0. Prvé tri vety

CFM je autorita pre dáta; storefront je autorita pre to, čo z nich vie prečítať. Tento
dokument hovorí, **čo presne treba doplniť do Saleoru a čo vyexportovať**, aby sa
odblokovali dve veci, ktoré dnes stoja: značka a špecifikácie na 9 192 stránkach, a
konfigurátor strešných nosičov.

**Nič z toho nie je „vymysli kompatibilitu".** Obe dodávky sú o publikovaní väzby, ktorú
zdroj už má — o čom nižšie existuje dôkaz.

---

## 1. Čo je dnes overené (merané naživo proti `api.maky.store`, 2026-09-06, iba čítanie)

| meranie                                                | výsledok                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| kategória „Nordrive strešné nosiče"                    | **9 192** verejných produktov (celý katalóg `sk-eur`: 9 606)         |
| atribúty na Nordrive kohorte (vzorka 300)              | **0 / 300** — kohorta nemá **ŽIADNY** atribút                        |
| atribúty na staršom katalógu (vzorka 60)               | **60 / 60**, vrátane `manufacturer` 60/60                            |
| `externalReference` tvaru `cfm:product:*` (vzorka 300) | **300 / 300** — tvar `cfm:product:CFMP-B-NOR-<hash>-000000`          |
| `cfm_availability_mode` (vzorka 300)                   | **300 / 300 na variante aj na produkte** — v poriadku                |
| `productType` na kohorte                               | 300 / 300 `Roof Rack Bundle`                                         |
| SKU tvar                                               | `N15040\|CFMP-B-NOR-<hash>-000000` (viditeľný kód + interná prípona) |

**Dôsledok prvého a druhého riadku:** Saleor atribúty vie a v staršom katalógu ich má.
Nordrive kohorta ich nemá **ani jeden**. Nie je to limitácia platformy, je to medzera
v importe tejto kohorty.

### 1.1 Zdroj tú väzbu už MÁ — dôkaz je v názvoch

Vzorka 1 200 názvov z kohorty. Každý jeden má tvar:

```
Strešný nosič Nordrive <séria> <značka> <model> <kód generácie> (<roky>) — <typ strechy>
```

Skutočné príklady z katalógu:

```
Strešný nosič Nordrive Helio Black Alfa Romeo 156 Crosswagon (2004–2007) — Klasické lyžiny
Strešný nosič Nordrive Helio Black Audi A3 Sportback 8VA (2012–2020) — Integrované lyžiny
Strešný nosič Nordrive Helio Black Audi A4 Allroad B9 (2016–) — Klasické lyžiny
```

Rozdelenie vo vzorke 1 200:

- typ strechy: Klasické lyžiny 405 · Hladká strecha 300 · Integrované lyžiny 299 ·
  Fixačné body 162 · T-drážka v streche 34 — **oddeľovač `—` je prítomný v 1 200/1 200**
- rokové okno: uzavreté (`od–do`) 859 · otvorené (`od–`) 337 · **bez rokov 4**

**Ten názov nevznikol náhodou.** Aby ho niečo vygenerovalo, muselo poznať značku, model,
generáciu, rokové okno aj typ strechy pre každý z 9 192 produktov. Žiadame teda
vyexportovať väzbu, ktorá už raz bola použitá — nie ju vytvoriť.

⚠️ **Storefront z názvu fitment čítať NEBUDE a nikdy nebude.** Parsovanie názvu je
odhad, nie fakt, a jedna zmena formátu by potichu zmenila to, čo zákazníkovi tvrdíme
o bezpečnostnom diele na streche auta. Čísla vyššie sú **iba indikácia rozsahu pre teba**.

---

## 2. Dve dodávky, v tomto poradí

### D1 — atribúty na Nordrive kohorte (**vyššia priorita**)

9 192 produktových stránok je v sitemape a Google ich indexuje **teraz**. Bez atribútov:

- v štruktúrovaných dátach chýba **značka** — Merchant Center ju vyžaduje,
- tabuľka špecifikácií na produktovej stránke je prázdna,
- zákazník nemá ako porovnať dva nosiče.

Minimum, ktoré má kohorta dostať (názvy slugov už v inštancii existujú a používa ich
starší katalóg — **použi tie isté, nezavádzaj nové**):

| atribút      | slug               | povinné | poznámka                                         |
| ------------ | ------------------ | ------- | ------------------------------------------------ |
| výrobca      | `manufacturer`     | **áno** | „Nordrive". Toto je ten, ktorý blokuje SEO.      |
| materiál     | `material`         | áno     | hliník / oceľ                                    |
| max. nosnosť | `max-load`         | áno     | bezpečnostné číslo — **nikdy nedopĺňaj odhadom** |
| hmotnosť     | `weight`           | ak je   |                                                  |
| zámok        | `locking-features` | ak je   |                                                  |
| záruka       | `warranty`         | ak je   |                                                  |
| rozmery      | `dimensions-text`  | ak je   |                                                  |

**Pravidlo:** čo zdroj nemá, sa nedopĺňa. Prázdny atribút je lepší než vymyslený, a pri
nosnosti to platí dvojnásobne — je to číslo, podľa ktorého si niekto naloží strechu.

### D2 — fitment export (odblokuje konfigurátor)

Read-only JSON dokument, dostupný storefrontu. **Najprv pilot 10–20 skutočných
aplikačných riadkov**, na overenie celého spojenia; po jeho prijatí **tým istým
exportérom celá pripravená kohorta**. Desať riadkov je integračný dôkaz, nie pokrytie.

---

## 3. Presný tvar D2

Autorita je `src/lib/fitment/contract.ts` v storefronte, `schemaVersion` **`2.0.0`**.
Validátor (`src/lib/fitment/validate.ts`) beží pri každom načítaní; keď neprejde,
storefront dataset **zahodí** a tvári sa, akoby provider bol nedostupný — funkcia mlčí,
nič sa nerozbije, ale ani nič nepredá.

### 3.1 Obal

```jsonc
{
	"schemaVersion": "2.0.0", // musí byť 2.x, inak REJECT
	"datasetVersion": "nordrive-2026-09-10-pilot",
	"datasetHash": "<hash obsahu>", // na detekciu zmeny
	"generatedAt": "2026-09-10T08:00:00.000Z", // ISO-8601, riadi staleness
	"source": { "system": "cfm", "note": "voliteľné" },
	"saleorInstance": "api.maky.store", // MUSÍ byť presne toto
	"validity": { "validUntil": null, "staleAfterDays": 30 },
	"coverage": {
		"scope": { "programId": "nordrive-roof-racks", "productKinds": ["roof-rack-set"] },
		"completeForMakeIds": [] // pri pilote PRÁZDNE — viď §4
	},
	"makes": [
		/* … */
	],
	"models": [
		/* … */
	],
	"generations": [
		/* … */
	],
	"applications": [
		/* … */
	]
}
```

- `source.system` **nesmie** byť `"fixture"` a **nesmie** tam byť kľúč `demoCatalogue` —
  oboje označí dataset ako ukážkový a storefront ho nikdy nepustí k predaju.
- `saleorInstance` sa porovnáva s hostom Saleor API. Iná hodnota = REJECT, zámerne: ID sú
  viazané na inštanciu a tichý nesúlad by ukázal úplne iné produkty.

### 3.2 Strom vozidiel

```jsonc
"makes":  [ { "id": "<stabilné id>", "name": "<zobrazovaný názov>" } ],
"models": [ { "id": "…", "makeId": "…", "name": "…" } ],
"generations": [{
  "id": "…", "modelId": "…", "name": "…",
  "productionYearFrom": 2012,
  "productionYearTo": 2020,          // null = stále vo výrobe
  "qualifiers": { "roofTypes": ["flush-rails"], "bodyTypes": ["estate"], "doors": [5] }
}]
```

`generations[].qualifiers` riadi, **na čo sa selektor zákazníka spýta**. Keď generácia
existuje v dvoch typoch strechy, uvedieš obe a selektor sa spýta; keď v jednej, neuvedieš
nič navyše a otázka odpadne. **Nikdy sa neháda** — zle uhádnutý typ strechy znamená
pätky, ktoré sa na auto neuchytia.

### 3.3 Aplikačný riadok

```jsonc
{
	"applicationId": "<stabilné, unikátne v datasete>",
	"generationId": "<musí existovať v generations[]>",
	"yearFrom": 2014,
	"yearTo": 2018, // null = otvorené
	"qualifiers": { "roofTypes": ["flush-rails"] },
	"conditions": [{ "code": "torque-check", "text": { "sk": "…", "de": "…" } }],
	"verificationStatus": "verified", // verified | provisional | year-hold | conflict
	"negative": false, // true = zdroj EXPLICITNE tvrdí, že nepasuje
	"products": [
		{
			"externalReference": "cfm:product:CFMP-B-NOR-…",
			"saleorProductId": "<base64 'Product:<pk>'>",
			"saleorVariantId": "<base64 'ProductVariant:<pk>'>",
			"productKind": "roof-rack-set",
			"completeSet": { "includes": ["bars", "feet", "fitting-kit"] },
			"facets": { "barShape": "aero", "barMaterial": "aluminium", "maxLoadKg": 75, "lockable": true }
		}
	]
}
```

Odkiaľ čo:

| pole                   | zdroj                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `externalReference`    | to isté, čo je už v Saleore na produkte — storefront ho **overuje**                            |
| `saleorProductId`      | Saleor `Product.id`. Povinné: hromadný lookup podľa externalReference v Saleore **neexistuje** |
| `saleorVariantId`      | presný variant, ktorý sa predáva. **Nikdy sa neodvodzuje** z produktu                          |
| `productKind`          | klasifikácia **zo zdroja**, nie z názvu, slugu ani z `productType`                             |
| `completeSet.includes` | skutočný obsah TEJTO sady. Fixpoint systém nemusí mať kit — nešablónuj                         |
| `facets.maxLoadKg`     | iba ak to zdroj má. Bezpečnostné číslo sa nededí od súrodenca                                  |

### 3.4 Mapovanie typu strechy

Kontrakt pozná presne týchto šesť. Prvých päť pokrýva všetko, čo je dnes v názvoch:

| v názvoch dnes          | hodnota v exporte |
| ----------------------- | ----------------- |
| Klasické lyžiny         | `raised-rails`    |
| Integrované lyžiny      | `flush-rails`     |
| Hladká strecha          | `naked-roof`      |
| Fixačné body            | `fixpoint`        |
| T-drážka v streche      | `t-track`         |
| (zatiaľ sa nevyskytuje) | `rain-gutter`     |

Karoséria: `hatchback` `estate` `saloon` `suv` `mpv` `van` `coupe` `convertible` `pickup`.

Toto je **slovník, nie pravidlo o kompatibilite** — autoritatívne je, čo o produkte
tvrdí zdroj, nie čo je v názve.

---

## 4. Pravidlá, ktoré sa nesmú porušiť

1. **Zverejnenie produktu nie je dôkaz overenej kompatibility.** To, že publikácia
   9 192 produktov prebehla, neoprávňuje označiť riadky `verified`. `verified` znamená,
   že zdroj potvrdil celé uvedené rokové okno a celú množinu kvalifikátorov. Čokoľvek
   odvodené je `provisional`; sporné okno je `year-hold`; dva nesúhlasiace zdrojové
   riadky sú `conflict`. Storefront ponúkne na predaj **iba `verified`** — ostatné
   zobrazí ako „nevieme potvrdiť", čo je pravda a je to v poriadku.

2. **Pilot je neúplný dataset — `completeForMakeIds` nechaj PRÁZDNE.** Toto pole je
   jediné, čo dovolí storefrontu premeniť _chýbajúci riadok_ na vetu „nepasuje". Keď tam
   uvedieš značku, ktorej máš v exporte len časť modelov, storefront začne o zvyšku
   tvrdiť, že nepasuje. Uveď značku až vtedy, keď pre ňu **naozaj** máš v rozsahu
   programu každý riadok.

3. **Rokové okno aplikácie nie je rokové okno generácie.** Generácia vyrábaná 2015–2021
   môže mať overenú aplikáciu len na 2017–2021. Nerozťahuj jedno druhým — validátor to
   ohlási ako varovanie, ale nezastaví ťa.

4. **Chýbajúci kvalifikátor a prázdny zoznam nie sú to isté.** Neuvedený kľúč znamená
   „na tomto tejto aplikácii nezáleží". `"roofTypes": []` je dátová chyba a validátor ju
   **odmietne**.

5. **`negative: true` je silné tvrdenie.** Používa sa len tam, kde zdroj výslovne hovorí,
   že to nepasuje. Je to jediná vec okrem `completeForMakeIds`, ktorá vyrobí červené
   „Nepasuje na vaše vozidlo".

6. **Podmienky (`conditions`) sa neprekladajú vymýšľaním.** `code` je stabilný a strojový;
   `text` je text zo zdroja podľa jazyka. Keď pre daný jazyk text nie je, storefront
   podmienku **nezobrazí a zníži si istotu** — nikdy nezobrazí slovenskú podmienku na
   nemeckej stránke.

---

## 5. Čo validátor odmietne (dataset sa zahodí celý)

- `schemaVersion` chýba, nie je semver, alebo má inú major verziu než `2`
- chýba `datasetVersion`, `datasetHash`, `generatedAt` (musí byť parsovateľný dátum) alebo `saleorInstance`
- `saleorInstance` ≠ `api.maky.store`
- chýba `validity`, `validity.staleAfterDays` nie je kladné číslo
- chýba `coverage.completeForMakeIds` alebo `coverage.scope.programId`
- `makes` / `models` / `generations` / `applications` nie sú polia
- duplicitné `id` v `makes`, `models`, `generations`; duplicitný `applicationId`
- `model.makeId` / `generation.modelId` / `application.generationId` ukazuje na neexistujúce id
- `yearTo` pred `yearFrom`; `yearFrom` nie je číslo
- neznámy `verificationStatus`
- `conditions[].code` chýba
- produkt bez `externalReference`, bez `saleorProductId`, bez `saleorVariantId`,
  alebo s neznámym `productKind`
- `completeSet.includes` je prítomné, ale nie je neprázdne pole
- prázdne pole v `qualifiers` (`"roofTypes": []`), neceločíselné `doors`, neznáma hodnota

Iba **varuje** (dataset prejde, varovanie ide do logu): `schemaVersion` `2.x` ≠ `2.0.0`,
a rokové okno aplikácie mimo výrobného okna generácie.

---

## 6. Ako to doručiť

Storefront číta jednu URL, `GET`, voliteľne s `Authorization: Bearer <token>`:

```
MAKY_FITMENT_PROVIDER=http
MAKY_FITMENT_URL=<URL dokumentu>
MAKY_FITMENT_TOKEN=<token, ak treba>
MAKY_FITMENT_TIMEOUT_MS=5000        # default
MAKY_FITMENT_REVALIDATE_SECONDS=300 # default
```

Odpoveď je celý JSON dokument (nie stránkovaný), `200`, `content-type: application/json`.
Čerstvosť rieši `datasetVersion` / `generatedAt`, nie HTTP hlavičky.

**Na pilot nemusíš stavať nové verejné API.** Stačí súbor na dohodnutom mieste, alebo
dočasný lokálny endpoint — verejné runtime napojenie je samostatný prevádzkový krok.

### Ako si to over pred odovzdaním

1. `schemaVersion` je `2.0.0`, `saleorInstance` je presne `api.maky.store`.
2. `demoCatalogue` v dokumente **nie je** a `source.system` nie je `"fixture"`.
3. Každý `saleorProductId` a `saleorVariantId` skutočne existuje v kanáli `sk-eur` —
   over ich jedným dotazom `products(first: 100, channel: "sk-eur", filter: { ids: [...] })`
   a porovnaj `totalCount` s počtom odoslaných ID.
4. Každý `externalReference` sa zhoduje s tým, čo má daný produkt v Saleore. Storefront
   to overuje a nesúlad riadok **zahodí** (je to obrana proti tomu, aby sa do ponuky
   dostal iný produkt, než na aký riadok mieril).
5. `completeForMakeIds` je pri pilote prázdne.

---

## 7. Čo NErobiť

- Neparsuj názov produktu ako zdroj fitmentu (ani ty, ani my).
- Neoznačuj riadky `verified` len preto, že produkt je zverejnený.
- Nedeklaruj `completeForMakeIds` pre značku, ktorej máš v exporte časť.
- Nedopĺňaj chýbajúcu nosnosť, rozmer ani obsah sady odhadom alebo od súrodenca.
- Neposielaj dataset s `demoCatalogue` — je to ukážkový režim a nič sa v ňom nepredá.
- Nemeň `externalReference` existujúcich produktov (je to stabilná identita naprieč
  importmi a storefront ju kontroluje).
- Neopakuj publikáciu produktov a nevracaj ich do skrytého stavu — kohorta je zverejnená
  a to je v poriadku.

---

## 8. Ako hlásiť

```
D1 ATRIBÚTY:   koľko z 9 192 produktov má manufacturer / material / max-load
D2 PILOT:      datasetVersion, počet makes/models/generations/applications,
               počet riadkov podľa verificationStatus,
               completeForMakeIds (očakávané: prázdne),
               doručovacia cesta (URL alebo súbor)
OVERENÉ:       koľko saleorProductId/saleorVariantId sa našlo v sk-eur (z koľkých),
               koľko externalReference sedelo s katalógom
ČO CHÝBA:      ktoré polia zdroj nemá a prečo — radšej priznané ako doplnené
```

Pri každom čísle uveď, či ide o **celú kohortu** alebo o **vzorku** (a akú).

---

## 9. Čo sa stane po dodaní

Storefront napojí `MAKY_FITMENT_PROVIDER=http`, overí dataset validátorom, a v prehliadači
prejde reálnu cestu: vybrať vozidlo zo snapshotu → ponuka musí ukázať **skutočný** nosič
s fotkou, cenou a dostupnosťou → pridať do košíka → riadok v košíku. **Objednávka
nevznikne.** Až potom sa v reporte prepnú `PROVIDER_CONNECTED` a `REAL_SNAPSHOT` na YES.

Dovtedy je konfigurátor hotový, otestovaný na ukážkových dátach a **verejne vypnutý**.
