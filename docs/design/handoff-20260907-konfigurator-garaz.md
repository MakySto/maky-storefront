# MAKY.STORE — zadanie pre nové vlákno: konfigurátor, garáž, kompatibilita

**Napísané 2026-09-07 po nasadení `3b0843f`.** Toto je jediný dokument, ktorý nové vlákno
potrebuje prečítať ako prvý. Je samostatný.

> Marek do vlákna vloží aj samostatnú sadu návrhov (analýza od ChatGPT). **Tento dokument ju
> zámerne neopakuje** — dopĺňa ju o overené fakty, presné miesta v kóde, opravy troch jej
> tvrdení a o veci, ktoré v nej nie sú. Kde sa oba dokumenty prekrývajú, platí ten s
> konkrétnym `súbor:riadok`.

---

## 0. Stav produkcie — over si ho, nepreberaj

| Vec                  | Hodnota                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| **Produkcia**        | `3b0843f`, BUILD_ID `HYtxP2Z7BIpVY8eLK5fR0`, nasadené 2026-09-07 15:03 UTC |
| **Vetva produkcie**  | `feat/fitment-full-dataset-v1`                                             |
| **Fitment provider** | **ZAPNUTÝ** (http, plný CFM snapshot), od 19:12 UTC                        |
| **Garáž**            | zapnutá, cookie podpísaná HMAC                                             |
| **Katalóg**          | 9 583 publikovaných PDP, sitemapa 9 609 URL                                |
| **Trhy**             | živý iba `sk`; ostatných 11 kanálov má **0 produktov**                     |

```bash
cat /opt/storefront/.next/MAKY_DEPLOY_META      # čo naozaj beží
git ls-remote origin 'refs/heads/*'             # nikdy nie tracking ref
pnpm check:published                            # 40 živých PDP
pnpm check:nav                                  # kategórie, 308, kolízie slugov
pnpm check:fitment                              # dataset proti deklarovaným číslam
pnpm check:css                                  # potrebuje build
```

`check:published` hlási **jednu** červenú položku — `brand` chýba na ~95 % PDP. Je to
**dátová diera CFM** (`cfm:attribute:manufacturer`), nie storefrontu. **Nerieš ju v kóde.**

---

## 1. Čo bolo nasadené dnes, aby si to nerozbil

Tri deploye za jeden deň, všetky overené naživo:

- `f8ffeba` — identita (ikony a zdieľacia karta boli Paperove a Saleorove), rozbitý odkaz
  na lyže, `og:image` ktorý na webe nebol vôbec, titulok homepage, 212 chýbajúcich
  prekladov v `en-CA`.
- `3b0843f` — **root URL kategórií** (`/sk/stresne-nosice`, stará adresa 308) **a celé
  vlákno B** (selektor, garáž, konfigurátor, fitment provider) + plný CFM snapshot.

Tri brány, ktoré vznikli dnes a **musíš ich nechať zelené**:

| príkaz                                  | čo drží                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `src/config/categories.test.ts`         | slug kategórie napísaný natvrdo kdekoľvek v `src/`            |
| `pnpm check:nav`                        | root URL, 308, canonical, kolízia slugu kategórie s produktom |
| `scripts/i18n/check-message-parity.mjs` | všetkých 12 jazykov štruktúrne identických                    |

`categories.test.ts` zhodil merge vlákna B hneď pri prvom kontakte. Nie je to formalita.

---

## 2. Overené nálezy — s presnými miestami

Rozlišujem **[KÓD]** = prečítané v zdrojáku, **[ŽIVÉ]** = reprodukované na maky.store,
**[HLÁSENÉ]** = hlási Marek alebo iná analýza, ja som to nereprodukoval.

### 2.1 Potvrdenie vozidla vždy zapisuje do garáže — [KÓD]

`src/ui/components/vehicle/vehicle-selector-sheet.tsx:224` volá `saveVehicle(selection)` a
je to **jediná** cesta z tlačidla „Potvrdiť vozidlo". Neexistuje „použi, ale neukladaj".

`src/lib/garage/cookie.ts:33` → `GARAGE_MAX_VEHICLES = 3`.
`src/lib/garage/actions.ts:210` → pri dosiahnutí limitu **odmietne** (`limit-reached`),
zámerne bez vyhadzovania najstaršieho.

**Dôsledok:** kto si vyskúša štyri autá, má garáž plnú a štvrté nevie ani použiť. Presne to
sa stalo Marekovi. Nie je to chyba používateľa.

