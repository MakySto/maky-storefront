# Typovaný popis produktu · kontrakt storefront ↔ CFM

Profil „maky-content“, verzia 1. Šablóny: autochladnička (pilot CoolZ 19 / 32 / 40 / 65 / 83, ďalšie autochladničky) a strešný nosič (sady Nordrive a Thule). Dizajn: „Šablóny produktových stránok“ z 2. 10. 2026, fáza 2.

**Kto čo vlastní.** Profil, teda čo storefront vie prečítať a zobraziť, vlastní storefront, lebo je konzument. Tri ukážky, proti ktorým testujú obe strany, generuje CFM, lebo je producent. Bajty ukážok sú v oboch repozitároch rovnaké a každá strana ich pripína odtlačkom, takže sa jedna nemôže potichu rozísť s druhou. Druhá schéma nevznikla: popis je obyčajný Editor.js dokument zložený z blokov, ktoré Saleor sám ukladá a vracia.

## Prečo profil a nie nové typy blokov

Dizajn posiela popis ako bloky vlastných druhov (`callout`, `benefits`, `inBox`, …). Saleor 3.23.31 ich neuloží. Jeho `clean_editorjs` overí každý blok voči uzavretej množine (`paragraph`, `header`, `list`, `quote`, `embed`, `image`, `table`), pri akomkoľvek inom type **odmietne celú mutáciu** a z dokumentu ponechá iba `version`, `time` a `blocks`. Overené spustením nezmenenej funkcie zo zdrojov 3.23.31, nie z dokumentácie. Roly preto cestujú v blokoch, ktoré Saleor drží: v `version` dokumentu, v `id` bloku a v samotných nosičoch.

Čo z toho plynie: čítačka, ktorá profil nepozná (starší storefront, iný konzument), ukáže **všetok text**, len bez vzhľadu rolí. Na rozdiel od vlastného typu bloku sa varovanie nedá zahodiť tým, že ho nikto nepozná.

## Čo producent posiela

**Obálka.** `version` je `maky-content/1` alebo `maky-content/1:<šablóna>`, napríklad `maky-content/1:autochladnicka`. Neznáma major verzia znamená, že sa značky ignorujú a dokument sa vykreslí ako obyčajné bloky. Iné polia dokumentu Saleor zahodí.

**Značka.** `id` bloku je `maky:<rola>` alebo `maky:callout:<druh>`, voliteľne s príponou `#2` a ďalej, ktorá len drží opakovanú rolu jedinečnú. Iný `id` nič neznamená.

**Nadpis.** Neznačkovaný blok `header` bezprostredne nad značkovaným blokom je jeho nadpis. Úroveň nadpisu producenta sa nepoužije: popis stojí pod nadpisom stránky, úroveň je vec stránky. Poznámka (`callout`) má nadpis vo vnútri rámika.

| Rola                                 | Nosič                    | Tvar                                                                          | Čo storefront nakreslí                                                                   |
| ------------------------------------ | ------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `maky:callout:tip` · `info` · `warn` | `paragraph` alebo `list` | text, alebo zoznam krátkych položiek                                          | rámik s ikonou, názvom druhu pre čítačky („Tip“, „Informácia“, „Upozornenie“) a nadpisom |
| `maky:benefits`                      | `list`                   | `<strong>Názov</strong> text`                                                 | odrážky s fajkou                                                                         |
| `maky:inbox`                         | `list`                   | `<strong>Názov</strong> text`                                                 | dlaždice „čo je v balení“                                                                |
| `maky:features`                      | `list`                   | `<strong>Názov</strong> text`, `meta.icon`, jedna vnorená položka ako popisok | veľké ikony s popisom                                                                    |
| `maky:steps`                         | `list`, `ordered`        | `<strong>Názov</strong> text`                                                 | očíslované kroky                                                                         |
| `maky:faq`                           | `list`                   | otázka s presne jednou vnorenou položkou, odpoveďou                           | rozbaľovacie otázky                                                                      |
| `maky:specs`                         | `table` bez hlavičky     | dve bunky na riadok, riadok skupiny má druhú prázdnu                          | skupiny parametrov                                                                       |
| `maky:documents`                     | `list`                   | `<a href="https://…">Názov</a> poznámka`                                      | karty na stiahnutie                                                                      |

