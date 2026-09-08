# Vlákno 2 — `pl` (Poľsko) a `hu` (Maďarsko)

Najprv `00-univerzalne-zadanie.md`.

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
5. **Formulár odstúpenia nebude** (§ 6 univerzálneho zadania).
6. **Doprava** — over metódy `pl-pln` a `hu-huf`; slovenskú hranicu 35 kg neprenášaj.
7. `company.test.ts` — doplň poľskú a maďarskú negáciu tvrdenia o DPH.
