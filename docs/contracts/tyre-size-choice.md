# Výber rozmeru pneumatík pri snehových reťaziach a ponožkách · kontrakt storefront ↔ CFM

Verzia 1, profil `maky.tyre-size-index/1`. Rozhodnutie: **1 produkt = 1 kód výrobcu**; rozmer pneumatiky nie je variant, ale údaj, ktorý si zákazník vyberá a ktorý sa uloží na riadok košíka a objednávky.

**Kde sa rozmer zadáva.** Zákazník ho povie obchodu raz, tak ako povie auto, a obchod si ho zapamätá (sekcia „Zapamätaný rozmer“). Stránka produktu rozmer nevyberá: iba povie, či produkt na zapamätaný rozmer sedí.

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

## Zapamätaný rozmer

Rozmer pneumatík zadá zákazník v okne „Vozidlo a pneumatiky“ (`VehicleSelectorSheet`, druhá záložka „Pneumatiky“). Otvorí ho tlačidlo v hlavičke, krabička na stránke produktu a tlačidlo kúpy, kým rozmer chýba. Rozmer sa dá napísať (`205/55 R16`, `205/55r16` a iné zápisy z boku pneumatiky) alebo zvoliť po krokoch šírka → profil → priemer disku; ponúkajú sa iba kombinácie, ktoré zoznam má. Zapíše sa vždy **tak, ako ho píše zoznam**; nič sa nezaokrúhľuje ani nepribližuje (`lib/tyre-size/size-lookup.ts`).

- **Cookie `maky-tyres`** (httpOnly, `SameSite=Lax`, `Path=/`, 1 rok): base64url obálka `{"v":1,"s":"205/55 R16"}` (`lib/tyre-size/memory.ts`). Meno nezačína `checkoutId-`, lebo také cookie `lib/checkout.ts` zametá podľa predpony.
- **Nie je podpísané, a to zámerne.** Garáž (`maky-garage`) podpisuje hodnotu, ktorá neskôr odpovedá na „sedí to na vaše auto?“, takže by sa sfalšované auto brala na slovo. Tu sa hodnota na slovo nikdy neberie: každé čítanie (`readRememberedTyreSize`) ju znova overí proti zoznamu a pri pridaní do košíka sa zoznamu pýta znova `resolveTyreSelection`, nech cookie hovorí čokoľvek. Ručne vyrobené, poškodené alebo zastarané cookie (rozmer, ktorý nový zoznam už nemá) znamená „nič nezapamätané“. Najhoršie, čo ručne vyrobené cookie dosiahne, je zúžený pohľad na rozmer, ktorý si vlastník sám zvolil.
- **Serverové akcie** (`lib/tyre-size/actions.ts`): `loadTyreStep` (ponuka krokov a zhoda napísaného textu), `rememberTyreSize`, `forgetTyreSize`. Každá overuje vstup proti zoznamu; z klienta sa nič neberie na slovo.
- **Po uložení alebo zabudnutí** sa okno zavrie a stránka sa vykreslí znova (`router.refresh()`), takže krabička na produkte aj tlačidlo v hlavičke hovoria o tom istom rozmere.
- **Hlavička.** Tlačidlo hlavičky nesie rozmer vedľa auta („205/55 R16 · Zmeniť“); bez auta je rozmer jeho prvý riadok („Pneumatiky 205/55 R16“ / „Zmeniť“) a klik otvorí okno rovno na pneumatikách.

## Čo posiela formulár

Stránka produktu nesie **tri skryté polia** a nič iné; rozmer sa v nej nevyberá, polia vyplní krabička podľa zapamätaného rozmeru (`lib/tyre-size/fit-state.ts`). Zaškrtávacie políčka na stránke nemajú `name`.

| pole            | hodnota                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `tyreMode`      | `size` (zapamätaný rozmer na kód sedí) alebo `code` (rozmer nie je zadaný a zákazník pozná kód)  |
| `tyreSize`      | rozmer presne ako v zozname; pri `code` a pri rozmere, na ktorý produkt nesedí, prázdne          |
| `tyreCondition` | kľúč podmienky, ktorú zákazník potvrdil; prázdne, kým ju nezaškrtne, a pri rozmere bez podmienky |

Nič sa nevyberá za zákazníka. Tlačidlo kúpy (aj to v pevnom pruhu na mobile) hovorí, čo chýba, a vráti zákazníka k tomu, kým výber nie je úplný:

