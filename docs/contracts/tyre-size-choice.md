# Výber rozmeru pneumatík pri snehových reťaziach a ponožkách · kontrakt storefront ↔ CFM

Verzia 1, profil `maky.tyre-size-index/1`. Rozhodnutie: **1 produkt = 1 kód výrobcu**; rozmer pneumatiky nie je variant, ale údaj, ktorý si zákazník vyberá a ktorý sa uloží na riadok košíka a objednávky.

**Kto čo vlastní.** Zoznam „kód → rozmery → podmienka na pneumatiky“ vlastní a vyrába CFM (je to jeho zapečatený výstup). Storefront je konzument: zoznam číta, kontroluje a podľa neho povolí alebo odmietne pridanie do košíka. Storefront sa nikdy nepýta Saleoru, aký rozmer „patrí“ ku kódu; Saleor o rozmeroch nevie nič, drží iba produkt s jedným variantom.

## Prečo nie varianty

Jeden kód výrobcu pasuje na desiatky až stovky rozmerov (145 kódov, 5 324 riadkov). Pri variante na rozmer by z 145 produktov bolo vyše päťtisíc kariet, z ktorých každá má vlastný sklad, cenu a stránku, hoci reťaz fyzicky pasuje podľa kódu. Zákazník preto vyberá rozmer a obchod ho nesie pri riadku, kým ho nevidí sklad a obsluha v objednávke.

## Zoznam rozmerov

- Súbor: `src/lib/tyre-size/data/velkosti_20261105.json` (a `.sha256` vedľa neho). Je to **verbatim kópia** súboru z CFM (`backend/artifacts/snehove_retaze/velkosti_20261105.json`); `data/PROVENANCE.json` nesie commit CFM, `sha256`, `self_sha256` a git blob. Súbor sa nikdy neupravuje ručne.
- Tvar: `conditions` (16 podmienok: `mode` `only`/`not`, pôvodné slová výrobcu `raw`, zoznam značiek alebo modelov `tyres`), `sources` (kľúč zdroja → popis), `products` (kód → `source` a riadky `[rozmer, priemer disku, kľúč podmienky]`), `counts`, `origin`, `self_sha256`.
- Rozmer je text presne tak, ako ho dal výrobca (`205/55 R16`, `R17,5`, `4.00-12`, `175 R13`). Nikdy sa neprepočítava, nezaokrúhľuje na susedný ani nemení; priemer disku môže byť desatinný (`15.5`, `22.5`).
- Zdroje sú dva a zákazník ich rozlíši: `manufacturer_list_2026_10` je kompatibilný list výrobcu, `previous_shop_card` sú údaje dodávateľa z kariet doterajšieho e-shopu (nie list výrobcu). Pri druhom stránka výslovne povie, že rozmery treba overiť podľa vlastnej pneumatiky.
- Podmienka na pneumatiky (27 produktov) sa **nikdy nestratí**: ak list pri rozmere uvádza „iba Bridgestone Duravis Rxxx“ alebo „nie Kleber, Michelin, Continental“, zákazník ju musí výslovne potvrdiť a potvrdenie sa uloží.
- Načítanie je prísne (`parseTyreSizeIndex`): neznámy zdroj, neexistujúci kľúč podmienky, rozmer dvakrát pri jednom kóde alebo nesedniace počty znamenajú, že súbor nie je ten, ktorý mal ísť von, a modul pri načítaní zlyhá nahlas; skôr ako sa k tomu dostane zákazník, zlyhá test súboru.
- `src/lib/tyre-size/codes.ts` je malá kópia **iba kódov** pre prehliadač (karta v zozname sa podľa nej rozhodne, či ponúknuť rýchle pridanie). Rozhodnutie o tom, čo sa smie pridať, robí iba server. `size-index.test.ts` pripína `codes.ts` na kódy v zozname, takže sa nerozídu.

**Obnova zoznamu z CFM.** CFM vyrobí nový súbor (jeho skript je `build_velkosti.py`, súbor je zapečatený a skript ho zreprodukuje bajt po bajte). Do storefrontu ide nový súbor + `.sha256` + `PROVENANCE.json`, `TYRE_SIZE_LIST_ID` a `codes.ts` sa obnovia z neho a prejde `size-index.test.ts`. Staré riadky objednávok nesú id zoznamu, z ktorého vznikli (`maky_tyre_list`), takže sa nikdy nečítajú proti novému.

## Čo posiela formulár

Výber na stránke produktu nesie **tri skryté polia** a nič iné; viditeľné `select`y nemajú `name`.

| pole            | hodnota                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `tyreMode`      | `size` (zákazník vybral rozmer zo zoznamu) alebo `code` (pozná kód)        |
| `tyreSize`      | rozmer presne ako v zozname; pri `code` prázdne                            |
| `tyreCondition` | kľúč podmienky, ktorú zákazník potvrdil; prázdne, ak rozmer podmienku nemá |

Nič sa nevyberá za zákazníka (ani pri jedinom rozmere). Tlačidlo kúpy (aj to v pevnom pruhu na mobile) hlási „Vyberte rozmer“ a vráti zákazníka k výberu, kým výber nie je úplný. Zákazník, ktorý kód pozná, môže vybrať „Kód produktu poznám a rozmer teraz nevyberám“: obchod potom o zhode nič netvrdí a objednávka to hovorí výslovne.

## Kontrola na serveri

Robí ju `addVariantToCart` (`src/ui/components/plp/actions.ts`), teda **každá** cesta do košíka: stránka produktu, formulár v zozname, konfigurátor vozidla. Ktoré produkty sa to týka, určuje server z verejného kódu variantu, ktorý odpovedal Saleor (`variant.name`, `publicProductCode`), nie z niečoho, čo povedal formulár.