- **Strešná sada** (`maky-content/1:stresny-nosic`) vzniká z HTML, ktoré napíše skladač sád (`_compose_roof_rack_html`), podľa **tried sekcií**, nie podľa textu: `product-components` → `maky:inbox` (názov dielu bez dvojbodky), `product-benefits` → `maky:benefits` (každá položka je jedna veta bez `<strong>`), `product-tech-params` → `maky:specs` (jedna skupina bez názvu), `product-warnings` → `maky:callout:warn`, `product-roof-guide` → `maky:callout:info`. Úvod, kompatibilita, použitie a motto ostávajú obyčajné bloky. Popis má rovnaké bloky v rovnakom poradí s rovnakým textom ako doteraz; líši sa tabuľkou parametrov namiesto zoznamu a dvojbodkou pri názve dielu. Čo CFM takto nevie napísať, riadok zadrží, späť na text bez rolí nepadá. Typuje sa iba v behu, ktorý o to požiada (`--typed-description` v `plan_sk_public_update` a `publish_sk_hidden_catalog`), nie globálnym prepínačom, a tabuľka parametrov potrebuje v tom behu zapnuté `CFM_SALEOR_NATIVE_COMPARISON_TABLES`.
- **Ikony** (`meta.icon`) sú uzavretá množina: `battery`, `stand`, `smartphone`, `lightbulb`, `snowflake`, `plug`, `shield`. Neznámy názov nakreslí všeobecnú značku; je to chyba producenta, nie zákazníka, takže stránka ostane celá.
- **Odkaz dokumentu** je `https://…` alebo cesta na tomto webe (`/…`). Protokol-relatívny odkaz (`//…`) a každá iná schéma sú chyba bloku. Otvára sa v novej karte s `noopener noreferrer`.
- Saleor 3.23.31 pri odkazoch pridá `rel="noopener noreferrer"`, takže zapísaný a prečítaný dokument sa líši práve v tom a v ničom inom. Čítačka to toleruje.

Skrátený príklad (celý dokument je v ukážke):

```json
{
	"version": "maky-content/1:autochladnicka",
	"blocks": [
		{ "type": "paragraph", "data": { "text": "PRO-USER CoolZ 32 je všestranná kompresorová chladnička …" } },
		{ "type": "header", "data": { "level": 3, "text": "Tip" } },
		{
			"type": "paragraph",
			"id": "maky:callout:tip",
			"data": { "text": "Pred výletom vychlaďte chladničku doma …" }
		},
		{ "type": "header", "data": { "level": 2, "text": "Prečo si vybrať CoolZ 32?" } },
		{
			"type": "list",
			"id": "maky:benefits",
			"data": {
				"style": "unordered",
				"items": ["<strong>Kompresorová technológia</strong> chladí a mrazí spoľahlivo …"]
			}
		}
	]
}
```

## Čo z toho storefront urobí

- **Čítačka** (`src/lib/editorjs-content.ts`, volaná z `parseProductContent` v `src/lib/editorjs.ts`) prečíta obálku, značky a nosiče a vykreslí každú rolu. Nič z Saleoru sa nedostane do HTML inak ako cez `sanitizeInline`; triedy, názvy ikon a pevné slová sú vlastné a druhý prechod (`sanitizeBlock`) pustí iba tie. Tvar sa číta z `id`, nie z textu, takže dlhý alebo prázdny text rolu nezmení.
- **Šablóna** sa vyberá **iba** z `version`. Dokument bez mena šablóny alebo s menom, ktoré register (`src/lib/product-templates.ts`) nepozná, dostane generickú šablónu: stránka je taká, aká bola. Šablóna nikdy nemení, čo produkt hovorí.
- **Autochladnička** určuje:
  - **Pás kľúčových faktov** pred popisom: objem, rozsah teplôt (odvodený z `temperature_min` a `temperature_max`), príkon, ovládanie cez Bluetooth. Ak produkt jeden z nich nemá, pás doplnia všeobecné fakty do štyroch.
  - **Technické parametre v skupinách** „Chladenie“, „Napájanie“, „Rozmery a hmotnosť“, „Výbava“ podľa kľúča atribútu (`cfm:attribute:<kľúč>`). Riadok, ktorý nepatrí do žiadnej skupiny, nezmizne: ide do „Ďalšie parametre“. Ak šablóna pozná menej než tri riadky, ostáva plochý zoznam ako doteraz.
  - **Samostatné karty**: porovnanie modelov (`#model-comparison`) a dokumenty (`#product-documents`) sa vyberú z popisu, dostanú vlastnú kartu a odkaz v navigácii stránky („Porovnanie modelov“, „Na stiahnutie“). Zdvihne sa len prvý blok každého druhu; ďalší ostane v popise.
  - **Hodnoty atribútov**: `warranty_years` sa píše s jednotkou a správnym tvarom („3 roky“, `product.content.years`), `cooling_modes` a `interior_components` sa rozdelia na položky podľa `|`.
