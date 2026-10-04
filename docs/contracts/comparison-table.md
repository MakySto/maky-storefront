# Porovnávacia tabuľka modelov · kontrakt storefront ↔ CFM

Profil „Saleor-safe comparison table“, verzia 1. Pilot: CoolZ 19 / 32 / 40 / 65 / 83.

**Kto čo vlastní.** Profil, teda čo storefront vie prečítať a zobraziť, vlastní storefront, lebo je konzument. Jedinú ukážku, proti ktorej testujú obe strany, generuje CFM, lebo je producent. Bajty ukážky sú v oboch repozitároch rovnaké a každá strana ich pripína odtlačkom, takže sa jedna nemôže potichu rozísť s druhou. Druhá schéma nevznikla: tabuľka je obyčajný Editor.js blok `table`, ktorý Saleor sám ukladá a vracia.

## Čo producent posiela

Tabuľka je blok `table` v poli `description` produktu a bezprostredne nad ním je blok `header` s nadpisom („Porovnanie modelov PRO-USER CoolZ“). Pri CoolZ je to posledný blok popisu. Skrátený príklad, celá tabuľka je v ukážke:

```json
{
	"type": "table",
	"data": {
		"withHeadings": true,
		"content": [
			["Parameter", "CoolZ 19", "<mark>CoolZ 32</mark>", "CoolZ 40", "CoolZ 65", "CoolZ 83"],
			["Objem a výkon", "", "", "", "", ""],
			["Menovitý objem", "19 l", "32 l", "40 l", "65 l", "83 l"],
			["Dual Zone", "✗", "✗", "✗", "✗", "✓"],
			["Čistý objem", "—", "—", "—", "—", "82,5 l"],
			["Hlučnosť", "&lt; 45 dB", "&lt; 45 dB", "&lt; 45 dB", "&lt; 45 dB", "&lt; 45 dB"]
		]
	}
}
```

- Blok nesie iba `withHeadings: true` a `content`. Saleor 3.23 zahodí každé iné pole (okrem `stretched`), takže poslať viac nemá zmysel.
- Každá bunka je reťazec, všetky riadky majú rovnakú šírku, riadkov je aspoň dva a stĺpcov aspoň tri (názov vlastnosti a aspoň dva modely).
- Prvý riadok je hlavička. Jeho prvá bunka je „Parameter“, ďalej idú názvy modelov. Model, ktorého stránka sa zobrazuje, je v hlavičke v `<mark>…</mark>`, práve jeden.
- Riadok časti má vyplnenú prvú bunku a všetky ostatné prázdne (`""`).
- Hodnotový riadok: názov vlastnosti a jedna hodnota na model. `✓` je áno, `✗` je nie, `—` je „model túto vlastnosť nemá“. Ostatné je text aj s jednotkou: `82,5 l`, `−20 °C až +20 °C`, `100–240 V AC`. Znak `<` ide ako `&lt;`, lebo Saleor čistí bunky a entitu ponechá.
- Iné značky v bunkách okrem `<mark>` v hlavičke neexistujú. Cenový riadok v pilote nie je: dizajn ho má len pri porovnaní odvodenom zo SKU.

## Čo z toho storefront urobí

Tabuľka je porovnanie, ak má hlavičku, aspoň tri rovnako široké stĺpce a aspoň jednu vlastnú značku: označenú hlavičku, riadok časti alebo `✓` / `✗`. Každá iná tabuľka zostáva bežnou tabuľkou.

- **Aktuálny model** má zvýraznený stĺpec a menovku „Tento model“. Ak nie je označená práve jedna hlavička (žiadna alebo viac), nezvýrazní sa nič.
- **Časti** sú riadky nadpisov. **Čo je rovnaké pre všetky modely** storefront odvodí z hodnôt a zoradí do jedného pásu „Rovnaké pre všetky modely“ na konci, ale iba ak sa aspoň jeden iný riadok líši. Producent takú skupinu nezapisuje, takže pás nie je druhý názor na to, čo je rovnaké.
- **`✓` / `✗`** sa zobrazia ako lokalizované „Áno“ / „Nie“ (`product.yes`, `product.no`), `—` ako tlmená pomlčka.
- **Nadpis** nad tabuľkou sa stane jej titulkom, vedľa je popisok s počtom modelov v jazyku trhu.
- **Mobil.** Prvý stĺpec ostáva na mieste, tabuľka sa posúva vodorovne a začína pri aktuálnom modeli. Oblasť posunu je dostupná z klávesnice a má názov pre čítačky.
- **Pevné slová** (menovka, „Parameter“ pre čítačky, pás, popisok, Áno/Nie) sú v `product.comparison.*` vo všetkých 12 jazykových súboroch. Názvy riadkov a častí sú text zo Saleoru, takže v cudzom trhu sú v tom jazyku, v akom prišiel preklad popisu.

## Jedna spoločná ukážka

