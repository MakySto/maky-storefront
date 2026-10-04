# Storefront 4.5 — spoločný aktuálny stav

Počiatočná snímka v2.0 · 4. 10. 2026 (text z balíka; po založení sa mení riadok SF-2, bod o vetvách CoolZ pilotu a sekcia „Posledná delta“). Tento súbor je od založenia živý stav na integračnej vetve: aktualizuje sa tu, nie súčasne v Library, pamäti a ďalšom STATUS.md. Integračné handoffy ostávajú zdrojmi podrobných dôkazov.

## Pôvod údajov

ChatGPT pri príprave v2.0 čítal oba ZIP-y, ostatné prílohy, CLAUDE.md/AGENTS.md a dva živé GitHub refy. Nepripájal sa na VPS, netestoval aplikáciu, nemenil repozitár ani produkciu. Runtime nižšie je hlásenie M z 4. 10. 08:12–08:21 UTC. Otvorené integračné nálezy z 3. 10. sa nestrácajú len preto, že novší súhrn je nespomína.

## Git a posledné hlásené nasadenie

- **GitHub overený pri v2.0:** `main = be64a695e57e9cca0fccb2a53ff774c25b0bd109`.
- **GitHub overený pri v2.0:** `release/r1-thule-20261001 = 6e0f378f44d2d5e2871258492623e9f68e5479fe`. Toto je počiatočný vývojový a PR základ.
- **M hlási produkciu:** `fab2985ab1d7df8703e53a6ff05df9b965dc8701`, BUILD_ID `F2fH6eFtARQRLHD7LGRR9`, build 1. 10. 21:23:35 UTC. Jeden obsluhujúci storefrontový proces.
- **M hlási SYNC-1:** SF `claude/sync1-release-manifest @ a848d82`; CFM PR #46 `c98094a`; nenasadené. V2.0 znovu neoveroval hroty týchto dvoch kandidátov.
- **M hlási kolo 8:** `feat/round8-category-root-urls @ b74a652` iba na VPS, nepushnuté.
- **Vetvy CoolZ pilotu (4. 10.):** storefront `claude/storefront-45-coolz-pilot-7n5gmo` z `release/r1-thule-20261001 @ 6e0f378`, PR #3 proti tej istej vetve; CFM `claude/storefront-45-coolz-pilot-7n5gmo` z `master @ a226a28`, PR #47 proti `master`. Detail v poslednej delte nižšie.
- Dlhodobé zosúladenie `main` je odporúčaná Git údržba. Nie je podmienkou začatia: nové vlákno má explicitný správny základ. Zmenu vzdialeného `main` tento balík nevykonal.

## Posledné hlásené dáta a funkcie

- Fitment `3.0.0-full-20261001.2`, hash `394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9`, podľa M `stale:false`. **staleAfter 31. 10. 2026 17:48:14 UTC**. Je to termín obnovy datasetu, nie dôkaz jeho aktuálneho poškodenia.
- Texty vozidiel `20260915.2`; opravená sada `20261001` s 56 úvodmi pripravená, podľa M nenainštalovaná.
- M hlási 12 živých/indexovateľných trhov; SK 18 721 produktov, zahraničné kanály po 9 157, Nordrive. Počty sú snímka, nie navždy očakávané hodnoty testov.
- Výber vozidla, Garáž a kompatibilita existujú. Košík podľa M používa aktuálne vybrané auto a neukladá vozidlo pri vložení položky.
- Payload konzument v3 podľa M nasadený; chýba `storefront-obrazky`, `categoryShowcase` konzument a časť homepage/kampaní. Presný rozsah ďalšieho CMS míľnika prevziať pri tej úlohe.
- M overil homepage/CSS, nie nový úplný nákupný priechod. RSS bod ani starý počet bailoutov nie sú dôkaz memory leaku alebo dôvod blokovať všetku prácu.

## Práca a najbližší výsledok

Vlastník je zodpovedný za dokončenie, nie trvalé výhradné oprávnenie. Pri prevzatí stačí aktuálna dohoda a krátka delta. Neaktívna alebo skončená stará relácia nie je dôvod čakať na špeciálny formulár; nadviazať treba na jej poslednú prácu bez duplicity.