- **Strešný nosič (sada)** (`stresny-nosic`) určuje:
  - **Samostatná karta „Technické parametre“** (`#technical-parameters`, odkaz v navigácii stránky): tabuľka parametrov (`maky:specs`) sa vyberie z popisu, nadpis je nadpis dokumentu. Šablóna nepotrebuje, aby sada niesla nejaký atribút: ak ich má (napríklad Výrobcu), pridajú sa v tej istej karte pod tabuľku, nič sa nezahodí. Ktoré atribúty nesú produkčné sady, sa nečítalo; stránka je skúšaná bez atribútov aj s jediným, Výrobcom. Zvyšok popisu (obsah balenia, výhody, použitie, upozornenia, typ strechy) ostáva v popise v poradí, v akom ho CFM napísal.
  - **Pás kľúčových faktov** zo štyroch prvých riadkov tabuľky parametrov, v poradí a znení, ako ich CFM napísal: hodnota nad názvom, **bez ikon**, lebo z textu riadku sa ikona nehádá. Riadok s hodnotou dlhšou než 48 znakov (veta) sa preskočí. Ak atribúty produktu dajú aspoň dva fakty, pás ostáva z atribútov a tabuľka doň nevstupuje. Aké riadky budú v páse, rozhoduje poradie riadkov v CFM; označiť riadok ako kľúčový by chcelo nový údaj od CFM.
  - **Výhody bez názvu** (položka je jedna veta bez `<strong>`) sa kreslia celé ako názov, rovnako ako názvy ostatných výhod. Platí pre každú šablónu.
  - Text „Kompatibilita“ v popise ostáva (nič sa nemaže); jeho vypustenie, keďže vozidlá ukazuje sekcia pod popisom, patrí k norme textov v2.
- **Názov, ktorý jednotku už hovorí.** Názov atribútu je v Saleore jeden pre všetky produkty a jednotku nesie v zátvorke: produkčné `warranty_years` je „Záruka (roky)“. Tabuľka parametrov píše názov vedľa hodnoty, takže „Záruka (roky) | 2 roky“ povie roky dvakrát; podľa hlásenia z nasadenia sa to stalo pri prvom nasadení tejto šablóny (4. 10. 2026, stránka TK20414), opravuje to samostatný PR. Preto tabuľka pri `warranty_years` a pri jednotkách, ktoré táto stránka pridala (`rated_power`, `net_volume`, `interior_height`, `input_current_ac`, `temperature_min`, `temperature_max`), nepíše jednotku, ktorú názov v zátvorke už hovorí: „Záruka (roky) | 2“, „Menovitý výkon (W) | 60“. Roky sa poznajú podľa slov z množného tvaru trhu (`product.content.years`: rok, roky, roka, rokov), merná jednotka podľa presnej značky; iná jednotka v zátvorke („(kW)“) sa za našu nepovažuje a naša ostane. Názov bez jednotky dostane jednotku ako doteraz („Záruka | 3 roky“, „Menovitý výkon | 60 W“), takže ak CFM atribút premenuje na „Záruka“, stránka bez zásahu napíše „3 roky“. Pás kľúčových faktov názov vedľa hodnoty nemá („Príkon 60 W“) a jednotku si necháva. Staršie jednotky (`weight`, `volume`, `max_load` a ďalšie) sa nemenia: tie sa vedľa názvov písali dávno a živé stránky ostávajú, aké sú.
- **Pevné slová** (druh poznámky, názvy skupín, „Rozsah teplôt“, „{min} až {max}“, „rok/roky/rokov“, navigácia) sú v `product.content.*` vo všetkých 12 jazykových súboroch. Texty blokov a názvy riadkov sú text zo Saleoru, takže v cudzom trhu sú v tom jazyku, v akom prišiel preklad popisu.