1. Zistí sa verejný kód variantu (čítanie, ešte žiadny košík).
2. Ak kód je v zozname, `resolveTyreSelection` skontroluje výber. Odmietnutie je zvlášť pre „nič nevybrané“ (`size-required`), „rozmer nepatrí ku kódu“ (`size-invalid`) a „podmienka nepotvrdená alebo nesedí“ (`size-condition`). Odmietnutie príde skôr, než vznikne košík, cookie alebo mutácia.
3. Až potom sa zapíše riadok.

Každé odmietnutie má vlastnú vetu v 12 jazykoch (`tyreSize.errorRequired`, `errorInvalid`, `errorCondition`).

**Hranica.** Táto kontrola je ochrana kvality údajov a pohodlia, nie bezpečnostná hranica: kto volá Saleor priamo (GraphQL `checkoutLinesAdd`), obíde storefront. Tvrdšie vynútenie by muselo ísť na stranu Saleoru alebo pri dokončení objednávky (otvorený bod nižšie).

## Čo sa uloží na riadok

Verejné metadáta riadku košíka (Saleor ich pri `checkoutComplete` skopíruje do riadku objednávky; overené na zdroji Saleoru 3.23.31):

| kľúč                        | hodnota                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `maky_tyre_mode`            | `size` alebo `code`                                               |
| `maky_tyre_list`            | id zoznamu (`snehove-retaze-20261105`)                            |
| `maky_tyre_size`            | zvolený rozmer (iba `size`)                                       |
| `maky_tyre_condition_mode`  | `only` alebo `not` (iba keď rozmer nesie podmienku)               |
| `maky_tyre_condition_tyres` | značky/modely oddelené „ / “                                      |
| `maky_tyre_basis`           | zdroj rozmeru (`manufacturer_list_2026_10`, `previous_shop_card`) |

**Zlučovanie riadkov.** Saleor bez `forceNewLine` spojí riadok toho istého variantu a prepíše jeho metadáta, takže druhý rozmer by zničil prvý. Preto:

- ten istý variant a ten istý výber (rozmer + podmienka, alebo „poznám kód“) znova: zvýši sa množstvo existujúceho riadku (`checkoutLinesUpdate` s absolútnym množstvom, čo sa dá bezpečne dočítať, keď odpoveď zmizne);
- iný rozmer toho istého kódu: nový riadok (`checkoutLinesAdd` s `forceNewLine: true` a metadátami).

Ostatné produkty idú nezmenenou mutáciou `checkoutLinesAdd` s nezmenenými premennými.

## Čo zákazník vidí

- Stránka produktu: pole „Rozmer vašich pneumatík“ (priemer disku, potom rozmer; podmienka v žltom rámčeku s potvrdením), nad cenou a tlačidlom.
- Zoznamová karta: rýchle pridanie sa pri týchto produktoch nezobrazí (zákazník ide na stránku produktu), lebo pridanie bez rozmeru by server odmietol.
- Košík (stránka aj panel), súhrn v pokladni, detail objednávky a objednávka v účte: pod názvom produktu „Rozmer pneumatík: 205/55 R16“, prípadne podmienka, alebo „Rozmer neuvedený, produkt zvolený bez rozmeru“. Riadok bez týchto metadát (každý iný produkt) nevykreslí nič (`TyreChoiceLine`).

## Overené

Testy: `src/lib/tyre-size/*.test.ts`, `src/ui/components/plp/actions.tyre.test.ts`, `product-card.tyre.test.ts`, `src/ui/components/cart/tyre-choice-line.test.ts`, `src/ui/components/pdp/tyre-size-picker.test.ts`. Kľúčové tvrdenia: všetkých 5 324 rozmerov, ktoré výber vie vytvoriť, server prijme; každú podmienku bez potvrdenia server odmietne; vymyslený rozmer (145/70 R13 pri N16061) odmietne; obyčajný produkt ide nezmenenou mutáciou. Prehliadač (Chromium, počítač 1280 px, telefón 390, 360 a 320 px, všetkých 12 jazykov) proti dočasnej stránke, ktorá používa skutočné komponenty a skutočnú serverovú kontrolu: 58 z 58 kontrol. Skutočný Saleor ani živý web z tohto prostredia dostupné neboli, takže zápis riadku do skutočného košíka a jeho cesta do objednávky overené nie sú (viď „Otvorené“).

## Otvorené

1. **Obsluha vidí rozmer iba v metadátach.** Zobrazenie `maky_tyre_*` v Saleor Dashboarde, v e-maile objednávky (`maky-smtp-app`) a v dokladoch zatiaľ nie je zapojené.
2. **Priame volania Saleoru obchádzajú kontrolu** (pozri „Hranica“). Tvrdšie vynútenie je samostatná úloha na strane Saleoru.
3. **Formulár odstúpenia od zmluvy** rozmer na riadku neukazuje.
4. **Poradie nasadenia.** Storefront s týmto kontraktom sa nasadí **pred** zverejnením 145 produktov v Saleore. Kým produkty nie sú v Saleore, nič sa nemení (kontrola sa týka iba kódov zo zoznamu). Naopak, zverejnený produkt na starom storefronte by sa dal pridať bez rozmeru.
5. **Jedinečnosť kódov.** Kontrola sa viaže na verejný kód variantu; produkt, ktorý by raz dostal ten istý kód ako niektorý zo 145, by sa správal ako snehová reťaz s výberom rozmeru.
6. **Texty v 11 jazykoch okrem slovenčiny** sú preklady na úrovni používateľského rozhrania; pred zapnutím trhu ich má prečítať rodený hovoriaci.