| ID    | Stav / dnešný vykonávateľ podľa podkladov            | Najbližší užitočný výsledok                                                                                                                           |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| SF-2  | Pilot hotový, PR #3 (SF) a #47 (CFM); Marek: áno     | Kontrola Saleoru bez zápisu, potom nasadenie storefrontu, prepínač a publikácia piatich popisov (kroky v delte 4. 10. 14:02 UTC). Ďalšie bloky: SF-3. |
| SF-1a | 56 úvodov pripravených; existujúce M                 | Doručiť už opravený obsah a ukázať dotknutú stránku bez nepravdivej vety. Neopakovať výrobu dát ani celý audit vozidiel.                              |
| SF-1b | SYNC-1 kandidát; existujúce M + CFM                  | Dokončiť existujúcu implementáciu vrátane reálne automatickej publikácie. Konkrétne otvorené nálezy sú v handoffe §4; nie nový všeobecný audit.       |
| SF-1c | CFM export, storefront prevzatie                     | Včas obnoviť dataset pred staleAfter.                                                                                                                 |
| SF-1e | Hlásený chybný CSS limit v deploy smoke              | Opraviť nesprávne kritérium; nezrušiť overenie reálne načítaných štýlov.                                                                              |
| SF-8  | Hotová lokálna vetva; existujúce M                   | Uchovať/pushnúť prácu, zosúladiť so súčasnou integráciou a dokončiť kategóriové URL/404. Vývoj nemusí čakať na všetky ostatné oblasti.                |
| SF-3  | Návrh                                                | Po prvom CoolZ potrebné bloky a kompletná prezentácia; reprezentatívne sady s kitom aj bez.                                                           |
| SF-4  | Jasný zákaznícky smer; medzera košíka známa          | Jednotný výber a položkové vozidlo, zachovanie Thule kategórie. Nečakať na opätovné poslanie už známych požiadaviek.                                  |
| SF-5  | Existujúci CMS konzument, ďalšie funkcie nedokončené | Konkrétna redakčná zmena viditeľná v náhľade aj po publikovaní.                                                                                       |
| SF-6  | Priebežná kvalita                                    | Cielené SEO/výkon pri dotknutých cestách, nie ďalší audit všetkého.                                                                                   |

Prvé odporúčané súbežné výsledky sú CoolZ a dokončenie už rozpracovanej obsahovej integrácie. To nie je trvalý limit dvoch vlákien. Aktívny zákaznícky incident môže dostať prednosť.

## Posledná delta

**4. 10. 2026** — pripravený jednotný balík v2.0. Žiadny deploy, merge, zmena main, import pamäte ani pripojenie VPS sa touto prípravou nevykonali. Existujúce schválené úlohy pokračujú; tento súbor nepredstiera nové produkčné schválenie.

**4. 10. 2026 (vlákno CoolZ pilot)** — projekt prevzal Goal a Project instructions v2.0. Do zdieľanej pamäte tohto cloudového projektu sa uložili `MEMORY.md` (index) a `decisions.md` (kvôli limitu 4 KB na súbor pamäte v dvoch súboroch, text nezmenený); nešlo o import do Codexu ani do lokálneho vlákna. Tento súbor je založený na vetve `claude/storefront-45-coolz-pilot-7n5gmo`, ktorá vychádza z `release/r1-thule-20261001 @ 6e0f378`. Nová vetva nemení stav SYNC-1, kola 8 ani 56 úvodov; tie ostávajú u existujúceho M/CFM.

**4. 10. 2026 (vlákno CoolZ pilot, výsledok)** — porovnávacia tabuľka CoolZ 19 / 32 / 40 / 65 / 83 je hotová ako integrovaný náhľad a pripravený release. Do živého katalógu sa nič nezapísalo a produkčný Saleor ani CFM sa nemenili.

