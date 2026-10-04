# Typovaný popis produktu · kontrakt storefront ↔ CFM

Profil „maky-content“, verzia 1. Šablóna: autochladnička (pilot CoolZ 19 / 32 / 40 / 65 / 83, ďalšie autochladničky). Dizajn: „Šablóny produktových stránok“ z 2. 10. 2026, fáza 2.

**Kto čo vlastní.** Profil, teda čo storefront vie prečítať a zobraziť, vlastní storefront, lebo je konzument. Dve ukážky, proti ktorým testujú obe strany, generuje CFM, lebo je producent. Bajty ukážok sú v oboch repozitároch rovnaké a každá strana ich pripína odtlačkom, takže sa jedna nemôže potichu rozísť s druhou. Druhá schéma nevznikla: popis je obyčajný Editor.js dokument zložený z blokov, ktoré Saleor sám ukladá a vracia.

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
			"data": { "text": "Pred výletom vychlaď chladničku doma …" }
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

## Dve spoločné ukážky

| Strana     | Súbor                                                                                                                          | Čo ju drží                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| storefront | `docs/contracts/maky-content/coolz-32.description.json`, `gallery.description.json` a `PROVENANCE.json`                        | `src/lib/editorjs-content.test.ts` ich vykreslí a porovná odtlačky s provenance     |
| CFM        | `backend/apps/saleor_sync/storefront_contract/maky_content_coolz_32.description.json`, `maky_content_gallery.description.json` | `test_maky_content.py` ich znova vygeneruje z producenta a porovná bajty a odtlačky |

- **CoolZ 32** (TK20410) je skutočný popis zo skutočného dokumentu: úvod, tip, výhody, obsah balenia, kľúčové vlastnosti a natívna tabuľka porovnania.
- **Galéria** je **vymyslená**: obsahuje každú rolu a druh poznámky aspoň raz (aj tie, ktoré CoolZ nepoužíva: poznámku, varovanie, kroky, otázky, parametre, dokumenty) a každú ikonu. Nepatrí k žiadnemu produktu a text je ukážkový. Vyrába ju ten istý kódovač ako popis chladničky, takže ukazuje presne to, čo producent vie napísať. Seed sandboxu z nej robí produkt „Ukážka blokov popisu (len sandbox)“ (SKU `SANDBOX-GALLERY`).

`PROVENANCE.json` nesie commit CFM, z ktorého vznikla, stav stromu (musí byť `clean`), sha256 a git blob id súborov a odtlačky vstupov. Hodnoty CoolZ sú z onboarding manifestu, nie z produkčnej databázy.

Obnova, keď sa zmení producent alebo profil, z čistého commitnutého stromu CFM:

```bash
cd CarFitManager-4/backend
python scripts/storefront_maky_content_sample.py --example <maky-storefront>/docs/contracts/maky-content
```

Skript prepíše súbory aj `PROVENANCE.json` tu, kópie v CFM a vypíše odtlačky pre `STOREFRONT_COPY`. Adresár je v `.prettierignore`: prepísanie formátovačom by zmenilo bajty.

## Čo je dokázané

- **Saleor 3.23.31 zostavený zo zdroja (sandbox):** `clean_editorjs` vráti popisy všetkých piatich chladničiek **nezmenené** a galériu nezmenenú, až na `rel="noopener noreferrer"`, ktoré Saleor pridá k odkazom. `productCreate` ich prijme a prečítaný dokument má bloky, `id` aj `version` rovnaké.
- **Storefront** z prečítaného dokumentu vykreslil CoolZ 32 aj galériu na desktope aj mobile, s atribútmi pripravenými v sandboxe (pozri nižšie).
- **Ostatné produkty sa nemenia.** Jednorazovo overené proti čítačke z vetvy, od ktorej sa vychádzalo: 17 dokumentov bez profilu (doterajšie popisy, tabuľka porovnania, hraničné prípady) sa vykreslilo 34-krát bajt po bajte rovnako. Tá istá doterajšia čítačka ukáže každý reťazec oboch ukážok, len bez vzhľadu rolí.
- **Testy:** `src/lib/editorjs-content.test.ts` (každá rola, degradácia, zachovanie textu, XSS a odkazy, varovanie, pevné slová v 12 jazykoch, odtlačky ukážok), `src/lib/product-templates.test.ts` (register, zdvihnuté karty, zoskupenie parametrov) a `src/lib/product-attributes.test.ts` (roky, zoznamy, rozsah teplôt).

