# Vstupný bod pre nové vlákno — PL/HU

Píše sa 8. 9. 2026 večer, po dokončení DE/AT. **Toto je jediný súbor, ktorý nové vlákno
potrebuje prečítať ako prvý.** Ostatné si nájde odtiaľto.

---

## 0. Najdôležitejšie hneď na začiatku: balík pre PL/HU NEEXISTUJE

DE/AT vlákno dostalo hotový 59-súborový prekladový balík. **Ty nedostaneš nič.**
Overené na serveri:

```
/home/ubuntu/maky-podklady/2026-09-08/rozbalene/
├── DE_AT/                                    ← existuje
└── MAKY_HANDOFF_NOVE_VLAKNO_2026-09-08/
    └── podklady/
        ├── MAKY_STORE_SK_texty_...zip        ← existuje
        ├── MAKY_STORE_CS_preklad_...zip      ← existuje
        └── MAKY_STORE_DE_AT_preklad_...zip   ← existuje
                                              ← žiadne PL, žiadne HU
```

Over si to sám (`ls -R`), lebo Marek môže balík medzitým dodať. **Ak ho dodá, prevezmi
ho tak, ako DE/AT vlákno prevzalo ten svoj** — vrátane `formulare/`, `data/` a `interne/`.

### Ak balík nie je — čo to znamená

Tvoja práca sa mení z „zapracuj dodaný preklad" na **„prelož zo schváleného slovenského
základu"**. To nie je to isté a treba to povedať nahlas:

- **Zdroj je slovenské znenie v `src/ui/content/legal/*.tsx`, funkcia `Sk`.** Je
  schválené a nasadené. Nie je to náhrada za odborný preklad, ale je to jediná
  autoritatívna verzia, ktorú máme.
- **Nemecké znenie NIE JE zdroj.** Obsahuje vecné adaptácie na nemecké a rakúske právo
  (§ 25 TDDDG, Widerruf/Rücktritt, EVZ, Länder úrady). Preklad tých viet do poľštiny by
  do poľského textu preniesol nemecké právo.
- **Právna kontrola je väčšia časť práce než jazyk.** Pri DE/AT ju urobil autor balíka
  a vlákno ju len nesmelo pokaziť. Tu ju musíš urobiť ty, podľa § 2.1 univerzálneho
  zadania: over pravidlo v oficiálnom zdroji, vysvetli dopad na model MAKY, navrhni
  znenie. „Pošli to právnikovi" nie je odovzdaný výsledok.

⚠️ **Ak si netrúfaš na kvalitu jazyka, povedz to v odovzdávke a označ, ktoré pasáže
potrebujú rodeného hovoriaceho.** Lepšie než ticho odovzdať strojový preklad
právneho textu.

---

## 1. Stav — over ho, nedôveruj tomuto číslu

```
PROD      578c33b5f5ada9c4d84d4d5876bbf8eb4580d173
BUILD_ID  buJZ-9DFbOKS9s5akP4-n
nasadené  2026-09-08 14:36 UTC
```

```bash
cat /opt/storefront/.next/MAKY_DEPLOY_META   # vždy toto, nie git branch
git ls-remote origin                          # stav vetiev
```

**V produkcii je:** SK právne texty, CS stránky na `/cz` (preview, noindex), práca
konfigurátora a garáže. **Nie je tam DE/AT.**

**Vetva, na ktorej staviaš:**

```
claude/german-package-de-at-23c61a @ 2601c2b   (7 commitov nad 0fb1895)
```

⚠️ **Nezakladaj vetvu na produkcii.** DE/AT sa dotýka rovnakých spoločných súborov ako ty
(`locale.ts`, routy, `company.test.ts`, `proxy.test.ts`, `route-policy.test.ts`). Ak
začneš od `578c33b`, integrátor bude riešiť konflikty, ktoré nemuseli vzniknúť.

Ak DE/AT medzitým doputovalo do inej integračnej vetvy, použi tú. Zisti to cez
`git ls-remote` a `MAKY_DEPLOY_META`, nie z tohto dokumentu.

