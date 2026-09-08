# Vstupný bod pre nové vlákno — DE/AT

Píše sa 8. 9. 2026 večer, po nasadení SK + CS. **Toto je jediný súbor, ktorý nové
vlákno potrebuje prečítať ako prvý.** Ostatné si nájde odtiaľto.

---

## 1. Stav produkcie — over ho, nedôveruj tomuto číslu

```
PROD      578c33b5f5ada9c4d84d4d5876bbf8eb4580d173
git_ref   release/sk-cs-legal-20260908
BUILD_ID  buJZ-9DFbOKS9s5akP4-n
nasadené  2026-09-08 14:36 UTC, odstávka 74 s
```

```bash
cat /opt/storefront/.next/MAKY_DEPLOY_META   # vždy toto, nie git branch
```

⚠️ **Produkcia sa 8. 9. posunula trikrát** (`3b0843f` → `88d9d86` → `578c33b`), dvakrát
paralelným vláknom. Over ju znova.

### Čo v produkcii UŽ JE

- **SK právne texty** — schválené znenie, 8 stránok
- **CS (české) stránky** — 7 stránok na `/cz/*`, preview (noindex)
- **Práca konfigurátora a garáže** — `88d9d86` je predkom `578c33b`

**Integrácia vetiev už NIE JE potrebná.** Obidve línie sú v jednom nasadenom commite.

⚠️ Ak niekde nájdeš odkaz na `c03625c` alebo `d78ee36` ako „koniec vetvy SK/CS": tie
SHA sú **osirené rebasom**. Obsah je v produkcii, staré identifikátory nie. Nepokúšaj
sa ich merge-ovať.

---

## 2. Podklady sú na serveri, nie v chate

```
/home/ubuntu/maky-podklady/2026-09-08/MAKY_HANDOFF_NOVE_VLAKNO_2026-09-08.zip
  SHA-256  945ed876c1c8cebfa562c99b6c3797a62b03386a66eb98789c6f606770f7f166
```

Už je rozbalený (`unzip` na stroji nie je, použi `python3 -m zipfile` alebo `zipfile`):

```
/home/ubuntu/maky-podklady/2026-09-08/rozbalene/DE_AT/MAKY_STORE_DE_AT/
```

**59 súborov, overený inventár:**