## Čo sa stane, keď niečo nesedí

Žiadny text sa nestratí. Čitateľ rozlišuje, čo je chyba producenta a čo by mohlo zákazníka poškodiť:

| Situácia                                                                                            | Výsledok                                                                  |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Neznáma major verzia                                                                                | Značky sa ignorujú, dokument je obyčajné bloky                            |
| Značka roly, ktorú čítačka nepozná                                                                  | Blok sa vykreslí ako štandardný blok, hlásenie `unknown-role` (`warn`)    |
| Značkovaný blok zlého nosiča, prázdna alebo nečitateľná položka, nebezpečný odkaz, FAQ bez odpovede | Blok sa vykreslí ako štandardný blok, hlásenie `malformed-block` (`warn`) |
| Varovanie (`maky:callout:warn`), ktoré by sa na stránke neobjavilo v žiadnej podobe                 | Hlásenie `warning-not-shown` so závažnosťou `error`                       |
| Neznámy názov ikony                                                                                 | Všeobecná značka                                                          |

Stránka každé hlásenie zapíše cez `console.error("[maky-content] …")` s indexom bloku a značkou, takže sa dá nájsť v logoch PM2. CFM kontroluje tie isté pravidlá pred zápisom (`maky_content.problems`), takže sa k zákazníkovi nedostane nič, čo by CFM sám odmietol.

## Tri spoločné ukážky

| Strana     | Súbor                                                                                                                                                                                                  | Čo ju drží                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| storefront | `docs/contracts/maky-content/coolz-32.description.json`, `gallery.description.json`, `set-thule-71732.description.json` a `PROVENANCE.json`                                                            | `src/lib/editorjs-content.test.ts` ich vykreslí a porovná odtlačky s provenance                                                                     |
| CFM        | `backend/apps/saleor_sync/storefront_contract/maky_content_coolz_32.description.json`, `maky_content_gallery.description.json`, `maky_content_set_thule_71732.description.json` (a jeho vstup `.html`) | `test_maky_content.py` ich znova vygeneruje z producenta a porovná bajty a odtlačky, `test_maky_content_sets.py` dokáže, že vstup je skutočný popis |

- **CoolZ 32** (TK20410) je skutočný popis zo skutočného dokumentu: úvod, tip, výhody, obsah balenia, kľúčové vlastnosti a natívna tabuľka porovnania.
- **Strešná sada Thule** (CFM pk 71732, Thule WingBar EVO Silver pre BMW X5 E70) je skutočný popis z plánu pilotných sád (pred normou textov v2), typovaný ako `maky-content/1:stresny-nosic` tou istou funkciou, ktorú volá publisher. Vstup (HTML skladača sád) je v CFM uložený vedľa a test dokazuje, že sa dá premeniť späť na dokument z plánu. Ukazuje úvod, kompatibilitu, obsah balenia, výhody, tabuľku parametrov, použitie, upozornenia, typ strechy a motto. V sandboxe z nej (a z troch ďalších skutočných sád, `scripts/sandbox/seed-roof-racks.mjs`) vzniknú produkty.
- **Galéria** je **vymyslená**: obsahuje každú rolu a druh poznámky aspoň raz (aj tie, ktoré CoolZ nepoužíva: poznámku, varovanie, kroky, otázky, parametre, dokumenty) a každú ikonu. Nepatrí k žiadnemu produktu a text je ukážkový. Vyrába ju ten istý kódovač ako popis chladničky, takže ukazuje presne to, čo producent vie napísať. Seed sandboxu z nej robí produkt „Ukážka blokov popisu (len sandbox)“ (SKU `SANDBOX-GALLERY`).

`PROVENANCE.json` nesie commit CFM, z ktorého vznikla, stav stromu (musí byť `clean`), pri každom súbore šablónu, ktorou je typovaný, sha256 a git blob id a odtlačky vstupov. Hodnoty CoolZ sú z onboarding manifestu a sada z popisu uloženého v pláne pilotných sád, nie z produkčnej databázy.