---

## 2. Čo čítať, v tomto poradí

```
docs/design/market-rollout/00-univerzalne-zadanie.md   ← povinné, celé
docs/design/market-rollout/02-pl-hu.md                 ← špecifiká PL/HU
docs/design/market-rollout/01-de-at.md                 ← ako to robilo DE/AT vlákno
docs/design/market-rollout/de-at/README.md             ← čo sa odovzdáva mimo storefrontu
```

Potom si **pozri kód DE/AT vlákna**, nie preto, aby si ho kopíroval, ale aby si videl
vzor: `src/ui/content/legal/german-market.tsx` + funkcia `German` v každom module.

---

## 3. Čo je na PL/HU iné než na DE/AT

|                | DE/AT                   | PL/HU                                 |
| -------------- | ----------------------- | ------------------------------------- |
| Jazyk          | jeden, dva trhy         | **dva rôzne jazyky**                  |
| Mena           | EUR / EUR               | **PLN / HUF** — ani jeden nie je euro |
| Zdieľanie tela | áno, `German` + profily | **nie, nič sa nezdieľa**              |
| Zdroj textu    | dodaný balík            | schválená slovenčina                  |

**Preto NEPOUŽÍVAJ vzor `german-market.tsx`.** Ten existuje, lebo dva trhy zdieľajú jeden
jazyk. PL a HU nezdieľajú nič — každý dostane vlastný `Pl` / `Hu` export a hotovo. Zavádzať
profilový objekt pre jeden trh je zbytočná vrstva.

### 3.1 Mena a jazyk zmluvy — tu sa to už raz pokazilo

`CHANNEL_MAP` je autorita: `pl` → `pl-pln` / **PLN**, `hu` → `hu-huf` / **HUF**.

Pri češtine dodaný preklad ponechal „ceny sa uvádzajú v eurách" a „zmluva sa uzatvára
v slovenčine". Oboje bolo na `/cz` nepravdivé. **Skontroluj obe vety v každej stránke**,
zvlášť vo VOP § 4 (Ceny a platba) a § 2 (jazyk zmluvy).

⚠️ **HUF sa bežne uvádza bez desatinných miest.** Formátovanie cien nie je tvoja plocha
(to je katalóg). Preto v texte **netvrď nič o desatinných miestach ani zaokrúhľovaní** —
ani to, že sa zaokrúhľuje, ani že nie.

### 3.2 Čo musíš dohľadať pre každý trh

Slovenský text tieto údaje má vo svojej podobe; poľská a maďarská podoba sa **nedá
odvodiť** a **nesmie sa odhadnúť**:

| Údaj                            | SK má          | PL/HU                                                             |
| ------------------------------- | -------------- | ----------------------------------------------------------------- |
| ePrivacy predpis pre cookies    | zákon 452/2021 | **dohľadaj** — každá krajina má vlastný                           |
| Úrad na ochranu údajov          | ÚOOÚ SR        | **dohľadaj** (PL: UODO, HU: NAIH — over adresu a URL)             |
| ARS / mimosúdne riešenie sporov | SOI            | **SOI zostáva** ako orgán predajcu; miestny sa dopĺňa, nenahrádza |
| Cezhraničná podpora             | —              | ECC Poland / ECC Hungary (over, či existujú a pod akým názvom)    |
| Kogentné spotrebiteľské právo   | 108/2024       | **dohľadaj** názvy miestnych predpisov pre vetu o čl. 6 Rím I     |

Vzor, ako to zapísať, máš v `01-de-at.md` § 2 a v tabuľke rakúskych účinností — **so
zdrojom a dátumom kontroly**. Nie „podľa mojich znalostí".

⚠️ **`gesetze-im-internet.de` je z tohto stroja nedostupný (timeout). `dejure.org`
a `ris.bka.gv.at` fungujú.** Pre PL skús `isap.sejm.gov.pl`, pre HU `njt.hu` — **over
dostupnosť skôr, než sľúbiš overenie**, a ak sa nedá, napíš to.

