# Storefront 4.5 — spoločný aktuálny stav

Počiatočná snímka v2.0 · 4. 10. 2026 (text z balíka bez zmeny, okrem sekcie „Posledná delta“). Tento súbor je od založenia živý stav na integračnej vetve: aktualizuje sa tu, nie súčasne v Library, pamäti a ďalšom STATUS.md. Integračné handoffy ostávajú zdrojmi podrobných dôkazov.

## Pôvod údajov

ChatGPT pri príprave v2.0 čítal oba ZIP-y, ostatné prílohy, CLAUDE.md/AGENTS.md a dva živé GitHub refy. Nepripájal sa na VPS, netestoval aplikáciu, nemenil repozitár ani produkciu. Runtime nižšie je hlásenie M z 4. 10. 08:12–08:21 UTC. Otvorené integračné nálezy z 3. 10. sa nestrácajú len preto, že novší súhrn je nespomína.

## Git a posledné hlásené nasadenie

- **GitHub overený pri v2.0:** `main = be64a695e57e9cca0fccb2a53ff774c25b0bd109`.
- **GitHub overený pri v2.0:** `release/r1-thule-20261001 = 6e0f378f44d2d5e2871258492623e9f68e5479fe`. Toto je počiatočný vývojový a PR základ.
- **M hlási produkciu:** `fab2985ab1d7df8703e53a6ff05df9b965dc8701`, BUILD_ID `F2fH6eFtARQRLHD7LGRR9`, build 1. 10. 21:23:35 UTC. Jeden obsluhujúci storefrontový proces.
- **M hlási SYNC-1:** SF `claude/sync1-release-manifest @ a848d82`; CFM PR #46 `c98094a`; nenasadené. V2.0 znovu neoveroval hroty týchto dvoch kandidátov.
- **M hlási kolo 8:** `feat/round8-category-root-urls @ b74a652` iba na VPS, nepushnuté.
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

| ID    | Stav / dnešný vykonávateľ podľa podkladov            | Najbližší užitočný výsledok                                                                                                                                                      |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SF-2  | Návrh; nový projekt koordinuje SF a CFM časť         | Jeden CoolZ cez skutočný prenos a kvalitný desktop/mobile render; potom všetkých päť modelov. SF-0c je potrebná príprava v tejto práci, nie samostatný projekt zelených kontrol. |
| SF-1a | 56 úvodov pripravených; existujúce M                 | Doručiť už opravený obsah a ukázať dotknutú stránku bez nepravdivej vety. Neopakovať výrobu dát ani celý audit vozidiel.                                                         |
| SF-1b | SYNC-1 kandidát; existujúce M + CFM                  | Dokončiť existujúcu implementáciu vrátane reálne automatickej publikácie. Konkrétne otvorené nálezy sú v handoffe §4; nie nový všeobecný audit.                                  |
| SF-1c | CFM export, storefront prevzatie                     | Včas obnoviť dataset pred staleAfter.                                                                                                                                            |
| SF-1e | Hlásený chybný CSS limit v deploy smoke              | Opraviť nesprávne kritérium; nezrušiť overenie reálne načítaných štýlov.                                                                                                         |
| SF-8  | Hotová lokálna vetva; existujúce M                   | Uchovať/pushnúť prácu, zosúladiť so súčasnou integráciou a dokončiť kategóriové URL/404. Vývoj nemusí čakať na všetky ostatné oblasti.                                           |
| SF-3  | Návrh                                                | Po prvom CoolZ potrebné bloky a kompletná prezentácia; reprezentatívne sady s kitom aj bez.                                                                                      |
| SF-4  | Jasný zákaznícky smer; medzera košíka známa          | Jednotný výber a položkové vozidlo, zachovanie Thule kategórie. Nečakať na opätovné poslanie už známych požiadaviek.                                                             |
| SF-5  | Existujúci CMS konzument, ďalšie funkcie nedokončené | Konkrétna redakčná zmena viditeľná v náhľade aj po publikovaní.                                                                                                                  |
| SF-6  | Priebežná kvalita                                    | Cielené SEO/výkon pri dotknutých cestách, nie ďalší audit všetkého.                                                                                                              |

Prvé odporúčané súbežné výsledky sú CoolZ a dokončenie už rozpracovanej obsahovej integrácie. To nie je trvalý limit dvoch vlákien. Aktívny zákaznícky incident môže dostať prednosť.

## Posledná delta

4. 10. 2026 — pripravený jednotný balík v2.0. Žiadny deploy, merge, zmena main, import pamäte ani pripojenie VPS sa touto prípravou nevykonali. Existujúce schválené úlohy pokračujú; tento súbor nepredstiera nové produkčné schválenie.

5. 10. 2026 (vlákno CoolZ pilot) — projekt prevzal Goal a Project instructions v2.0. Do zdieľanej pamäte tohto cloudového projektu sa uložili `MEMORY.md` (index) a `decisions.md` (kvôli limitu 4 KB na súbor pamäte v dvoch súboroch, text nezmenený); nešlo o import do Codexu ani do lokálneho vlákna. Tento súbor je založený na vetve `claude/storefront-45-coolz-pilot-7n5gmo`, ktorá vychádza z `release/r1-thule-20261001 @ 6e0f378`. Nová vetva nemení stav SYNC-1, kola 8 ani 56 úvodov; tie ostávajú u existujúceho M/CFM.