Obnova, keď sa zmení producent alebo profil, z čistého commitnutého stromu CFM:

```bash
cd CarFitManager-4/backend
python scripts/storefront_maky_content_sample.py --example <maky-storefront>/docs/contracts/maky-content
```

Skript prepíše súbory aj `PROVENANCE.json` tu, kópie v CFM a vypíše odtlačky pre `STOREFRONT_COPY`. Adresár je v `.prettierignore`: prepísanie formátovačom by zmenilo bajty.

## Čo je dokázané

- **Saleor 3.23.31 zostavený zo zdroja (sandbox):** `clean_editorjs` vráti popisy všetkých piatich chladničiek **nezmenené** a galériu nezmenenú, až na `rel="noopener noreferrer"`, ktoré Saleor pridá k odkazom. `productCreate` ich prijme a prečítaný dokument má bloky, `id` aj `version` rovnaké.
- **Storefront** z prečítaného dokumentu vykreslil CoolZ 32 aj galériu na desktope aj mobile, s atribútmi pripravenými v sandboxe (pozri nižšie).
- **Strešné sady:** typovanie prešlo na 36 skutočných popisoch (11 pilotných Thule a 25 Nordrive z rampy) a na skutočnom skladači. Saleor 3.23.31 zo zdroja (sandbox) uložil a vrátil štyri skutočné sady (tri Thule, jednu Nordrive) s rovnakými blokmi, `id` aj `version`, vrátane tabuľky parametrov. Storefront ich vykreslil na desktope aj mobile.
- **Ostatné produkty sa nemenia.** Jednorazovo overené proti čítačke z vetvy, od ktorej sa vychádzalo: 17 dokumentov bez profilu (doterajšie popisy, tabuľka porovnania, hraničné prípady) sa vykreslilo 34-krát bajt po bajte rovnako. Tá istá doterajšia čítačka ukáže každý reťazec oboch ukážok, len bez vzhľadu rolí.
- **Testy:** `src/lib/editorjs-content.test.ts` (každá rola, degradácia, zachovanie textu, XSS a odkazy, varovanie, pevné slová v 12 jazykoch, odtlačky ukážok), `src/lib/product-templates.test.ts` (register, zdvihnuté karty, zoskupenie parametrov, fakty zo sady), `src/ui/components/pdp/product-specs.test.ts` (karta parametrov a pás z ukážky sady) a `src/lib/product-attributes.test.ts` (roky, zoznamy, rozsah teplôt).

## Čo dokázané nie je a kto to uzavrie

1. **Že produkčný Saleor profil prijme, nikto nezmeral.** Sandbox beží na zdrojoch 3.23.31, produkcia hlási 3.23.31 podľa CFM záznamu zo 16. 9. 2026. **M** spustí na produkčnej inštancii v `manage.py shell` čistú funkciu, ktorá neprístupuje do databázy:
   ```python
   import json
   from saleor.core.editorjs.converters import clean_editorjs
   for name in ("coolz-32", "gallery"):
       clean_editorjs(json.load(open(f"{name}.description.json")))
   ```
   Obe musia vrátiť dokument s rovnakými blokmi.