---

## 4. Ako sa technicky pridáva jazyk

Architektúra je hotová a DE/AT ju už raz použilo, takže vieš, že funguje.

### 4.1 Register — jediný zdroj pravdy

`src/lib/legal/locale.ts`:

```ts
export const LEGAL_LOCALES = ["sk", "cs", "de", "deAt", "pl", "hu"] as const;
const APPROVED_COPY = { sk: "sk", cz: "cs", de: "de", at: "deAt", pl: "pl", hu: "hu" };
export const LEGAL_BODY_NAMES = { …, pl: "Pl", hu: "Hu" };
```

`route-policy.ts` si zoznam odvodí sám cez `marketsWithLegalCopy()`. Nemeníš ho.

### 4.2 Telá a routy

- `src/ui/content/legal/<slug>.tsx` — pridaj `export function Pl` a `export function Hu`.
  Sedem modulov. Podpis `({ channel }: { channel: string })`, pri odstúpení navyše
  `form` a `modelFormHref`.
- `src/app/[channel]/(main)/<slug>/page.tsx` — pridaj `pl` a `hu` do `copy`.
- `odstupenie-od-zmluvy/page.tsx` — má vlastný `META` a mapu `BODIES`.
- **`odstupenie-od-zmluvy/vzorovy-formular/page.tsx`** — DE/AT vlákno ju prerobilo na
  viacjazyčnú. Pridaj `pl` a `hu` do `COPY` a `TEXT` a vlastné telo. **Nezabudni na ňu** —
  odkazuje na ňu stránka odstúpenia a 404 za odkazom v zákonnej informácii je defekt.

### 4.3 Odkazy

Vždy `marketHref(channel, "/…")` + `next/link`. Test na natvrdo napísané odkazy už
kontroluje `sk|cz|de|at` — **rozšír ho o `pl|hu`**:

```ts
expect(src).not.toMatch(/href="\/(sk|cz|de|at|pl|hu)\//);
```

### 4.4 Zdieľané fragmenty majú predvolené hodnoty

`ReturnAddress`, `SeatAddress`, `SupervisoryAuthority` a `Adr` prijímajú voliteľné
parametre (`country`, `gloss`, `lang`) s predvolenými slovenskými hodnotami. Rozšír ich
o svoj jazyk — **neprepíš predvolenú hodnotu**, inak zmeníš slovenský výstup.

`Adr` a tabuľky (`RecipientsTable`, `InventoryTable`) majú typ `lang: "sk" | "cs" | "de"`.
Rozšír o `"pl" | "hu"` a doplň riadky. **Nepridávaj nové služby** — inventár je overený
z kódu a `.env`, prekladá sa, nedopĺňa.

---

## 5. Testy, ktoré ti padnú — a je to správne

Sú to strážcovia. **Aktualizuj ich, nevypínaj.**