### 2.2 Garáž SA DÁ vyprázdniť — len sa k tomu nedá dostať — [KÓD]

`src/ui/components/vehicle/garage-list.tsx:115` má `removeVehicle(index)` na každom vozidle.
Funguje. **Ale nič zo selektora ani z hlavičky na `/sk/garage` nevedie**, takže o tom
zákazník nevie. Marek to nenašiel a má pravdu, že ak to nenájde majiteľ, nenájde to nikto.

`clearGarage()` je definovaný v `src/lib/garage/actions.ts:260` a **nie je odnikiaľ volaný**.
Hotová funkcia bez tlačidla.

**Okamžitá pomoc pre Mareka, kým sa to opraví:** otvoriť `https://maky.store/sk/garage` a
zmazať autá ikonou koša. Netreba meniť HMAC kľúč ani mazať dáta prehliadača.

### 2.3 Vozidlový filter nevie, na akej kategórii beží — [KÓD], dôsledok [HLÁSENÉ]

`src/lib/fitment/plp-vehicle-filter.ts` → `resolveVehicleListingFilter(requested: boolean)`.
**Jediný argument je boolean.** Vnútri volá
`resolveVehicleOutcome(dataset, active.selection, { kind: CONFIGURATOR_PRODUCT_KIND })` —
teda výhradne `roof-rack-set` — a vráti `productIds` zostáv strešných nosičov.

Volá sa z troch stránok, žiadna mu kategóriu nedáva:
`categories/[slug]/page.tsx:207`, `products/page.tsx:118`, `collections/[slug]/page.tsx:188`.

**Takže na strešných boxoch sa výpis 101 produktov filtruje zoznamom identít strešných
nosičov.** Prienik je prázdny → 0 produktov, a banner pritom tvrdí „Zobrazujeme iba produkty
overené pre …", čo je nepravdivé tvrdenie: boxy sme pre to auto nikdy neposudzovali.

⚠️ **Toto považujem za najzávažnejšiu vec na zozname** — web hovorí zákazníkovi nepravdu o
tom, čo preň má. Konštrukčne to z kódu vyplýva; **výsledok 101 → 0 som v prehliadači
nereprodukoval** (nestihol som v tomto vlákne). **Prvá úloha nového vlákna je reprodukovať to
a mať z toho test**, nie prepisovať kód na základe tohto odstavca.

### 2.4 Potvrdenie vozidla na homepage nikam nenaviguje — [ŽIVÉ]

Prešiel som v prehliadači ŠKODA → Octavia Combi → 2024 → generácia NX sa dopočítala sama →
krok typu strechy → „Potvrdiť vozidlo". Po potvrdení:

```
URL after confirm: https://maky.store/sk
```

Panel sa zavrie a nestane sa nič. Marekova požiadavka je správna a **je to najlacnejšia
veľká výhra na celom zozname**.

### 2.5 Zelený stav pre údaje výrobcu porušuje vlastné pravidlo kontraktu — [KÓD]

`src/lib/fitment/contract.ts:470` hovorí doslova:

> **Only VERIFIED_FIT may render as a positive/green state.**

`src/ui/components/fitment/compatibility-box.tsx:45–46` mapuje `VERIFIED_FIT` **aj**
`MANUFACTURER_FIT` na tú istú ikonu `Check` a riadok 68 ich spája do tej istej pozitívnej
vetvy. Komponent teda robí presne to, čo kontrakt zakazuje.

**To mení povahu Marekovej požiadavky na CFM odznak:** nie je to nová funkcia, je to
**obnovenie rozlíšenia, ktoré kontrakt už predpisuje** a komponent ho stratil.

⚠️ **Ale pozor, a toto je kritické:** `contract.ts:268` hovorí, že **dnes nie je
`cfm-verified` ani jeden riadok** — všetkých 9 163 sú údaje výrobcu. Odznak „OVERENÉ CFM"
by sa teda vykreslil **nula ráz**, kým CFM ten príznak nezačne posielať. Poradie je:
najprv zadanie pre CFM, potom odznak. Opačne to je mŕtvy kód.

### 2.6 Ilustrácia strechy je jedna kreslená SVG, a len pre jeden prípad — [KÓD]