- **Čo zákazník dostane.** Po nasadení tohto kódu a po zapnutí prepínača v CFM sa na piatich stránkach CoolZ „Porovnanie modelov“ zmení zo zoznamu sedemnástich riadkov na tabuľku: stĺpec na model, tri časti, pás „Rovnaké pre všetky modely“, zvýraznený aktuálny model s menovkou „Tento model“, správne hodnoty a jednotky podľa návrhu. Na mobile ostáva prvý stĺpec na mieste a tabuľka sa posúva vodorovne od aktuálneho modelu. Kým CFM tabuľku nepošle, stránka vyzerá ako doteraz. Cena, sklad a ostatné produkty sa nemenia.
- **Commity.** Storefront: `3a9dae7` tabuľka (čítanie bloku `table`, vykreslenie, 12 jazykov, kontrakt a spoločná ukážka), `57064ab` CLAUDE.md a AGENTS.md podľa REPO_RULES_DELTA, `6e28498` sandbox skripty a návod (`docs/storefront-4.5/sandbox.md`), `16c0a30` tento súbor. CFM: `2757cba` producent a prepínač `CFM_SALEOR_NATIVE_COMPARISON_TABLES` (štandardne vypnutý), `9baaa02` kontrakt `STOREFRONT_COMPARISON_TABLE_V1.md`.
- **Jedna ukážka, nie dve schémy.** CoolZ 32 vygeneroval skutočný producent CFM; tie isté bajty sú v oboch repozitároch (`docs/contracts/comparison-table/` a `storefront_contract/`), pripnuté odtlačkom sha256 a git blob id, s provenance z čistého commitu. Profil vlastní storefront (konzument), ukážku CFM (producent).
- **Overené.** Producent CFM → zápis do Saleoru 3.23.31 (zostaveného zo zdroja, sandbox) → nové čítanie → storefront v produkčnom builde: 5 z 5 modelov, bunky tabuľky bajt po bajte rovnaké, práve jedna tabuľka, zvýraznený správny model, všetky názvy modelov, riadkov a častí na stránke (`scripts/sandbox/roundtrip-coolz.mjs`). `next build` prešiel (88 stránok), `pnpm check:css` v poriadku, lint bez chýb, `tsc` čisté, `pnpm test:run` 3433 prešlo (59 nových). CFM: 62 nových testov, prepínač overený vo všetkých šiestich miestach. Desktop 1440 aj mobil 360 skontrolované v Chromiu, bez vodorovného posunu stránky. Nákup v sandboxe: stránka, košík, pokladňa krok 1 a 2 s dopravou, spolu 283,90 €; platba v sandboxe nie je.
- **Zostáva a komu.**
  1. **Kontrola Saleoru bez zápisu:** mala ju robiť M, jeho relácia je archivovaná; preberá ju relácia s prístupom k produkčnému Saleoru. Verzia 3.22.50 blok `table` odmietla (TKS30011, 28. 7. 2026), záznam z 16. 9. 2026 hlási 3.23.31, ale tabuľku cez produkčný validátor nikto neprepustil. Postup je v rozhodnutí nižšie. Kým kontrola neprejde, prepínač ostáva vypnutý.
  2. **Marek:** rozhodol 4. 10. 2026 o 14:02 UTC, „Áno, po kontrole“ (nižšie). Ďalšie technické kroky samostatné schválenie nepotrebujú.
  3. **Vykonávateľ CFM:** nebol dosiahnuteľný, preto je zadanie vypísané v `STOREFRONT_COMPARISON_TABLE_V1.md` (CFM PR #47) a závislosť ostáva. Aj tam: PG testy `test_pg_coolz_phase_c.py::test_v2_promotion_*` padajú už na `master @ a226a28` (prázdny `render_dependency_hash` vo fixture), preto treba pred zapnutím overiť skutočnú dráhu povýšenia.
  4. **Preklady a Dashboard:** tok prekladu popisov musí zachovať tvar tabuľky (riadky, stĺpce, `<mark>`, ✓ ✗ —); do overenia na skutočnom Dashboarde sa popisy CoolZ v ňom neupravujú. Pilot beží na trhu SK.
  5. **Ďalšie:** cenový riadok v pilote nie je (návrh ho má len pri porovnaní odvodenom zo SKU); ostatné bloky podľa SF-3.
- **Nálezy mimo rozsahu, nezmenené.** Produkčný build s katalógom bez jediného výrobcu padá (`src/lib/brands/catalog.ts` zostaví prázdny dotaz `BrandCounts`); v produkcii výrobcovia sú. Stránka pokladne v `next dev` (Turbopack) padá na `createContext` v generovanom checkout kóde, produkčný build je v poriadku. `pnpm dev` (webpack) padá na `node:crypto` v tomto prostredí. `pnpm i18n:check` hlási `checkout.addressForm.delete`. Štyri CFM testy (`closure_duplicates_and_seo` ×2, `source_pack_and_publication_path` ×2) padajú už na základe.
- **Nedotknuté.** SYNC-1 (otvorené nálezy o hranici verzie po reštarte a o súbehu zápisu manifestu ostávajú u M/CFM), kolo 8 a 56 úvodov tento pilot nemení; s CFM PR #46 (SYNC-1) zdieľa PR #47 jediný súbor, `config/settings/base.py`, na iných miestach.

**4. 10. 2026, 14:02 UTC (vlákno CoolZ pilot, rozhodnutie a poradie nasadenia)** — Marek na karte zvolil „Áno, po kontrole“: tabuľka sa na piatich stránkach CoolZ zapne po úspešnej kontrole produkčného Saleoru. Zákaznícky účinok je ten z výsledku vyššie: „Porovnanie modelov“ sa zmení zo zoznamu na tabuľku, cena, sklad a iné produkty ostanú. Je to jediné produkčné rozhodnutie pilotu. Zvyšné kroky bežia na strojoch, ku ktorým cloudové vlákno nemá prístup (storefront VPS, CFM VPS, produkčný Saleor), preto ich robia relácie na VPS v tomto poradí:

1. **Kontrola Saleoru, bez zápisu (hradlo pre všetko ostatné).** Dotaz `{ shop { version } }` s tokenom aplikácie CFM alebo používateľa personálu (bez tokenu Saleor pole odmietne) musí vrátiť `3.23.31`, teda ten istý kód, na ktorom v sandboxe prešiel zápis aj čítanie tabuľky. Token zostáva v prostredí relácie, nikdy v chate, Gite ani logu. Novšia verzia alebo pochybnosť: spustiť aj čistú funkciu `clean_editorjs` na ukážke (príkaz je v `docs/contracts/comparison-table.md`). Iná verzia alebo chyba: stop, nič sa nenasadzuje ani nepublikuje, stránky ostávajú ako doteraz. **Splnené 4. 10. 2026 (relácia na CFM serveri):** produkčný Saleor hlási verziu 3.23.31, teda ten istý kód ako v sandboxe. Priamy test `clean_editorjs` odtiaľ nebol možný (bez prístupu k shellu Saleoru), takže skutočným dôkazom ostáva prvá publikácia CoolZ 32: ak Saleor tabuľku odmietne, pôvodný popis ostáva.
2. **Storefront na produkciu (relácia na storefront VPS).** PR #3 sa zlúči do `release/r1-thule-20261001` merge commitom, nie squashom (CFM kontrakt pripína commit `3a9dae7`); zlúči ho vlákno CoolZ pilotu po úspešnej kontrole, alebo relácia na VPS. Nasadenie cez `scripts/ops/deploy-production.sh` (najprv `--dry-run`), overenie podľa CLAUDE.md §13.5. Kód je bez účinku, kým popis nemá tabuľku: päť stránok CoolZ ostane so zoznamom a ich HTML neobsahuje `class="maky-cmp"`. PR #3 nemení závislosti, `pnpm-lock.yaml`, GraphQL dokumenty, `next.config.js` ani premenné prostredia, takže netreba `pnpm install` ani zmenu `.env`.
3. **CFM na produkciu a publikácia (relácia na CFM VPS).** PR #47 sa dostane do nasadeného kódu CFM podľa jeho postupu. Prepínač `CFM_SALEOR_NATIVE_COMPARISON_TABLES=1` iba pre beh publisheru, nové V2 dokumenty piatich CoolZ, `promote_coolz_v2_drafts` (najprv overiť dráhu povýšenia, jej PG testy padajú už na základe), potom publikácia popisov `COOLZ_COOLER_SKUS`. Najprv iba CoolZ 32 (TK20410), skontrolovať stránku, potom ostatné štyri. Ak Saleor tabuľku odmietne, pôvodný popis ostáva. Pred publikáciou uložiť HTML piatich stránok na porovnanie.
4. **Kontrola na živej stránke.** Pre každú z piatich stránok: `curl -s https://maky.store/sk/<slug> | grep -o 'class="maky-cmp"' | wc -l` vypíše `1`, aktuálny model je označený „Tento model“, cena, dostupnosť a tlačidlo kúpy sú také ako v uloženom HTML spred kroku 3 a jedna stránka iného produktu je nezmenená. Pohľad v prehliadači na desktope aj mobile. Stránka sa obnoví sama do niekoľkých minút, alebo hneď po `POST /api/revalidate` (podrobnosti v kontrakte).
5. **Návrat.** Ak niečo nesedí: prepínač vypnúť a päť popisov znova publikovať (vrátia sa na zoznam, stránky sa obnovia ako v kroku 4). Kód storefrontu v produkcii zostáva, je bez účinku.

Do overenia na skutočnom Dashboarde sa popisy CoolZ v Saleor Dashboarde neupravujú. SYNC-1, kolo 8 a 56 úvodov tento postup nemení.
