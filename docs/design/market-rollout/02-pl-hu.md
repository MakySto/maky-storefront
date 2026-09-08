# Vlákno 2 — `pl` (Poľsko) a `hu` (Maďarsko)

⭐ **Začni súborom `HANDOFF-20260908-pl-hu.md`** — je samonosný a povie ti, čo ďalej.
Potom `00-univerzalne-zadanie.md`. Tento súbor iba dopĺňa.

⚠️ **Prekladový balík pre PL/HU neexistuje** (overené 2026-09-08). Na rozdiel od DE/AT
prekladáš zo schválenej slovenčiny, nie zo zásielky. Detail v handoffe § 0.

| trh | kanál    | mena    | locale | jazyk |
| --- | -------- | ------- | ------ | ----- |
| pl  | `pl-pln` | **PLN** | pl-PL  | `pl`  |
| hu  | `hu-huf` | **HUF** | hu-HU  | `hu`  |

Dva **rôzne jazyky** a **dve rôzne meny** — jednoduchšie než DE/AT v tom, že sa nedá
omylom zdieľať telo, ale náročnejšie v tom, že nič nie je spoločné.

## Na čo si dať pozor

1. **Mena.** Ani jeden trh nie je eurový. Veta o mene sa musí čítať z `CHANNEL_MAP`
   (PLN, HUF) — pri češtine sa presne toto pokazilo. Skontroluj aj vetu o jazyku
   zmluvy.
2. **Zaokrúhľovanie a formát ceny.** HUF sa bežne uvádza bez desatinných miest.
   Neriešiš formátovanie cien (to je katalóg), ale **netvrď v texte nič o desatinných
   miestach ani o zaokrúhľovaní**, čo si neoveril.
3. **ePrivacy a dozorné orgány.** Každá krajina má vlastný predpis pre cookies,
   vlastný úrad na ochranu údajov a vlastný ARS subjekt. Musia prísť z prekladu —
   **nedopĺňaj ich odhadom**, patria do otvorených položiek.
4. **Diakritika a dĺžka.** Maďarčina a poľština majú znaky mimo latin-1 a dlhšie
   zloženiny. Skontroluj vodorovný pretok pri 360 px, hlavne v tabuľkách cookies a
   poskytovateľov (§ 9 univerzálneho zadania).
5. **Formulár odstúpenia nezapínaš** (§ 6 univerzálneho zadania) — kontrakt Returns V2
   je zamknutý na `market: "SK"`, takže podanie z `/pl` alebo `/hu` by Payload odmietol.
   ⚠️ **„Formulár nebude" je prekonané znenie.** Je to dočasná ochrana pred tlačidlom,
   ktoré nevie vyrobiť záznam, nie cieľový stav — pri DE je chýbajúca online funkcia
   blokátor **predaja** (§ 356a ods. 4 BGB). Zisti, či to platí aj pre PL/HU, a dodaj
   jazykové texty pripravené na zapojenie (vzor: `src/lib/withdrawal/copy-de.ts`).
6. **Doprava** — over metódy `pl-pln` a `hu-huf`; slovenskú hranicu 35 kg neprenášaj.
7. `company.test.ts` — doplň poľskú a maďarskú negáciu tvrdenia o DPH.
8. ⚠️ **`pl` je dnes fixtúra pre „trh bez schváleného textu"** v `route-policy.test.ts`,
   `proxy.test.ts` a `proxy.gate.test.ts` — tú rolu prevzal po `de`. Keď pridáš poľštinu,
   musí prejsť na iný trh (napr. `it`). Nemazať assertion — test by prechádzal a
   nekontroloval nič.
9. **Vzorová routa odstúpenia** `odstupenie-od-zmluvy/vzorovy-formular` je od DE/AT
   viacjazyčná. Pridaj do nej `pl` a `hu`, inak bude odkaz zo stránky odstúpenia viesť
   na 404 — presne ten defekt, ktorý bol pre `/cz` naživo.
