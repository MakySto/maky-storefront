# §2.6 — podklady pre fotografie typov strechy

**Čo blokuje:** iba fotografickú časť. Krok výberu strechy medzitým funguje a od
2026-09-08 má ilustráciu pri **každej** voľbe, nielen pri jedinej.

---

## 1. Čo sa už opravilo bez fotografií

`RoofIllustration` sa vykresľovala jediný raz — vo vetve, keď generácia pozná práve jeden
typ strechy. Pri viacerých typoch zákazník nedostal **ani tie čiary**, iba šesť slov.

Zmerané na produkčnom datasete: **92 z 856 generácií (10,7 %) ponúka viac než jeden typ.**
Sú to práve tie prípady, kde sa typy ťažko rozlišujú a otázka má zmysel — a práve tam
nebolo na čo pozerať. Otázka „Má vaše vozidlo tento typ strechy?" sa nedá zodpovedať bez
toho „tento".

Ilustrácia je teraz pri každej možnosti. **Ostáva schematická a je to náhrada, nie cieľ.**

## 2. Prečo čiary nestačia

Marekov súd znie „čudné čiary" a je vecne správny: čiara hrubá 3 px nedokáže ukázať
rozdiel medzi pozdĺžnikom, pod ktorý sa dá vsunúť ruka, a integrovaným, pod ktorý sa
nedá. Pritom **presne tento rozdiel rozhoduje o tom, ktoré pätky na auto pasujú.**

## 3. Čo treba obstarať — šesť typov, v poradí podľa dôležitosti

Poradie je podľa toho, koľko generácií ten typ ponúka (produkčný dataset, 2026-09-07).

| #   | Typ (`RoofType`) | Slovenský názov         | Generácií | Čo MUSÍ byť na fotografii vidieť                                                                                                                                      |
| --- | ---------------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `raised-rails`   | Pozdĺžniky nad strechou | **385**   | Medzera medzi lyžinou a strechou. Ideálne s rukou alebo prstami prestrčenými popod — to je jediný rozlišovací znak oproti `flush-rails`.                              |
| 2   | `flush-rails`    | Integrované pozdĺžniky  | **246**   | Lyžina doliehajúca na strechu bez medzery, po celej dĺžke. Bočný pohľad v úrovni strechy.                                                                             |
| 3   | `naked-roof`     | Holá strecha            | **222**   | Hladká strecha bez lyžín a bez viditeľných bodov. Musí byť zrejmé, že tam nič nie je — nie výrez, ktorý mohol lyžiny len oreza (celá strecha od A stĺpika po C).      |
| 4   | `fixpoint`       | Pevné body              | **84**    | Odkryté kotviace body — najlepšie jedna fotografia so zakrytým a jedna s odklopeným krytom. Bez toho ich zákazník nenájde.                                            |
| 5   | `t-track`        | T-drážka                | **14**    | Pozdĺžna drážka v tvare T v lyžine, zblízka, s viditeľným profilom drážky.                                                                                            |
| 6   | `rain-gutter`    | Odkvapová lišta         | **0**     | Vystupujúca lišta pozdĺž okraja strechy (staršie úžitkové vozidlá). **V dnešnom datasete sa nevyskytuje ani raz — najnižšia priorita, pokojne až s ďalšou kohortou.** |

## 4. Požiadavky na každú fotografiu

**Obsah.** Jeden typ strechy, jeden rozlišovací znak, zaostrený. Rovnaký uhol a rovnaký
výrez naprieč celou sadou — zákazník ich porovnáva vedľa seba, takže šesť rôznych
kompozícií je horších než šesť priemerných rovnakých.

**Neutralita.** Bez čitateľnej značky, loga a ŠPZ. Fotografia zobrazuje **typ strechy**,
nie model zákazníkovho auta, a text okolo nej to musí ďalej hovoriť. Fotografia
konkrétnej Octavie pri otázke pre Passat by tvrdila viac, než vieme.

**Formát.** Šírka ≥ 640 px, pomer 8:3 (zodpovedá dnešnému `viewBox 160×60`), WebP alebo
AVIF, súbor do 60 kB. Bez textu vypáleného v obraze — popisky sú preložené do 12 jazykov.

**Licencia — bez nej sa fotografia nepoužije.** Pri každej treba: zdroj, meno autora
alebo dodávateľa, typ oprávnenia (vlastná fotografia / licencia od Nordrive / stock
s komerčnou licenciou) a dátum. Fotografie stiahnuté z webu výrobcu bez písomného
súhlasu **nepoužívame** — repozitár je verejný fork a obsah `public/` je verejný.

**Odborná kontrola.** Každý typ musí pred nasadením potvrdiť niekto, kto strechy pozná —
zámena `raised-rails` a `flush-rails` na fotografii je horšia než dnešná schéma, lebo
vyzerá dôveryhodne.

## 5. Kde ich doplniť

Jediné miesto: `RoofIllustration` v `src/ui/components/vehicle/vehicle-selector-sheet.tsx`.
Obe volania idú cez ňu, takže fotografia s dnešnou schémou ako záložným riešením rozsvieti
celý krok naraz. Súbory patria do `public/`.

**Nenahrádzať čiary ďalšou abstraktnou ikonou.** Ak fotografia pre daný typ nie je,
schéma zostáva — je poctivá v tom, že je schéma.

## 6. Čo od Mareka potrebujem

Buď fotografie podľa §3–4, alebo informáciu, že ich mám hľadať v licencovaných zdrojoch
Nordrive. **Prvé štyri typy (`raised-rails`, `flush-rails`, `naked-roof`, `fixpoint`)
pokrývajú 937 z 951 výskytov** — sada štyroch fotografií je 98,5 % úžitku a je to
zmysluplný prvý krok.