| Test                                | Prečo padne                                             | Čo urobiť                                                       |
| ----------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/legal/legal-route.test.ts` | vyžaduje telo pre každý jazyk v `LEGAL_LOCALES`         | pridaj `Pl`/`Hu` do `LEGAL_BODY_NAMES`, telá doplní tvoja práca |
| `src/lib/route-policy.test.ts`      | `NO_COPY = ["pl", "fr", "us"]`                          | **`pl` musí von** — nahraď ho napr. `it`                        |
| `src/proxy.test.ts`                 | `["pl", "fr", "us", "ca"]` a `/pl/kontakt` noindex test | to isté                                                         |
| `src/proxy.gate.test.ts`            | používa `/pl/kontakt` ako „trh bez textu"               | to isté                                                         |
| `src/config/company.test.ts`        | globuje obsah a kontroluje tvrdenie o DPH               | doplň **poľskú a maďarskú negáciu**                             |

⚠️ **`pl` je dnes fixtúra pre „trh bez schváleného textu"** — presne tú rolu po DE/AT
prevzal. Keď pridáš poľštinu, tá rola musí prejsť na iný trh. Keby si len zmazal
assertion, test by ďalej prechádzal a nekontroloval by nič — to je presne chyba, ktorú
DE/AT vlákno našlo v derivácii mena exportu (`locale === "sk" ? "Sk" : "Cs"`).

---

## 6. Čo NEROBIŤ

- nenasadzovať, nemeniť `.env`, `MAKY_LIVE_MARKETS`, `WITHDRAWAL_BACKEND_LIVE`;
- nezapínať predaj ani indexáciu;
- **neprepisovať slovenské, české ani nemecké texty** — všetky sú schválené;
- nesiahať na Saleor, Stripe, ceny, dopravu, checkout, CFM;
- **neprenášať slovenskú hranicu 35 kg** — je to slovenský prevádzkový fakt (a nesedí ani
  s vlastným pásmom 30–45 kg);
- nezapínať formulár odstúpenia (§ 7 nižšie);
- `pnpm build` **nikdy** v `/opt/storefront`, kým beží PM2 (CLAUDE.md §13.1) — pracuj vo
  worktree;
- nevymýšľať právne subjekty poskytovateľov, lehoty, prenosy ani obsah GTM kontajnera.

---

## 7. Formulár odstúpenia — dočasne nie, a napíš prečo

`02-pl-hu.md` bod 5 hovorí „Formulár odstúpenia nebude". **To je prekonané znenie**, ktoré
sme opravili v univerzálnom zadaní aj v `01-de-at.md`. Správne je:

> Kontrakt Returns V2 je zamknutý na `market: "SK"` / `locale: "sk"` ako literálové typy,
> takže podanie z `/pl` alebo `/hu` by Payload odmietol. **Tvoje vlákno formulár
> nezapína** — ale nie je to prijateľný konečný stav, je to dočasná ochrana pred
> tlačidlom, ktoré nevie vyrobiť záznam.

Pre DE je chýbajúca online funkcia **blokátor predaja** (§ 356a ods. 4 BGB). **Zisti, či
to platí aj pre PL a HU** — je to konkrétna právna otázka, ktorú máš zodpovedať, nie
odsunúť. Ak áno, napíš to do odovzdávky ako blokátor predaja, nie obsahu.

Ako to urobilo DE/AT vlákno (a odporúčam zopakovať):

- stránka sa servíruje ďalej — je to zákonná informačná povinnosť;
- na mieste formulára sa vykreslí **pravdivé** oznámenie, že funkcia v tejto náhľadovej
  verzii nie je aktivovaná, a ponúkne e-mail a poštu;
- **žiadny text ani metadáta nesmú sľubovať funkciu, ktorá nebeží** — v DE/AT to boli dve
  samostatné chyby, ktoré sa museli opraviť až po prvom renderi;
- jazykové texty formulára a potvrdení sa dodajú **pripravené a nezapojené**, ako
  `src/lib/withdrawal/copy-de.ts`, so strážcom, ktorý spadne, keď ich niekto zapojí skôr,
  než backend trh prijme.

---

## 8. `/o-nas`

`cmsPageRoute` má `isSlovakChannel()` na dvoch miestach — `/pl/o-nas` aj `/hu/o-nas` budú 404. Podľa `00-univerzalne-zadanie.md` § 3.5 treba **oboje**: rozšíriť bránu **a**
publikovať dokument v Payloade. Bootstrap v kóde nestačí a **druhý autoritatívny zdroj
v kóde vzniknúť nesmie**.

Urob to, čo DE/AT: nechaj `o-nas` mimo svojich trhov, prelož text a **odovzdaj ho
integrátorovi ako súbor** — vzor je `docs/design/market-rollout/de-at/o-nas.de.md`
(telo + h1 + title + description).

---

## 9. Validácia — celá, pred odovzdaním

```bash
# po prepnutí vetvy najprv codegen, inak tsc padne na chýbajúcom src/gql/
export NEXT_PUBLIC_SALEOR_API_URL="$(grep '^NEXT_PUBLIC_SALEOR_API_URL=' /opt/storefront/.env | cut -d= -f2-)"
pnpm install --frozen-lockfile && pnpm generate && pnpm generate:checkout