2. **Produkčné atribúty chladničiek.** Šablóna zoskupuje parametre a berie fakty z atribútov `cfm:attribute:<kľúč>`. Sandbox atribúty (`scripts/sandbox/coolz-attributes.mjs`) sú **predpoklad**: kľúče a typy sú tie, ktoré CFM zapisuje (`ATTRIBUTE_TO_SPEC`), čísla sú z manifestu, ale názvy a textové hodnoty sú napísané po slovensky ručne. Uložený text niektorých riadkov je pravdepodobne anglický manifest (`compressor`, `2 wire baskets | 1 rack`). Rozhodujú iba `externalReference` atribútov a to, či `volume`, `rated_power`, `temperature_min` a `temperature_max` sú čisté čísla a `bluetooth_app_control` je BOOLEAN; názvy a textové hodnoty sú kozmetika a stránka ich ukazuje tak, ako ich má dnes. Kým sa skutočné riadky neprečítajú (`pnpm check:fridge`, časť „Nasadenie po rozhodnutí“ nižšie, bez zápisu), náhľad nedokazuje, ako bude vyzerať živá stránka. Zoskupenie spadne na plochý zoznam, keď sa nenájdu aspoň tri známe riadky; riadok výrobcu ide do „Ďalšie parametre“.
3. **Poradie nasadenia a prepínač.** Najprv storefront (čítačka a šablóna); s vypnutým prepínačom v CFM sa nezmení žiadny popis. Zmení sa ale zápis technických parametrov produktov, ktoré majú atribúty chladničky (päť CoolZ): jednotky pri `rated_power` (W), `net_volume` (l), `interior_height` (mm), `input_current_ac` (A) a `temperature_min`/`temperature_max` (°C), „3 roky“ namiesto „3“ pri `warranty_years` (pod produkčným názvom „Záruka (roky)“ ostáva „3“, lebo názov jednotku už hovorí) a zoznam namiesto „a | b“ pri `cooling_modes` a `interior_components`, ak sú hodnoty čisté čísla, resp. text oddelený `|` (`src/lib/product-attributes.ts`). Text, ktorý nie je čisté číslo, sa nemení, takže jednotka sa nezdvojí. Potom CFM zapne `CFM_SALEOR_MAKY_CONTENT_TEMPLATES` a znova publikuje popisy piatich chladničiek. **Marek rozhodol 4. 10. 2026 o 19:30 UTC „Áno, po kontrole“** (karta „Nasadiť šablónu autochladničky na päť stránok CoolZ?“, v jej texte bol presný zákaznícky účinok); postup a kontroly sú v časti „Nasadenie po rozhodnutí“ nižšie.
4. **Preklady.** Tok prekladu popisov musí zachovať `id` blokov a `version` dokumentu a tvar každého bloku. Kým sa neprekladá, zahraničné trhy majú slovenský text. Ak preklad značky stratí, dokument sa vykreslí ako obyčajné bloky: nič sa nestratí, len sa nenakreslia roly. Pilot beží na trhu SK.
5. **Saleor Dashboard.** Neoverené, či uloženie produktu v Dashboarde zachová `id` blokov a `version`; Dashboard má vlastný Editor.js. Kým to **M** neoverí na skutočnom Dashboarde, popisy CoolZ sa tam neupravujú.
6. **Revalidácia.** Stránka drží čítanie zo Saleoru v cache so značkou `product:<kanál>:<jazyk>:<slug>`; nový popis sa objaví do niekoľkých minút a jednej-dvoch návštev, alebo hneď po `POST /api/revalidate`. CFM to pri publikácii nevolá, takže je potrebné ju vyvolať ručne.
7. **Text tipu.** Tip CoolZ bol v zdroji napísaný v tykaní („vychlaď“, „nebudeš“), kým obchod vyká. V CFM je opravený ako deklarovaná oprava zachovaného textu („vychlaďte“, „nebudete“; päť chladničiek a CoolZ Power, CFM PR #50) a spoločná ukážka CoolZ 32 už nesie opravený text; storefront nič nemení. Na živom webe ostáva starý text, kým relácia na CFM serveri znova nezostaví a nepovýši dokumenty CoolZ a nepublikuje ich (postup je v CFM kontrakte `STOREFRONT_MAKY_CONTENT_V1.md`).
8. **Strešné sady: nič nie je nasadené.** Kód je v PR na oboch stranách, ostrá publikácia nebola. Poradie: najprv storefront (čítačka sady je v tom istom PR; staršia čítačka ukáže všetok text, len bez rolí), potom beh v CFM s `--typed-description` a so zapnutým `CFM_SALEOR_NATIVE_COMPARISON_TABLES`, najprv pre desať verejných pilotných sád Thule (`plan_sk_public_update`, plán sa pečatí a schvaľuje), až potom skryté sady pred aktiváciou. Počet sád, ktoré by typovanie zadržalo (HTML, ktoré skladač nenapísal), sa na celom katalógu zatiaľ nezmeral: je to len čítanie a robí ho relácia na serveri CFM.
9. **Čo návrh sady chce a CFM zatiaľ nemá.** Obrázok pri „Typ strechy“, samostatné pole „Kód“ v dlaždici obsahu balenia (kód je dnes v texte), skupiny parametrov (Nosnosť a rozmery, Konštrukcia, Upevnenie) a označenie, ktoré riadky tabuľky sú kľúčové pre pás. Každé z toho je nový údaj od CFM (strojový kľúč riadku, pole, obrázok), z textu sa nehádajú.

## Nasadenie po rozhodnutí

**Stav (4. 10. 2026, 21:51 UTC): vykonané pre všetkých päť CoolZ.** Storefront je nasadený od 20:34 UTC, CFM beží z release `f02b6d6` od 21:09 UTC a od 21:46 UTC z `f76d64c5` (`f02b6d6` + PR #49), popisy sa publikovali o 21:12 (CoolZ 32) a o 21:19 UTC (ostatné štyri), slovenské texty parametrov (predtým anglické hodnoty atribútov) o 21:49 UTC a stránky sú skontrolované na živom webe. Postup nižšie ostáva ako návod pre ďalšiu šablónu a pre návrat. Podrobnosti: `docs/storefront-4.5/current-state.md`.

**Rozhodnutie.** Marek 4. 10. 2026 o 19:30 UTC: „Áno, po kontrole“ na karte „Nasadiť šablónu autochladničky na päť stránok CoolZ?“. Platí pre túto šablónu na piatich CoolZ (19, 32, 40, 65, 83), nie pre iné produkty ani iné šablóny. Zákaznícky účinok, ktorý schválil, má dve časti:

- **A. Nasadenie storefrontu** (bez zásahu CFM): technické parametre piatich CoolZ sa píšu s jednotkami (`60 W`, `287 mm`, `0,26 A`, `−20 °C`; záruka ako `3 roky`, ak jej názov jednotku nehovorí, pod názvom „Záruka (roky)“ ostáva `3`), režimy chladenia a vnútorná výbava ako zoznam. Popisy sa nemenia.
- **B. Zapnutie prepínača a nová publikácia piatich popisov:** navrhnuté bloky v popise, pás kľúčových faktov pod nákupným boxom, zoskupené parametre a „Porovnanie modelov“ ako vlastná karta s odkazom v navigácii stránky.

„Po kontrole“ sú dve kontroly nižšie. Keď niektorá zlyhá tak, že zákazník by videl niečo iné než v časti B, publikácia sa zastaví a vráti sa s rozdielom: je to iný účinok, než Marek schválil.

**Poradie.** Každý produkčný krok robí relácia na príslušnom VPS a vyžaduje Marekovo „áno“ v jej vlákne.

1. **Kontrola produkčných atribútov** a **kontrola Saleoru** (nižšie), obe bez zápisu a pred akýmkoľvek nasadením: od atribútov závisí aj časť A zákazníckeho účinku, lebo jednotky dostanú iba čisté čísla.
2. **Storefront.** Zlúčiť PR #6 merge commitom, nie squashom (CFM pripína `a347602`), nasadiť `./scripts/ops/deploy-production.sh`. Po nasadení: CoolZ 32 má pri príkone `60 W` (nie `60`) a pri záruke `3` pod názvom „Záruka (roky)“ (nie `3 roky`: názov jednotku už hovorí); cena, sklad, popis a stránka iného produktu sú rovnaké.
3. **CFM.** Release s párovým PR (musí obsahovať aj to, čo na CFM serveri naozaj beží; pozri `STOREFRONT_MAKY_CONTENT_V1.md` v CFM). `CFM_SALEOR_MAKY_CONTENT_TEMPLATES=1` a `CFM_SALEOR_NATIVE_COMPARISON_TABLES=1` iba pre beh publisheru, potom nová publikácia popisov cez TAZAR: **CoolZ 32 (TK20410) prvá**, skontrolovať skutočnú stránku (nižšie), potom TK20409, TK20411, TK20412 a TK20413.
4. **Návrat.** Prepínač vypnúť a päť popisov znova publikovať: popisy sa vrátia na dnešný tvar z toho istého uloženého dokumentu. Jednotky pri parametroch sú vec storefrontu; vrátiť ich znamená vrátiť jeho build.

### Kontrola produkčných atribútov

```bash
node --env-file=/opt/storefront/.env scripts/checks/fridge-attributes.mjs --verbose
```

Skript (`pnpm check:fridge`) pošle jeden GraphQL `query` bez tokenu, nič nezapisuje, nepotrebuje build a adresu nevypisuje. Je v PR #6, takže sa spustí z ľubovoľného checkoutu s touto vetvou (po zlúčení aj z `/opt/storefront`; nič nestavia ani nerestartuje). Dá sa spustiť aj nad uloženou odpoveďou (`--from-file`) a `--json` dá strojový výstup. Zákaznícky účinok A aj B platí, keď pre **každú** z piatich CoolZ (SKU TK20409 až TK20413) platí:

- kanál `sk-eur` ju vráti v kategórii `autochladnicky`;
- `cfm:attribute:volume`, `cfm:attribute:rated_power`, `cfm:attribute:temperature_min` a `cfm:attribute:temperature_max` sú riadky s názvom a **čistým číslom** (`60`, `-20`, `0,26`), nie textom („60 W“, „-20 °C“): iba čisté číslo dostane jednotku a tvorí fakt v páse;
- aspoň tri riadky sú pomenované šablónou (v praxi ich je viac ako dvadsať); pod tri ostanú parametre jedným plochým zoznamom;
- `cfm:attribute:bluetooth_app_control` je BOOLEAN. „Nie“ alebo chýbajúci riadok je iba poznámka: pás má vtedy menej faktov.

`PASS` = pokračovať. `FAIL` pomenuje produkt a riadok; hodnoty sa opravujú v zdroji (CFM), nie v storefronte, a ak by oprava zmenila zákaznícky účinok, vráť sa s rozdielom. Textové hodnoty („Kompresor“ alebo „compressor“, „2 drôtené koše | 1 rošt“) skript nesúdi: stránka ich ukáže tak, ako ich má dnes, preto si ich pozri vo výstupe `--verbose`. Skript číta, čo šablóna pomenúva, priamo z `src/lib/product-templates.ts` a jeho test (`src/lib/fridge-attributes-script.test.ts`) drží zhodu s kódom stránky.

### Kontrola Saleoru

Čistá funkcia `clean_editorjs` na oboch ukážkach (príkaz je pri bode 1 v časti „Čo dokázané nie je“ vyššie) v `manage.py shell` produkčného Saleoru; nezapisuje. Obe musia vrátiť dokument s rovnakými blokmi; jediný povolený rozdiel je `rel="noopener noreferrer"`, ktoré Saleor pridá k odkazom.

### Kontrola živej stránky

Po publikácii CoolZ 32. CFM stránku nerevaliduje, takže nová verzia sa objaví po niekoľkých minútach alebo hneď po `POST /api/revalidate`.

```bash
curl -s https://maky.store/sk/<slug> | grep -o 'maky-callout-tip\|maky-benefits\|maky-inbox\|maky-features\|maky-sg\|id="model-comparison"\|aria-label="Hlavné vlastnosti"' | sort | uniq -c
```

`<slug>` vypíše skript pri každom produkte. Pred publikáciou nie je v stránke ani jeden z týchto reťazcov; po nej je každý aspoň raz (overené na vykreslení zo sandboxu). V `pm2 logs maky-storefront` nesmie pribudnúť riadok `[maky-content]`. Cena, sklad a stránka iného produktu sú rovnaké ako pred publikáciou. Potom pohľad v prehliadači na desktope aj mobile: automatická kontrola nevidí napríklad bezfarebné tlačidlo (CLAUDE.md §4.2).

## Čo to nerobí

- Neposiela `soldSeparately`, `video` ani `products` z návrhu (v dátach nie sú a Saleor ich pri popise neuloží).
- Nerobí z popisu druhý register parametrov: parametre autochladničky sú atribúty produktu a šablóna ich len zoskupuje. Parametre strešnej sady sú tabuľka v popise (nie atribúty; šablóna sa o ne neopiera) a pás faktov z nej preberie len prvé riadky tak, ako sú napísané; nič nepočíta, neprepisuje a nehádá z nich ikonu.
- Nemení stránky kategórií bez šablóny: ďalšia šablóna je nový záznam v registri a nový zoznam skupín, nie nová čítačka.
