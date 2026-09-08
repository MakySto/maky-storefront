# Vlákno 5 — `us` (USA) a `ca` (Kanada) — INÁ ÚLOHA NEŽ OSTATNÉ

Najprv `00-univerzalne-zadanie.md`. Ale pozor: **toto vlákno nie je preklad.**

| trh | kanál    | mena    | locale |
| --- | -------- | ------- | ------ |
| us  | `us-usd` | **USD** | en-US  |
| ca  | `ca-cad` | **CAD** | en-CA  |

## 1. Prečo je toto vlákno iné

Sú to **jediné anglické trhy** (`gb-gbp` bol zrušený 20. 7. 2026) a **oba sú mimo
EHP**. Sedem stránok je pritom argument postavený na práve EÚ. Preklad z nich urobí
text čitateľný v USA a Kanade — nie pravdivý.

Čo by bolo nepravdivé:

| Text hovorí                    | V USA / Kanade                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 14 dní na odstúpenie zo zákona | Federálny online ekvivalent neexistuje; FTC Cooling-Off Rule sú 3 dni a len mimo prevádzky. Kanada: provinčne |
| Dvojročná zodpovednosť za vady | USA: štátne implied warranties (UCC) + Magnuson-Moss. Kanada: provinčné zákony                                |
| GDPR, sťažnosť na ÚOOÚ SR      | USA: štátne zákony (CCPA/CPRA…). Kanada: PIPEDA                                                               |
| Dozor a ARS cez SOI            | Bez právomoci voči predaju do USA/Kanady                                                                      |
| „Ceny sú konečné vrátane DPH"  | **Nepravda.** Sales tax sa v USA pripočítava v pokladni podľa štátu a PSČ                                     |
| (o clách mlčí)                 | Zásielka môže doraziť s colným účtom, s ktorým zákazník nesúhlasil                                            |

## 2. Jazyk verzus právo

**Jeden anglický text ako jazyk stačí** — `en-US` a `en-CA` sa líšia len pravopisom.
Druhý preklad kvôli _color/colour_ nemá zmysel.

**Ale právne sú to dva rôzne dokumenty**, a ani jeden nevzniká prekladom z EÚ textu.
Kanada je navyše provinčne členitá a **Quebec** má Chartu francúzskeho jazyka — takže
`en-CA` nemusí na Kanadu stačiť a môže byť potrebná francúzština.

## 3. Čo toto vlákno má naozaj urobiť

**Nezačínaj písaním stránok.** Najprv:

1. Zisti od Mareka, či sa do USA/Kanady **skutočne ide predávať**. Ak nie, vlákno
   končí zápisom zistení.
2. Ak áno, priprav **zadanie pre právnika** — nie hotový text. Konkrétne, ktoré
   z ôsmich stránok potrebujú úplne nové znenie (VOP, reklamácie, odstúpenie,
   ochrana údajov, cookies) a ktoré vystačia s prekladom (kontakt, doprava, o nás).
3. Over prevádzkové predpoklady, ktoré sú nezávislé od textu:
   - má `us-usd` / `ca-cad` produkty, dopravu a Stripe?
   - kto je **importer of record** pri zásielke zo SK?
   - **economic-nexus** registrácia k sales tax v štátoch USA a **GST/HST pre
     nerezidenta** v Kanade — otázka na účtovníka **pred prvou objednávkou**.

## 4. Čo neurobiť

❌ Nepreložiť EÚ text do angličtiny a nasadiť ho.
❌ Nepridať `us`/`ca` do `APPROVED_COPY`, kým neexistuje text napísaný pre ich právo.
❌ Netvrdiť, že „ceny sú konečné vrátane DPH".

## 5. Čo odovzdať

Zadanie pre právnika, zoznam overených prevádzkových prekážok a odporúčanie, či
a kedy trh otvárať. Kód sa v tomto vlákne meniť nemusí vôbec — a ak sa nemení, je to
správny výsledok, nie zlyhanie.