- **„Vyberte rozmer“** (rozmer nie je zadaný): otvorí okno na záložke Pneumatiky.
- **„Potvrďte podmienku“** (rozmer sedí iba na určité pneumatiky): prejde na zaškrtávacie políčko podmienky; po jeho potvrdení sa tlačidlo odomkne.
- **„Nesedí na váš rozmer“** (produkt na rozmer nesedí): otvorí okno, aby sa rozmer dal zmeniť. Je to tichšie, orámované tlačidlo bez zelenej, nie plná výzva na kúpu, a pre čítačky obrazovky je `aria-disabled`; nie je `disabled`, aby sa dalo stlačiť (pevný pruh na telefóne inú cestu von nemá, krabička je vtedy už mimo obrazovky).

Texty týchto tlačidiel sú dlhšie ako „Pridať do košíka“, preto sa na telefóne zalamujú na dva riadky (a v pevnom pruhu majú strop šírky, aby sa cena nezalomila), nie sú orezané. Keď sa okno zavrie, fokus sa vráti na prvok, ktorý ho otvoril (tlačidlo kúpy, nie posledný spúšťač v dialógu, ako by to urobil Radix sám).

Zákazník, ktorý kód pozná, môže v stave „rozmer nie je zadaný“ zaškrtnúť „Kód produktu poznám a rozmer teraz nevyberám“: obchod potom o zhode nič netvrdí a objednávka to hovorí výslovne. Pri zadanom rozmere sa táto možnosť neponúka: zoznam by s ňou polemizoval.

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

## Výpis reťazí podľa rozmeru

Zapamätaný rozmer pracuje aj na výpise police reťazí, tak ako zapamätané auto na polici strešných nosičov (`?vehicle=`). Polica je záznam `snowChains` v `config/categories.ts`; `config/tyre-shelves.ts` len pomenúva, ktorý záznam sa riadi rozmerom, takže slug sa nepíše dvakrát. Iná polica rozmer nepozná a nehovorí o ňom nič.

- **Adresa.** `?tyres=1`: zúžené na rozmer, výslovne. `?tyres=0`: všetky reťaze, výslovne. Bez parametra: ak je rozmer zapamätaný a niečo naň sedí, výpis sa zúži; ak nič nesedí, ukáže sa celá polica a veta o tom; bez rozmeru je polica celá a navrchu je otázka. Obe strany prepínača sú obyčajné odkazy, takže stav sa dá poslať a prežije obnovenie stránky (`lib/tyre-size/listing-param.ts`).
- **Ako sa zúži.** Saleor chce `filter: { ids }`, karta nesie kód. `lib/listing/shelf-codes.ts` prečíta raz štíhlym dopytom `CategoryProductCodes` (strany po 100, cache s profilom a tagom kategórií) verejný kód každého produktu police v kanáli, `lib/tyre-size/plp-tyre-filter.ts` z nich vyberie tie, ktorých zoznam výrobcu má zapamätaný rozmer, a ich id ide do filtra výpisu. Skryté a nezverejnené produkty verejné API nevráti, takže zúžený výpis obsahuje presne to, čo sa predáva. Prázdny zoznam `ids` by Saleor vyložil ako „všetko“, preto sa „nič“ píše `NO_PRODUCTS_SENTINEL_ID`. Polica s viac ako 600 produktmi sa nezužuje a pri chybe čítania sa výpis nechá celý a nič netvrdí (stav `unavailable`, chyba sa zaloguje).
- **Panel nad výpisom** (`TyreListingFilter`). Bez rozmeru: otázka „Aký rozmer pneumatík máte?“ a zelené tlačidlo, ktoré otvorí okno rovno na pneumatikách. Zúžené: jeden riadok, prepínač „Pre moje pneumatiky | Všetky reťaze“ a „Zmeniť rozmer“. Všetky reťaze: veta, že zoznam nie je vybraný podľa rozmeru. Nič nesedí a rozmer nebol vyžiadaný: veta „pre rozmer … teraz nemáme nič“ a celá polica. Nič nesedí a rozmer bol vyžiadaný (`?tyres=1`): prázdny stav s troma cestami (všetky reťaze, zmeniť rozmer, napíšte nám). Panel nevypisuje počet vyhovujúcich produktov: zúžený výpis môže byť ešte užší (cena, výrobca) a dve čísla na jednej obrazovke sú chyba; z rovnakého dôvodu zúžený výpis nenesie počty výrobcov, objemov ani počty pri kategóriách. Prepínač je spoločný komponent s vozidlovým (`ListingModeSwitch`); na 320 px a v dlhších jazykoch sa popisy zalomia a nič nepretečie.
- **Odznak na karte** (`TyreFitLine`, `lib/tyre-size/card-fit.ts`). Keď je rozmer zapamätaný, karta produktu zo zoznamu povie to isté ako krabička na stránke produktu a tými istými slovami: sedí (zelená), podľa údajov dodávateľa alebo s podmienkou (žltá), nesedí (tlmená, bez červenej, lebo pri „všetkých reťaziach“ to povie 130 kariet naraz). Karta počíta verdikt z vlastného kódu a rozmeru, od obchodu nepotrebuje nič, takže povie to isté na každej stránke, kde sa zobrazí. Rýchle pridanie zostáva vypnuté, rozmer sa potvrdzuje na stránke produktu.
- **Po uložení rozmeru z úvodnej stránky trhu** okno odvedie na zúžený výpis (`/sk/snehove-retaze?tyres=1`, `lib/tyre-size/after-size.ts`). Iba z koreňa trhu, iba keď bol rozmer zadaný (zabudnutie nie je žiadosť niečo ukázať) a iba na trhoch, ktoré policu predávajú (`TYRE_SHELF_MARKETS`, dnes `sk`; ďalší trh sa pridá v deň, keď CFM v ňom policu otvorí). Z iných stránok (košík, pokladňa, produkt) sa nikto nepresúva, stránka sa len vykreslí znova. Na samotnej polici sa po zmene rozmeru zahodí poloha v stránkovaní a výslovné „všetky reťaze“, lebo to bolo povedané o starom rozmere.
- **Odkaz z produktu.** Krabička „nesedí“ nesie odkaz „Zobraziť reťaze, ktoré sedia“ (`fittingHref` v `variant-section-dynamic.tsx`) na zúžený výpis.

