# Vlákno 4 — `es` (Španielsko) a `ro` (Rumunsko)

Najprv `00-univerzalne-zadanie.md`.

| trh | kanál    | mena    | locale | jazyk |
| --- | -------- | ------- | ------ | ----- |
| es  | `es-eur` | EUR     | es-ES  | `es`  |
| ro  | `ro-ron` | **RON** | ro-RO  | `ro`  |

**Pozor:** `es` je eurové, `ro` **nie je**. V jednom vlákne máš obe situácie —
neskopíruj vetu o mene z jedného tela do druhého.

## Na čo si dať pozor

1. **RON.** Rumunská veta o mene sa musí čítať z `CHANNEL_MAP`. Toto je presne ten
   typ chyby, ktorý sa stal pri češtine.
2. **Španielske autonómne spoločenstvá** majú vlastné spotrebiteľské orgány popri
   celoštátnych. Ak preklad uvádza len jeden, je to otvorená položka, nie chyba
   prekladu — zapíš ju, nedopĺňaj.
3. **ePrivacy a úrady** — AEPD (ES) a ANSPDCP (RO) musia prísť z prekladu.
4. **Diakritika.** Rumunské `ș`/`ț` sa často zamieňajú za `ş`/`ţ` (cedilla vs comma).
   Skontroluj, že preklad používa správne znaky — je to viditeľné v texte a
   nepríjemné na oprave neskôr.
5. **Formulár odstúpenia nebude** (§ 6 univerzálneho zadania).
6. **Doprava** — over metódy `es-eur` a `ro-ron`; 35 kg neprenášaj.
7. `company.test.ts` — doplň španielsku a rumunskú negáciu tvrdenia o DPH.