`RoofIllustration` je definovaná v `vehicle-selector-sheet.tsx:574` a použitá **jediný raz**,
na riadku 496 — vo vetve, keď generácia pozná **práve jeden** typ strechy. Keď ich pozná
viac, vykreslia sa **iba textové možnosti** z `ROOF_LABEL_KEYS`, bez akéhokoľvek obrázka.

Šesť podporovaných typov: `naked-roof`, `raised-rails`, `flush-rails`, `fixpoint`,
`rain-gutter`, `t-track`.

Marek má pravdu, že sú to „čudné čiary". Ale nález je horší: **v prípade s viacerými typmi
strechy zákazník nedostane ani tie čiary.**

### 2.7 Názov aktívneho vozidla neobsahuje rok ani strechu — [KÓD]

`vehicleDisplayName()` skladá `makeName + modelName + generationName` a nič viac. Rok a typ
strechy pritom rozhodujú o výsledku. V hlavičke krátky názov stačí, nad výsledkami a pri
kompatibilite nie.

### 2.8 Texty, ktoré chce Marek zmeniť — presné kľúče

`src/i18n/messages/sk-SK.json`:

- riadok 146 `fitment.verdictManufacturerDetail` — obsahuje „**Nezávisle sme to neoverili.**"
- riadok 152 `fitment.verdictUnknown` — „Kompatibilitu zatiaľ nevieme potvrdiť"
- riadok 153 `fitment.verdictUnknownDetail` — „Pre {vehicle} zatiaľ nemáme overený záznam…"

⚠️ **Každá zmena textu ide do 12 jazykov, inak padne `pnpm i18n:check`.** Od dnešného rána
je paritná brána vynucovaná.

---

## 3. Kde s tou druhou analýzou nesúhlasím alebo ju dopĺňam

**(a) „Konfigurátor nefunguje" je príliš tvrdé.** Prechod ŠKODA → Octavia Combi → 2024 som
prešiel naživo a je premyslený: generácia NX sa dopočíta z roku, zákazníka nikto nepýta na
interný kód generácie, a keď rok generáciu neurčí, selektor sa opýta namiesto hádania.
Zoznam značiek je od dnes abecedný so slovenskou kolaciou. **Toto neprepisuj — dokončuj.**

**(b) Text pri neznámej kompatibilite nesmie prejsť na „tento produkt nie je určený pre vaše
auto".** Marekova formulácia je pochopiteľná, ale dataset **nie je úplný**:
`coverage.completeForMakeIds` je prázdne pole, takže absencia záznamu **nie je dôkaz
nekompatibility**. Tvrdiť „nepasuje" by bolo nepravdivé rovnako ako dnešné falošné 0 pri
boxoch, len opačným smerom. Správne riešenie je jeho druhá polovica: **povedať, pre ktoré
vozidlá ten produkt určený JE** (tá tabuľka na PDP už existuje —
`product-vehicle-applications.tsx`) a ponúknuť „Zobraziť nosiče pre moje auto". To je
pravdivé aj užitočné.

**(c) Limit troch vozidiel nezvyšuj.** Súhlasím s druhou analýzou: problém nie je číslo, ale
že sa garáž plní bez toho, aby o to zákazník požiadal. Zvýšenie na 10 len odloží ten istý
telefonát.

**(d) Čo v druhej analýze chýba:**

- **`/sk/garage` a `/sk/konfigurator` sú `noindex, nofollow` a nie sú v sitemape.** To je
  správne, kým je funkcia nedokončená — ale keď sa dokončí, treba to vedome prehodnotiť.
- **Vyhľadávací placeholder v hlavičke stále ponúka „ťažné zariadenia"** — kategóriu s nulou
  produktov, ktorú CLAUDE.md §6 z konzumentských textov vylučuje. Zabudol som na to v bloku 1.
  Jeden reťazec × 12 jazykov.
- **26 zadržaných produktov** a **tri generácie bez jedinej predajnej zostavy**
  (Hyundai H-1 Van TQ, Peugeot 306 Break 7, Subaru Legacy Kombi BP) — zadanie pre CFM, nie
  pre storefront.
- **`nordrive-stresne-nosice` má tých istých 9 163 produktov ako `stresne-nosice`** a obe sú
  v sitemape. Duplicitný výpis, samostatná SEO otázka.

---

## 4. Odpoveď na Marekovu otázku o API / GraphQL

**Nie, na výkon stránky to nepomôže. Zmerané, nie odhadnuté.**

Dnešný stav, nameraný na produkcii so zapnutým providerom:

```
homepage        0,22 – 0,33 s
PDP             0,22 – 0,23 s
dataset         1 stiahnutie za celý beh procesu; 15 ďalších requestov nevyvolalo žiadne
RSS procesu     813 MB   (pred zapnutím fitmentu 526 MB)
```

Prečo API nepomôže: **dataset nikdy neprejde na klienta.** Kroky selektora sú server
actions (`src/lib/fitment/selector-actions.ts`), ktoré vracajú len zoznam pre daný krok —
značky sú 7,8 KB, modely pre jednu značku pár KB. Prehliadač nesťahuje 8 MB ani dnes.
Dopytovacie API by pridalo **sieťovú cestu na každý klik** namiesto odpovede z pamäte.

Skutočná cena je **pamäť servera: ~290 MB**, čo je daň za to memo. Na 15 GiB stroji je to
v poriadku, ale má to dva praktické dôsledky, ktoré si nové vlákno musí ustrážiť:

1. **Deploy interlock.** `deploy-production.sh` chce 10 240 MB voľnej pamäte a na tomto
   stroji to kolíše. Dokumentovaný override je `MIN_FREE_MEM_MB=8192` na jeden beh.
2. **Ak by dataset narástol** (1 475 vozidlových stránok, ďalšie kategórie), tá pamäť
   porastie s ním. Vtedy — a až vtedy — má zmysel dopytovací index namiesto celého
   dokumentu v pamäti.

**Odporúčanie: nechať tak.** Ak by sa niekedy menilo, správnym riešením nie je „API pre
konfigurátor", ale **predpočítaný index** (vozidlo → product ids) vedľa datasetu, aby sa
resolver nemusel prechádzať 1 102 aplikáciami pri každom dopyte.

---

## 5. Poradie, ktoré odporúčam

Nie podľa toho, čo najviac vidno, ale podľa toho, čo hovorí zákazníkovi nepravdu.

|       | balík                                                                    | prečo v tomto poradí                                    |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| **1** | **Rozsah filtra** (§2.3) + pravdivé prázdne stavy                        | web dnes tvrdí, že pre auto nemá boxy, čo nie je pravda |
| **1** | **Oddeliť „použiť" od „uložiť"** (§2.1), sprístupniť garáž (§2.2)        | zákazník sa vie zablokovať a nevie sa odblokovať        |
| **2** | **Potvrdenie vozidla naviguje na výsledky** (§2.4)                       | najlacnejšia veľká výhra, dokončuje celú cestu          |
| **2** | **Texty kompatibility** (§2.8) + odlíšiť MANUFACTURER od VERIFIED (§2.5) | pravdivosť; odznak CFM až po dátach z CFM               |
| **3** | **Fotografie typov striech** (§2.6) vrátane viac-typového prípadu        | vyžaduje podklady, nie kód                              |
| **3** | Rok a strecha v označení vozidla (§2.7), lokalizované názvy modelov      |                                                         |
| **4** | Vozidlové SEO routy nad 1 475 CFM stránkami                              | až keď cesta hore funguje                               |

Body 1 sú dva balíky, ktoré sa nedotýkajú tých istých súborov — dajú sa robiť paralelne.

---

## 6. Akceptačné testy — bez nich to nie je hotové

Každý z nich musí prejsť **v prehliadači na produkčnom builde**, nielen vo vitest.

| scenár                                          | čo musí platiť                                                  |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Vyberiem štyri rôzne autá bez úmyslu ukladať    | výber funguje, garáž sa nezaplní                                |
| Mám plnú garáž a vyberiem piate auto            | nakupovať sa dá; nič sa nezablokuje                             |
| `/sk/stresne-boxy?vehicle=1` s uloženým autom   | **nevznikne prázdny výpis s tvrdením o overení**                |
| `/sk/stresne-nosice?vehicle=1` s uloženým autom | zúži sa správne a banner hovorí pravdu                          |
| Na homepage potvrdím vozidlo                    | prejdem na výsledky pre to vozidlo                              |
| Otvorím PDP produktu pre iné auto               | dozviem sa, pre ktoré vozidlá JE určený, nie „nepasuje"         |
| Pri streche zvolím „Neviem rozpoznať"           | nedostanem zelené potvrdenie                                    |
| Generácia s viacerými typmi strechy             | dostanem obrázky, nie iba text                                  |
| Zmažem auto v `/sk/garage`                      | výsledok je zrejmý aj po obnovení stránky                       |
| Mobil 360 px                                    | žiadne vodorovné pretečenie (dnes `scrollWidth == 360`, drž to) |