## Čo zákazník vidí

- Stránka produktu: krabička nad cenou a tlačidlom odpovedá na zapamätaný rozmer. **Nezadaný**: výzva „Overte, či sedí na vaše pneumatiky“ a tlačidlo „Zadať rozmer pneumatík“. **Sedí**: zelená, „podľa zoznamu výrobcu“. **Sedí s podmienkou**: žltá, podmienka výrobcu vlastnými slovami a potvrdenie, tlačidlo odomknuté až po potvrdení. **Podľa údajov dodávateľa** (rozmer z kariet doterajšieho e-shopu, nie z listu výrobcu): žltá s vetou, že rozmer treba overiť podľa vlastnej pneumatiky. **Nesedí**: červená „Na 205/55 R16 tento produkt nesedí“ s odkazom „Zmeniť rozmer“; rozmer sa do formulára nepošle.
- Okno „Vozidlo a pneumatiky“: dve záložky (Vozidlo, Pneumatiky; šípky, Home a End medzi nimi), na pneumatikách tri veľké čísla (šírka, profil, priemer disku), pole na napísanie a kroky. Tlačidlo „Použiť rozmer …“ a pod ním „Zabudnúť rozmer …“.
- Zoznamová karta: rýchle pridanie sa pri týchto produktoch nezobrazí (zákazník ide na stránku produktu), lebo pridanie bez rozmeru by server odmietol.
- Zoznamová karta so zapamätaným rozmerom nesie riadok s odpoveďou „sedí / podľa dodávateľa / s podmienkou / nesedí“; výpis reťazí má panel s prepínačom „Pre moje pneumatiky | Všetky reťaze“ (sekcia „Výpis reťazí podľa rozmeru“).
- Košík (stránka aj panel), súhrn v pokladni, detail objednávky a objednávka v účte: pod názvom produktu „Rozmer pneumatík: 205/55 R16“, prípadne podmienka, alebo „Rozmer neuvedený, produkt zvolený bez rozmeru“. Riadok bez týchto metadát (každý iný produkt) nevykreslí nič (`TyreChoiceLine`).

## Overené