| Strana     | Súbor                                                                                     | Čo ju drží                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| storefront | `docs/contracts/comparison-table/coolz-32.description.json` a `PROVENANCE.json`           | `src/lib/editorjs-comparison.test.ts` ju vykreslí a porovná odtlačky s provenance             |
| CFM        | `backend/apps/saleor_sync/storefront_contract/comparison_table_coolz_32.description.json` | `test_native_comparison_table.py` ju znova vygeneruje z producenta a porovná bajty a odtlačky |

Ukážka je CoolZ 32 (TK20410) s natívnou tabuľkou, presne to, čo by CFM poslal do Saleoru. Hodnoty sú z onboarding manifestu, nie z produkčnej databázy. `PROVENANCE.json` nesie commit CFM, z ktorého vznikla, stav stromu (musí byť `clean`), sha256 a git blob id súboru a odtlačky vstupov.

Obnova, keď sa zmení producent alebo profil, z čistého commitnutého stromu CFM:

```bash
cd CarFitManager-4/backend
python scripts/storefront_comparison_sample.py --example <maky-storefront>/docs/contracts/comparison-table
```

Skript prepíše súbor aj `PROVENANCE.json` tu, kópiu v CFM a vypíše odtlačky pre `STOREFRONT_COPY`. Adresár je v `.prettierignore`: prepísanie formátovačom by zmenilo bajty.

## Čo je dokázané

- Saleor 3.23.31 zostavený zo zdroja (sandbox): výstup CFM pre všetkých päť modelov sa zapísal a prečítal späť s bunkami bajt po bajte rovnakými. Ukážka prešla aj čistou funkciou Saleoru `saleor.core.editorjs.converters.clean_editorjs` bez zmeny.
- Storefront z prečítaného dokumentu vykreslil tabuľku s aktuálnym modelom na desktope aj mobile.

## Čo dokázané nie je a kto to uzavrie

1. **Že produkčný Saleor `table` prijme, nikto nezmeral.** Verzia 3.22.50 ho odmietla (`Unsupported block type: 'table'`, TKS30011, 28. 7. 2026), CFM záznam z 16. 9. 2026 (krok 0a, 0 mutácií) už hlási 3.23.31. Overenie nič nezapisuje. **M** spustí na produkčnej inštancii v `manage.py shell` čistú funkciu, ktorá neprístupuje do databázy:
   ```python
   import json
   from saleor.core.editorjs.converters import clean_editorjs   # 3.22.x: saleor.core.utils.editorjs.clean_editor_js
   clean_editorjs(json.load(open("coolz-32.description.json")))
   ```
   Ak vráti dokument s blokom `table`, môže sa zapnúť prepínač. Ak zlyhá, CFM posiela naďalej zoznam a storefront ho zobrazuje ako doteraz.
2. **Prepínač a nová publikácia CoolZ.** CFM posiela tabuľku, iba keď je `CFM_SALEOR_NATIVE_COMPARISON_TABLES` zapnutý (štandardne vypnutý). Vykonávateľ CFM ho zapne v prostredí publisheru a existujúcou cestou znova publikuje päť popisov CoolZ. Pred každým zápisom publisher overí profil tabuľky. Zákaznícky účinok je jediný: na piatich stránkach CoolZ sa „Porovnanie modelov“ zmení zo zoznamu sedemnástich riadkov na túto tabuľku. Cena, sklad ani iné produkty sa nemenia. Toto je jediné produkčné rozhodnutie pilotu.
3. **Preklady.** Tok prekladu popisov musí zachovať tvar tabuľky: rovnaký počet riadkov a stĺpcov, `<mark>`, `✓` `✗` `—` a prázdne bunky riadkov častí. Kým sa neprekladá, zahraničné trhy majú slovenské názvy riadkov. Pilot beží na trhu SK.
4. **Saleor Dashboard.** Neoverené, či uloženie produktu v Dashboarde zachová blok `table`; Dashboard má vlastný Editor.js. Kým to **M** neoverí na skutočnom Dashboarde, popisy CoolZ sa tam neupravujú.
5. **Poradie a čo uvidí stránka.** Najprv sa nasadí storefront s čítačkou tabuľky (táto zmena), až potom sa zapne prepínač. Starší storefront by ten istý blok nakreslil ako obyčajnú tabuľku, bez menovky „Tento model“, zvýraznenia stĺpca a pásu rovnakých hodnôt. Stránka produktu drží čítanie zo Saleoru v cache so značkou `product:<kanál>:<jazyk>:<slug>` (profil `minutes`), takže sa nový popis zobrazí sám do niekoľkých minút a po jednej či dvoch návštevách (stale-while-revalidate), alebo hneď po `POST /api/revalidate`; klient je v CFM `apps/products/services/storefront_revalidation.py` a publisher TAZAR ho nevolá. Po publikácii skontrolovať skutočnú stránku, nielen dopyt: `curl -s https://maky.store/sk/<slug> | grep -o 'class="maky-cmp"' | wc -l` musí vypísať `1` a stĺpec s menovkou „Tento model“ musí byť model tej stránky.