| Časť                      | Obsah                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pages/de/` + `pages/at/` | **16 stránok** (8 × 2 trhy)                                                                                    |
| `formulare/`              | vzor odstúpenia (HTML + TXT), e-mail zákazníkovi, e-mail obsluhe, pokyny podľa zvozu — všetko de-DE aj de-AT   |
| `data/`                   | `pages.*.json`, `ui.*.json`, `component-copy.*.json`, `market-profiles.json`, `navigation-labels.json`, glosár |
| `interne/`                | `README_PRE_CLAUDE_CODE.md`, `HANDOFF_RETURNS_V2.md`, `QA_A_AKCEPTACIA.md`, `PRAVNE_ROZDIELY_A_ZDROJE.md`      |
| `reference/`              | pôvodné SK texty a checklist, na porovnanie                                                                    |

**Prečítaj `interne/PRAVNE_ROZDIELY_A_ZDROJE.md` skôr, než začneš.** Sú tam vecné
adaptácie, ktoré autor urobil vedome — nesmú sa „opraviť" späť ako jazykové odchýlky.

⚠️ `TEXTY_DE_AT_SPOLU.md` je iba súhrn stránok. **Nestačí** — formuláre, potvrdenia
a QA sú v samostatných priečinkoch a bez nich je balík prevzatý len spolovice.

---

## 3. Čo má nové vlákno urobiť

**Zapracovať DE a AT.** Nič viac. Ostatné trhy majú vlastné vlákna.

Postup a všetky technické detaily sú v repozitári:

```
docs/design/market-rollout/00-univerzalne-zadanie.md   ← povinné, prečítaj celé
docs/design/market-rollout/01-de-at.md                 ← špecifiká DE/AT
```

Zhrnutie toho, čo je v nich dôležité:

- pridanie jazyka = **jeden riadok** v `src/lib/legal/locale.ts` + telá v
  `src/ui/content/legal/*.tsx`; `route-policy.ts` sa odvodí sám;
- **`de` a `deAt` ako dva interné profily** so zdieľanými nemeckými fragmentmi — nie
  jeden jazyk s vetvením podľa `channel`. Zákaznícke locale zostávajú `de-DE`/`de-AT`;
- **mena a jazyk zmluvy sa čítajú z `CHANNEL_MAP`**, neprekladajú sa. Pri češtine sa
  presne toto pokazilo;
- **35 kg neprenášaj** — je to slovenský prevádzkový fakt;
- testy, ktoré padnú, sú strážcovia — **aktualizuj ich, nevypínaj**.

### Delta, ktorú treba do textov doplniť

Rozhodnutie používateľa z 8. 9.: **zahraničie platí vopred cez Stripe, dobierka sa
neponúka.** Dodaný nemecký text Stripe spomína, ale platbu vopred ani vylúčenie
dobierky explicitne neuvádza. Doplň to v _Doprave a platbe_ aj vo VOP, pre DE aj AT.

Navrhnuté znenie (DE, pre AT analogicky s „Österreich"):

> Bestellungen mit Lieferung nach Deutschland bezahlen Sie im Voraus über **Stripe**.
> Die verfügbaren Zahlungsarten sehen Sie im Bestellprozess. Eine Zahlung per Nachnahme
> bieten wir nicht an. Wir versenden Ihre Bestellung nach Eingang der Zahlung und
> entsprechend der angegebenen Warenverfügbarkeit.

⚠️ Nevyrob z toho nový prísľub okamžitej expedície.

---

## 4. Čo blokuje spustenie DE (nie obsah)

|                              | Stav                                  | Vlastník                                   |
| ---------------------------- | ------------------------------------- | ------------------------------------------ |
| `de-eur` / `at-eur` produkty | **0** (SK má 9 577)                   | obchodná príprava                          |
| Online odstúpenie            | kontrakt zamknutý na `SK/sk`          | vlákno **Returns V2** (`06-returns-v2.md`) |
| `/o-nas` cez CMS             | `cmsPageRoute` je `isSlovakChannel()` | integrácia + publikácia v Payloade         |

**Online odstúpenie je pri DE blokátor predaja, nie chýbajúca vymoženosť** — nemecký
§ 356a BGB tú funkciu predpokladá. Tvoje vlákno na to **nečaká**: dodá nemecké texty
formulára a potvrdení, aby boli pripravené na zapojenie, a označí závislosť.

---

## 5. Čo NEROBIŤ

- nenasadzovať, nemeniť `.env`, `MAKY_LIVE_MARKETS`, `WITHDRAWAL_BACKEND_LIVE`;
- nezapínať predaj ani indexáciu;
- **neprepisovať slovenské ani české texty** — sú nasadené a schválené;
- nesiahať na Saleor, Stripe, ceny, dopravu;
- `pnpm build` **nikdy** v `/opt/storefront`, kým beží PM2 (CLAUDE.md §13.1) — pracuj
  vo worktree;
- nevymýšľať právne subjekty poskytovateľov, lehoty, prenosy ani obsah GTM kontajnera.

---

## 6. Rozlišuj štyri stavy

Zamieňajú sa a je to najčastejšia chyba v tomto projekte:

|               | znamená                                          |
| ------------- | ------------------------------------------------ |
| **OBSAH**     | texty existujú v kóde                            |
| **ROUTABLE**  | `/de/kontakt` vráti 200                          |
| **SELLABLE**  | dá sa objednať — produkty, cena, doprava, platba |
| **INDEXABLE** | Google ho smie indexovať (`MAKY_LIVE_MARKETS`)   |

`noindex` **nie je** zákaz nákupu. Preview trh sa dá kúpiť, ak má produkty a platbu.

---

## 7. Odovzdanie

Vetva `claude/trh-de-at-*`, pushnutá, **nenasadená**. Správa v troch oddelených
častiach — IMPLEMENTOVANÉ / OVERENÉ (s konkrétnymi výstupmi a HTTP kódmi pre 16 stránok)
/ ZOSTÁVA (jeden konkrétny zoznam s vlastníkom).

Pri každom právnom tvrdení zdroj a dátum kontroly. „Pošli to právnikovi" **nie je
odovzdaný výsledok** — over pravidlo v oficiálnom zdroji, vysvetli dopad na model MAKY,
navrhni znenie. Ak zostáva neistota, ohranič ju a navrhni najmenší bezpečný krok.