npx tsc --noEmit
pnpm lint          # očakávaj 6 predexistujúcich varovaní, 0 chýb
npx vitest run
pnpm build         # potrebuje env: set -a; . /opt/storefront/.env; set +a; unset NEXT_OUTPUT
```

### 9.1 Skutočný render, nie iba build

Build prejde aj nad rozbitým textom. Postup, ktorý sa osvedčil:

```bash
nohup npx next start -p 30XX > /tmp/next.log 2>&1 & disown
until curl -s -o /dev/null --max-time 2 http://127.0.0.1:30XX/sk; do sleep 2; done

for p in kontakt doprava-a-platba reklamacie-a-vratenie odstupenie-od-zmluvy \
         obchodne-podmienky ochrana-osobnych-udajov cookies o-nas \
         odstupenie-od-zmluvy/vzorovy-formular; do
  for m in sk cz de at pl hu it; do
    printf "%-40s %-3s %s\n" "$p" "$m" \
      "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:30XX/$m/$p)"
  done
done
```

Očakávané: `pl`/`hu` **200**, `sk`/`cz`/`de`/`at` **200** (nesmieš nič rozbiť), `it` **404**
(kontrolná vzorka trhu bez textu), `o-nas` 404 mimo `sk`.

### 9.2 Regresia na už schválených jazykoch — toto rob vždy

Najsilnejší dôkaz, že si nesiahol na schválený text:

```bash
strip() { sed -e 's/<script[^>]*>.*\?<\/script>//g' -e 's/<[^>]*>/ /g' | tr -s ' \n' ' '; }
for m in sk cz; do for p in kontakt doprava-a-platba reklamacie-a-vratenie \
    odstupenie-od-zmluvy obchodne-podmienky ochrana-osobnych-udajov cookies; do
  [ "$(curl -s https://maky.store/$m/$p | strip)" = "$(curl -s http://127.0.0.1:30XX/$m/$p | strip)" ] \
    && echo "OK   /$m/$p" || echo "LÍŠI /$m/$p"
done; done
```

`de`/`at` proti produkcii porovnať nevieš (nie sú tam) — porovnaj ich `git diff`om, že
si ich nezmenil.

### 9.3 Vizuálna kontrola pri 360 px — nepreskakuj

Headless Chromium na tomto stroji **funguje**:
`~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, ovládaj cez CDP z Node.
Screenshot potom **prečítaj**, nepíš „nech sa pozrie Marek".

⚠️ **Nemčina odhalila, že `LegalPage` potrebovala `break-words` na nadpise aj na
`.prose`** — dlhé zloženiny posunuli dokument o 13–17 px. To je už opravené, ale
**poľština a maďarčina majú vlastné dlhé slová** (napr. `személyesadat-védelem`,
`odpowiedzialność`). Premeraj `scrollWidth === clientWidth` na **všetkých** stránkach
× všetkých trhoch, nie na vzorke.

⚠️ `pgrep -f` matchne vlastný shell → exit 144. Chrome zabíjaj cez `pgrep -x chrome`,
server cez PID z `ss -ltnp`.

### 9.4 Formulár musí zostať mimo tvojich trhov aj so zapnutou bránou

```bash
WITHDRAWAL_BACKEND_LIVE=true npx next start -p 30XX
curl -s http://127.0.0.1:30XX/pl/odstupenie-od-zmluvy | grep -c 'Potvrdiť odstúpenie'
# musí byť 0
```

### 9.5 Paritný test i18n

Invariant je, že **všetkých 12 súborov správ je identických** (missing 0 / extra 0), nie
konkrétny počet kľúčov. Skript je v `CLAUDE.md` § 11.

---

## 10. Rozlišuj štyri stavy

Zamieňajú sa a je to najčastejšia chyba v tomto projekte:

