# Vlákno 3 — `it` (Taliansko) a `fr` (Francúzsko)

Najprv `00-univerzalne-zadanie.md`.

| trh | kanál    | mena | locale | jazyk |
| --- | -------- | ---- | ------ | ----- |
| it  | `it-eur` | EUR  | it-IT  | `it`  |
| fr  | `fr-eur` | EUR  | fr-FR  | `fr`  |

Obe eurové, takže veta o mene je rovnaká ako pri SK — ale **veta o jazyku zmluvy nie**.

## Na čo si dať pozor

1. **Francúzsko má jazykové požiadavky na spotrebiteľské zmluvy** (Loi Toubon).
   Text musí byť francúzsky — čo aj bude — ale over, či sa niekde neponechal
   anglický alebo slovenský termín. Rovnaká pozornosť patrí názvom tlačidiel.
2. **Talianska a francúzska terminológia odstúpenia** sa líši od nemeckej aj slovenskej
   (_diritto di recesso_ / _droit de rétractation_). Nadpisy a odkazy v navigácii musia
   byť konzistentné naprieč všetkými siedmimi stránkami — odkaz v jednej stránke
   nesmie volať stránku inak než jej vlastný `title`.
3. **ePrivacy a úrady** — Garante (IT) a CNIL (FR) sú všeobecne známe, ale aj tak
   musia prísť z prekladu, nie odo mňa ani od teba. Slovenský ÚOOÚ zostáva ako úrad
   predajcu.
4. **ARS subjekt** — každá krajina má vlastný zoznam. Neprenášaj SOI ako jediný.
5. **Formulár odstúpenia nebude** (§ 6 univerzálneho zadania).
6. **Doprava** — over metódy `it-eur` a `fr-eur`; 35 kg neprenášaj.
7. `company.test.ts` — doplň taliansku a francúzsku negáciu tvrdenia o DPH.