## Čo dokázané nie je a kto to uzavrie

1. **Že produkčný Saleor profil prijme, nikto nezmeral.** Sandbox beží na zdrojoch 3.23.31, produkcia hlási 3.23.31 podľa CFM záznamu zo 16. 9. 2026. **M** spustí na produkčnej inštancii v `manage.py shell` čistú funkciu, ktorá neprístupuje do databázy:
   ```python
   import json
   from saleor.core.editorjs.converters import clean_editorjs
   for name in ("coolz-32", "gallery"):
       clean_editorjs(json.load(open(f"{name}.description.json")))
   ```
   Obe musia vrátiť dokument s rovnakými blokmi.
2. **Produkčné atribúty chladničiek.** Šablóna zoskupuje parametre a berie fakty z atribútov `cfm:attribute:<kľúč>`. Sandbox atribúty (`scripts/sandbox/coolz-attributes.mjs`) sú **predpoklad**: kľúče a typy sú tie, ktoré CFM zapisuje (`ATTRIBUTE_TO_SPEC`), čísla sú z manifestu, ale názvy a textové hodnoty sú napísané po slovensky ručne. Uložený text niektorých riadkov je pravdepodobne anglický manifest (`compressor`, `2 wire baskets | 1 rack`). Kým sa neprečítajú skutočné riadky cez `ro_prod`, náhľad nedokazuje, ako bude vyzerať živá stránka. Zoskupenie spadne na plochý zoznam, keď sa nenájdu aspoň tri známe riadky; riadok výrobcu ide do „Ďalšie parametre“.
3. **Poradie nasadenia a prepínač.** Najprv storefront (čítačka a šablóna); s vypnutým prepínačom v CFM sa nezmení žiadny popis. Zmení sa ale zápis technických parametrov produktov, ktoré majú atribúty chladničky (päť CoolZ): jednotky pri `rated_power` (W), `net_volume` (l), `interior_height` (mm), `input_current_ac` (A) a `temperature_min`/`temperature_max` (°C), „3 roky“ namiesto „3“ pri `warranty_years` a zoznam namiesto „a | b“ pri `cooling_modes` a `interior_components`, ak sú hodnoty čisté čísla, resp. text oddelený `|` (`src/lib/product-attributes.ts`). Text, ktorý nie je čisté číslo, sa nemení, takže jednotka sa nezdvojí. Potom CFM zapne `CFM_SALEOR_MAKY_CONTENT_TEMPLATES` a znova publikuje popisy piatich chladničiek. Ide o jediné produkčné rozhodnutie: **Marek** musí rozhodnúť s presným zákazníckym účinkom, ktorý je v zadaní PR. Do vtedy existuje iba integrovaný náhľad v sandboxe.
4. **Preklady.** Tok prekladu popisov musí zachovať `id` blokov a `version` dokumentu a tvar každého bloku. Kým sa neprekladá, zahraničné trhy majú slovenský text. Ak preklad značky stratí, dokument sa vykreslí ako obyčajné bloky: nič sa nestratí, len sa nenakreslia roly. Pilot beží na trhu SK.
5. **Saleor Dashboard.** Neoverené, či uloženie produktu v Dashboarde zachová `id` blokov a `version`; Dashboard má vlastný Editor.js. Kým to **M** neoverí na skutočnom Dashboarde, popisy CoolZ sa tam neupravujú.
6. **Revalidácia.** Stránka drží čítanie zo Saleoru v cache so značkou `product:<kanál>:<jazyk>:<slug>`; nový popis sa objaví do niekoľkých minút a jednej-dvoch návštev, alebo hneď po `POST /api/revalidate`. CFM to pri publikácii nevolá, takže je potrebné ju vyvolať ručne.
7. **Text tipu.** Tip CoolZ je v zdroji napísaný v tykaní („vychlaď“, „nebudeš“), kým obchod vyká. Mení sa v zdrojovom dokumente v CFM, nie v storefronte.

## Čo to nerobí

- Neposiela `soldSeparately`, `video` ani `products` z návrhu (v dátach nie sú a Saleor ich pri popise neuloží).
- Nerobí z popisu druhý register parametrov: parametre sú atribúty produktu, šablóna ich len zoskupuje.
- Nemení stránky ostatných kategórií: strešné nosiče a ďalšie šablóny sú ďalší krok, ktorý pridá meno do registra a nový zoznam skupín, nie novú čítačku.