Testy: `src/lib/tyre-size/*.test.ts` (zoznam, vyhľadanie rozmeru, stav krabičky proti serverovej kontrole, cookie, akcie), `src/ui/components/plp/actions.tyre.test.ts`, `product-card.tyre.test.ts`, `src/ui/components/cart/tyre-choice-line.test.ts`, `src/ui/components/pdp/tyre-fit-box.test.ts` (každý stav krabičky vo všetkých 12 jazykoch, vzhľad tlačidiel, ktoré držia späť), `src/ui/components/vehicle/tyre-size-tab.test.ts` a `tyre-messages.test.ts` (každý kľúč správ sa používa a existuje vo všetkých 12 jazykoch). Kľúčové tvrdenia: všetkých 5 324 rozmerov, ktoré výber vie vytvoriť, server prijme; každú podmienku bez potvrdenia server odmietne; vymyslený rozmer (145/70 R13 pri N16061) odmietne; to, čo formulár pošle, server prijme alebo odmietne z dôvodu, ktorý stránka uviedla; obyčajný produkt ide nezmenenou mutáciou. Prehliadač (Chromium, počítač 1280 px, telefón 390, 360 a 320 px, slovenčina) proti dočasnej stránke, ktorá používa skutočné komponenty a skutočné serverové akcie a kontrolu: 58 z 58 kontrol (dva behy po 15 a 43): zadanie rozmeru písaním a po krokoch, uloženie a cookie, zabudnutie, stavy sedí, sedí s podmienkou (oba druhy), podľa dodávateľa a nesedí, odomknutie tlačidla potvrdením, serverová kontrola prijme polia z formulára, návrat fokusu, šípky medzi záložkami, bez bočného posunu a pevný pruh. Skutočný Saleor ani živý web z tohto prostredia dostupné neboli, takže zápis riadku do skutočného košíka a jeho cesta do objednávky overené nie sú (viď „Otvorené“).

Výpis podľa rozmeru: `src/lib/tyre-size/plp-tyre-filter.test.ts` (každý stav, výslovné „všetky“ bez čítania obchodu, prázdny stav spísaný sentinelom, chyba čítania nechá výpis celý; tri úmyselné chyby v module sú zachytené), `src/lib/listing/shelf-codes.test.ts`, `src/lib/tyre-size/card-fit.test.ts`, `after-size.test.ts`, `listing-param.test.ts`, `src/ui/components/plp/tyre-fit-line.test.ts` (štyri odpovede, farby, vo všetkých 12 jazykoch), `src/ui/components/fitment/tyre-listing-filter.test.ts` (každý stav panelu) a `tyre-messages.test.ts`, ktorý teraz číta aj serverový komponent panelu. Prehliadač (Chromium, počítač 1280 px, telefón 390, 360 a 320 px) proti dočasným stránkam so skutočnými komponentmi: všetky stavy panela a karty, 12 jazykov na 320 a 360 px bez bočného posunu a bez neprekladaných kľúčov, tlačidlo v paneli otvorí okno rovno na „Pneumatiky“, uloženie rozmeru nastaví cookie, okno sa zavrie, hlavička ukáže rozmer a fokus sa vráti na tlačidlo. Pri tejto kontrole sa našlo a opravilo pretekanie prepínača na 320 px. Skutočný Saleor z tohto prostredia dostupný nebol, takže čítanie police a zúženie skutočnej stránky kategórie overené nie sú (viď „Otvorené“, bod 6).

## Otvorené

1. **Obsluha vidí rozmer iba v metadátach.** Zobrazenie `maky_tyre_*` v Saleor Dashboarde, v e-maile objednávky (`maky-smtp-app`) a v dokladoch zatiaľ nie je zapojené.
2. **Priame volania Saleoru obchádzajú kontrolu** (pozri „Hranica“). Tvrdšie vynútenie je samostatná úloha na strane Saleoru.
3. **Formulár odstúpenia od zmluvy** rozmer na riadku neukazuje.
4. **Poradie nasadenia.** Storefront s týmto kontraktom sa nasadí **pred** zverejnením 145 produktov v Saleore. Kým produkty nie sú v Saleore, nič sa nemení (kontrola sa týka iba kódov zo zoznamu). Naopak, zverejnený produkt na starom storefronte by sa dal pridať bez rozmeru.
5. **Jedinečnosť kódov.** Kontrola sa viaže na verejný kód variantu; produkt, ktorý by raz dostal ten istý kód ako niektorý zo 145, by sa správal ako snehová reťaz s výberom rozmeru.
6. **Výpis kategórie reťazí so zapamätaným rozmerom** je napísaný a otestovaný, ale na skutočnom Saleore ešte nebežal. Po nasadení sa pozrie `/sk/snehove-retaze?tyres=1` s uloženým rozmerom (zúžený zoznam, odznaky na kartách, čas prvého načítania police) a `?tyres=0`. Nad rámec: rýchle pridanie na kartách pre „sedí bez podmienky“, počet vyhovujúcich produktov v okne a dlaždica police v menu alebo na domovskej stránke (obchodné rozhodnutie, polica sa zatiaľ nikde neodkazuje).
7. **Texty v 11 jazykoch okrem slovenčiny** sú preklady na úrovni používateľského rozhrania; pred zapnutím trhu ich má prečítať rodený hovoriaci.