|               | znamená                                          |
| ------------- | ------------------------------------------------ |
| **OBSAH**     | texty existujú v kóde                            |
| **ROUTABLE**  | `/pl/kontakt` vráti 200                          |
| **SELLABLE**  | dá sa objednať — produkty, cena, doprava, platba |
| **INDEXABLE** | Google ho smie indexovať (`MAKY_LIVE_MARKETS`)   |

`noindex` **nie je** zákaz nákupu. Preview trh sa dá kúpiť, ak má produkty a platbu.
`pl-pln` aj `hu-huf` majú dnes **0 produktov** — over si to, nespoliehaj sa na toto číslo.

---

## 11. Ako commitovať

DE/AT vlákno rozdelilo prácu tak, aby integrátor vedel posúdiť spoločné plochy zvlášť.
Zopakuj to:

1. **obsah** — telá v `src/ui/content/legal/` (aditívne, samostatne zmysluplné);
2. **vzorový formulár** — ak sa dotýkaš tej routy;
3. **pripravené texty Returns V2** — ak ich dodávaš;
4. **integračný commit** — `locale.ts`, routy, spoločné testy. **Toto je ten, ktorý
   vlastní integrátor**, a má byť čitateľný sám o sebe;
5. **dokumentácia**.

Vetva `claude/trh-pl-hu-*`, pushnutá, **nenasadená**.

---

## 12. Odovzdanie

Správa v troch oddelených častiach:

**IMPLEMENTOVANÉ** — čo je v kóde.

**OVERENÉ** — čo si spustil a s akým výsledkom. **Konkrétne čísla a výstupy**, nie „testy
prešli". Pri stránkach uveď HTTP kódy a **zoznam skutočne meraných URL** — nie odvodený
počet. (DE/AT vlákno si tu raz protirečilo: napísalo „24 stránok" o matici, ktorá má 32.)

**ZOSTÁVA** — jeden konkrétny zoznam s vlastníkom: národné právne údaje, ktoré sa nedali
overiť, prevádzkové fakty, ktoré chýbajú, a čo musí urobiť človek.

Pri každom právnom tvrdení **zdroj a dátum kontroly**. Ak zostáva neistota, ohranič ju
a navrhni najmenší bezpečný krok.

---

## 13. Čo beží súbežne a na čo nečakáš

| Vlákno               | Rieši                                                 | Čakáš naň?                          |
| -------------------- | ----------------------------------------------------- | ----------------------------------- |
| **Returns V2**       | viac-trhový kontrakt, časové udalosti, `returnMethod` | **nie** — dodáš texty pripravené    |
| **Integrácia / CMS** | `cmsPageRoute`, publikácia O nás, release             | **nie** — odovzdáš text             |
| **Katalóg / obchod** | produkty, ceny, doprava, Stripe                       | **nie** — to je SELLABLE, nie OBSAH |

Hotový trh nemá čakať na nesúvisiacu prácu iného trhu.

---

## 14. Otvorené položky, ktoré si so sebou nesie DE/AT

Nie sú tvoje, ale ak na ne narazíš, netvár sa, že neexistujú:

- **Inventár poskytovateľov a prenosov mimo EHP** je zámerne bez zmluvných subjektov —
  repozitár ich nevie overiť. Stránka odkazuje na `info@maky.store`. Ak sa doplní
  spoločný podklad, prekladá sa, nevymýšľa.
- **Komentár nad `RECIPIENTS` v `ochrana-osobnych-udajov.tsx` cituje čl. 15 ods. 2**
  ako základ pre odkaz na kontakt. Presnejší je **čl. 13 ods. 1 písm. f)**, ktorý
  výslovne pripúšťa uviesť „prostriedky na získanie kópie" záruk. Opravené v nemeckej
  časti; slovenská poznámka je pôvodná a patrí vlastníkovi spoločných plôch.
- **Suma priamych nákladov na vrátenie nadrozmerného tovaru** chýba a je to
  **predzmluvná** povinnosť. Neodhaduj ju ani pre PL/HU.