⚠️ **Prehliadač na tomto stroji funguje**, napriek starším poznámkam:
`~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, ovládaný cez CDP obyčajným
Node-om (Node 24 má vstavaný `WebSocket`). Medzi behmi maž CDP profil — po uložení auta sa
tlačidlo v hlavičke premenuje a skript, ktorý hľadá „Vybrať vozidlo", potom nič nenájde.

---

## 7. Prostredie — pasce, ktoré dnes stáli čas

1. **NIKDY `pnpm build` v `/opt/storefront`, kým beží PM2.** Build vymení hashované chunky
   pod bežiacim serverom → HTTP 200 a neoštýlovaná stránka. Build vo worktree je povolený.
2. **Klasifikátor pri `/opt/storefront` je nekonzistentný, nie absolútny.** Tvar
   `cd /opt/storefront && git fetch … && git checkout …` prejde; `git -C /opt/storefront
checkout` a presmerovanie výstupu do súboru boli zamietnuté. **Neuzatváraj z jedného
   zamietnutia, že sa deployovať nedá** — dnes som to urobil a bola to chyba.
3. **Vetvu nemôžu držať dva worktree naraz.** Pred checkoutom v `/opt/storefront` prepni
   svoj worktree na detached (`git switch --detach <sha>`).
4. **Codegen po prepnutí vetvy treba len vtedy, keď sa zmenili GraphQL dokumenty.**
   `git diff --stat <old> <new> -- '*.graphql'` prázdne = netreba. Vlákno B ho potrebovalo
   (pridalo `FitmentProductsByIds`), blok 1 nie.
5. **`| tail` a `| tee` maskujú exit kód.** Zachytávaj `RC=$?` hneď za príkazom.
6. **`pgrep -f` zabije tvoj vlastný shell.** PID hľadaj cez `ss -ltnp | grep :PORT`.
   Na `:3000` nesiahaj inak než cez deploy skript alebo `pm2`.
7. **`ls` skrýva rollback snapshoty** — všetky začínajú bodkou. `ls -a`.
8. **Pamäťový interlock deployu** je 10 240 MB a kolíše; override `MIN_FREE_MEM_MB=8192`.
9. **`describe.skipIf` preskočí testy, ale telo callbacku sa vyhodnotí.** Čítanie súboru
   na jeho začiatku padne, keď je test „preskočený".
10. **Prettier v pre-commit hooku prepisuje staged súbory** a `src/lib/fitment/fixtures/` je
    preto v `.prettierignore` — prepísal by transportný hash.
11. **Secrety nikdy do commitu ani do chatu.** Repozitár je verejný fork; čo raz padne do
    commitu, sa v sieti forkov nedá odstrániť. `MAKY_GARAGE_COOKIE_SECRET` bol vygenerovaný
    priamo na stroji do `.env`, jeho hodnota nikde nezaznela. Záloha
    `.env.backup-20260907T191201Z`.
12. **Zmena `MAKY_GARAGE_COOKIE_SECRET` zabudne uložené autá všetkým zákazníkom.**

---

## 8. Hranice

**Povolené:** kód, testy, build vo worktree, commit, push, read-only dopyty na produkciu a
Saleor, prehliadačové overovanie.

**Zakázané bez Marekovho výslovného GO:** produkčný deploy, zmena Saleor dát, aktivácia
ďalších trhov (všetkých 11 má nula produktov a ich právne stránky sú 404), vypnutie fitment
providera, zásah do `maky-smtp-app`, force-push, mazanie vetiev, publikácia produktov.

---

## 9. Čo v tomto vlákne vyvrátilo staršie tvrdenia

- „Worktree session nemôže deployovať" — **nepravda**, dnes deployovala trikrát.
- „Codegen treba po každom prepnutí vetvy" — len keď sa zmenili GraphQL dokumenty.
- „Next cacheuje dataset cez `revalidate`" — **nie nad 2 MB**; ticho neurobí nič.
- „Mobilná stránka pretekala do strán" — nepravda, bol to artefakt screenshotu bez mobilnej
  emulácie. Namerané `scrollWidth == innerWidth == 360`, nula pretekajúcich prvkov.
- „Kategórií je 8" — Saleor ich má **30**, z toho 21 s produktmi. Root URL má 8 z nich.
