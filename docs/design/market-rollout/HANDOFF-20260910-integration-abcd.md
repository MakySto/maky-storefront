# Integrácia po US/CA — zadanie pre nové vlákno (A, B, C, D + Saleor + Payload)

Napísané 10. 9. 2026 vláknom, ktoré dokončilo US/CA. Toto je **zadanie**, nie hotová práca.
Všetko nižšie označené „overené" som naozaj odmeral na vetve `claude/maky-store-us-ca-impl-4bb201`
@ `e1a4558`; čo som nemohol overiť, je označené `UNKNOWN` a nesmie sa vydávať za zistenie.

---

## 0. Východisko

|                        |                                                                   |
| ---------------------- | ----------------------------------------------------------------- |
| Zdrojová vetva         | `claude/maky-store-us-ca-impl-4bb201`                             |
| HEAD                   | `e1a45589739615d7092811643d7884c54219605e`                        |
| Posledný implementačný | `07115e07520d140848e56cf3504ef4a5b65fc41c`                        |
| Základ                 | `8bd1c6cc26adf0b79abcc28c5203f2efa9b44a82` (ES/RO tip)            |
| Stav                   | pushnuté, **nenasadené**, 1731 testov, 96/96 rout, regresia 80/80 |

Na tomto zdroji má legal registry **všetkých 12 trhov**. Prečítaj `HANDOFF-20260909-us-ca.md`
a `us-ca/PREFLIGHT.md` — najmä časť o negatívnej fixtúre a o PPR extraktore.

**Hranice:** vlastný worktree, integračná vetva, bežný push bez force. Žiadny deploy, PM2,
produkčný `.env`, zmena trhových prepínačov, platby, refundácie, zásielky ani zápis do
produkčného CMS bez osobitného GO. Toto nie je oprávnenie mergeovať do `release/*` ani `main`.

---

## 1. Čo je NAOZAJ rozbité (overené, nie odhad)

### 1.1 Footer skrýva všetky právne odkazy na 11 z 12 trhov ← najzávažnejšie

`src/ui/components/footer.tsx:31` — `const isSk = REVERSE_MAP[channel] === "sk"` a za ním
sú schované obe sekcie odkazov (`:50`) aj spodná dvojica (`:95`).

Overené v prehliadači **po hydratácii** (nie z raw HTML — footer je v Suspense a v shelli je
len skeleton, takže `curl | grep` dá falošnú nulu aj pre `sk`):

```
sk 10 odkazov   cz 0   de 0   es 0   us 0   ca 0
```

Stránky vracajú 200, ale návštevník sa k nim z pätičky nedostane. Komentár v tom istom
súbore hovorí, že `/kontakt` a `/obchodne-podmienky` musia byť linkované z každej stránky
(zákon 22/2004, smernica 2000/31/ES čl. 5) — a sám ich vypína. Komentár nad `LEGAL_SUPPORT`
(„Legal/content pages are SK-only and SK-channel-gated") je **dnes neplatný**.

### 1.2 Tlač nemá žiadne pravidlá

V celom `src/` **nie je ani jedno `@media print`**. `header-nav-row.tsx`, `footer.tsx` ani
`cookie-consent.tsx` nemajú `print:hidden` (overené: 0 výskytov v každom). `ModelFormActions`
volá `window.print()`, takže sa vytlačí aj navigácia, pätička a otvorená cookie lišta.
Jediné existujúce print pravidlo je `print:border-black print:bg-white` vo `withdrawal-receipt.tsx`.

### 1.3 Dva UI kľúče sú nepreložené v 9 jazykoch

|             | `footer.shippingAndPayment` | `footer.withdrawal`            |
| ----------- | --------------------------- | ------------------------------ |
| `sk-SK`     | Doprava a platba            | Odstúpiť od zmluvy tu          |
| ostatných 9 | **„Shipping and payment"**  | **„Withdrawal from contract"** |

Týka sa `cs-CZ, de-DE, de-AT, pl-PL, hu-HU, it-IT, fr-FR, es-ES, ro-RO` = **18 reťazcov**.
Dnes to nikto nevidí, lebo footer je vypnutý — **úloha A ich odhalí**. Musia sa doplniť
súčasne s A, inak sa v španielskej pätičke objaví anglický text.

⚠️ `footer.cookiePolicy` a `footer.contact` sú **v poriadku** — „Cookies" a „Contact" sú
v niektorých jazykoch legitímne rovnaké. Netreba ich meniť; naivný „identické s en-US"
scan ich falošne označí.

### 1.4 `<html lang>` — presne

`src/app/layout.tsx:22` renderuje `<html lang={LOCALE_MAP[DEFAULT_LOCALE].htmlLang}>` = `sk`,
staticky, pre **všetky** trhy. `src/providers/html-lang-updater.tsx` to opraví až
v `useEffect` po hydratácii. Prehliadač skončí na `lang="en"` pre `/us` a `/ca`; crawler,
`curl` a validátor vidia `sk`. Obidva anglické trhy sa mapujú na `en`, nie `en-US`/`en-CA`.

### 1.5 Cookie lišta je V PORIADKU — nehľadaj tam chybu

Marek si na screenshote všimol, že lišta „odskočila". **Nie je to chyba.** Overené
v reálnom viewporte: `position: fixed`, `bottom: 0px`, `z-index: 250`, `flushToBottom: true`,
plná šírka, footer rezervuje `padding-bottom` 96 px (mobil) / 64 px (desktop).

Bol to artefakt screenshotu: `Page.captureScreenshot` s `captureBeyondViewport: true`
skladá `fixed` prvok na jeho viewportovú pozíciu v rámci vysokého obrázka. **Na overovanie
fixed prvkov používaj viewport-only capture**, bez `captureBeyondViewport`.

---

## 2. ÚLOHA A — footer podľa trhu

**Súbor:** `src/ui/components/footer.tsx` (+ 9 message katalógov)

### Ako to spraviť

Neurob druhú mapu pravdy. `src/lib/route-policy.ts` už na túto otázku odpovedá a je
otestovaný (`route-policy.test.ts`, 11 testov):

```ts
marketHasRoute(market, segment): boolean
```

- `market` je **friendly slug** (`"us"`), nie Saleor slug. Footer už má `REVERSE_MAP[channel]`.
- `segment` je `href` bez vedúcej lomky: `/kontakt` → `"kontakt"`.
- Filtruj `LEGAL_SUPPORT` aj `LEGAL_COMPANY`; sekciu vykresli len ak jej zostal ≥ 1 odkaz.
- Rovnako filtruj spodnú dvojicu (`/ochrana-osobnych-udajov`, `/obchodne-podmienky`).
- Aktualizuj neplatný komentár nad `LEGAL_SUPPORT`.

### Prečo to rieši aj `/o-nas`

`marketHasRoute("us", "o-nas")` je **false** (CMS je sk-only), takže `/o-nas` z pätičky
vypadne na 11 trhoch samo a neotvorí 404. Keď Payload publikuje, zmení sa to na jednom
mieste — v `route-policy.ts` — a footer sa prispôsobí bez ďalšieho zásahu.

### Pasce

- **Nepridávaj `/poradna`** do footera. Je to CMS routa, `/sk/poradna` = 200, ostatné 404.
- **Nedriv to z `MAKY_LIVE_MARKETS` ani z indexačného flagu.** Dostupnosť právneho odkazu
  nesmie závisieť od toho, či sa na trhu predáva. Noindex nákup nezakazuje a rovnako
  nesmie skrývať povinné informácie.
- **Doplň 18 chýbajúcich prekladov (1.3).** Zdroj správneho znenia **nevymýšľaj** — vezmi
  ho z už schválených titulkov právnych rout: `src/app/[channel]/(main)/doprava-a-platba/page.tsx`
  a `.../odstupenie-od-zmluvy/page.tsx` majú per-jazyk `title`/`heading`
  (napr. `de` = „Widerrufsrecht", `at` = „Rücktrittsrecht", `es` = „Derecho de desistimiento",
  `ro` = „Dreptul de retragere"). Pätičkový label môže byť kratší, ale nesmie zaviesť
  tretie znenie toho istého pojmu.
- i18n parita musí zostať 12/12 identických (dnes 637 kľúčov). Meníš **hodnoty**, nie kľúče.

### Akceptácia A

- Reálne kliknutie v prehliadači **po hydratácii**, nie `curl` na URL. Pre každý z 12 trhov:
  počet právnych odkazov v `<footer>`, ich `href` a HTTP status cieľa.
- `sk` = 10 odkazov (vrátane `/o-nas`), ostatných 11 = 9 odkazov (bez `/o-nas`).
- Žiadny odkaz z pätičky nesmie viesť na 404.
- Žiadny anglický label v neanglickej pätičke.

---

## 3. ÚLOHA B — tlač vzorového formulára

**Súbory:** `src/ui/components/withdrawal/model-form-actions.tsx`, chrome komponenty,
prípadne `src/app/globals.css`

### Čo má tlač obsahovať

Celý čitateľný vzor + údaje predajcu. **Nie** navigáciu, vyhľadávanie, pätičku, cookie lištu
ani tlačidlá Print/Download (tie už `print:hidden` majú).

### Ako

Najmenší zásah: `print:hidden` na hlavičku, pätičku a `cookie-consent.tsx`, prípadne jeden
`@media print` blok v `globals.css`. **Žiadny nový PDF generátor, žiadna nová závislosť**
(CLAUDE.md §10).

### Akceptácia B

- CDP `Emulation.setEmulatedMedia({ media: "print" })` **a** `Page.printToPDF` — nie bežný
  screenshot. Bežný webový screenshot nie je dôkaz o tlači.
- Otestuj **s otvorenou aj zavretou** cookie lištou.
- A4 aj Letter (`paperWidth`/`paperHeight` v `printToPDF`): US/CA tlačia na Letter.
- Text vzoru v PDF musí zodpovedať dodanému `.txt` (49 riadkov) — parita je už overená
  v renderi, tu ide o to, že sa tlačou nič nestratí ani neoreže.

---

## 4. ÚLOHA C — label ovládača súkromia

**Rozsah je malý a presne ohraničený: iba `es` a `ro`.** Neurob z toho terminologický projekt.

Overená matica (čo stránka cookies menuje vs. čo footer naozaj vykreslí):

| jazyk            | stránka hovorí                  | footer vykreslí                 |                                 |
| ---------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| sk, pl, hu, fr   | zhodné                          | zhodné                          | OK                              |
| us, ca           | Privacy settings                | Privacy settings                | OK (už opravené v US/CA vlákne) |
| cs, de, deAt, it | _vetu o pätičke vôbec nemajú_   | —                               | netreba nič                     |
| **es**           | Preferencias de privacidad      | **Configuración de privacidad** | **MISMATCH**                    |
| **ro**           | Preferințe de confidențialitate | **Setări de confidențialitate** | **MISMATCH**                    |

Oprav **text stránky** na skutočný label footera (nie naopak) — rovnako ako to spravilo
US/CA vlákno. Dôvod: footer label je UI chrome, ktoré vlastní M, a mení sa na jednom mieste;
stránka je tá, čo odkazuje.

Súbory: `src/ui/content/legal/cookies.tsx`, telá `Es` (~riadok 1186) a `Ro` (~1297).
Čísla riadkov over grepom, mohli sa posunúť.

---

## 5. ÚLOHA D — `<html lang>` — POTREBUJE ROZHODNUTIE, NEIMPLEMENTUJ NASLEPO

Root layout je **nad** `[channel]`, takže o trhu principiálne nevie. Tri reálne cesty:

|        | Riešenie                                                                                               | Cena                                                                                                                 | Riziko                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **D1** | `headers()` v root layoute (proxy už posiela `x-market`, `x-locale`, `x-channel` — `proxy.ts:119-121`) | Root layout sa stane dynamickým → pri `cacheComponents: true` sa **stratí statický shell pre celý storefront**       | **Vysoké.** Presne to, pred čím varuje zadanie. Zmerať LCP/TTFB pred a po.                         |
| **D2** | Rozdeliť na dva root layouty cez route groups: `(storefront)/[channel]/…` a `(checkout)/checkout/…`    | Štrukturálny refaktor `src/app/`; treba doriešiť aj `src/app/page.tsx` (root redirect) a `error.tsx`/`not-found.tsx` | Stredné, ale je to **jediné riešenie, ktoré dá správny `lang` v prvotnom HTML bez straty statiky** |
| **D3** | Nechať tak, zdokumentovať                                                                              | 0                                                                                                                    | Crawler vidí `sk` na 11 trhoch. Predexistujúce od začiatku.                                        |

**Odporúčanie:** urobiť D ako **samostatný commit a samostatné rozhodnutie**, po A–C.
Najprv zmerať dopad D1 (build + `next start`, porovnať prerender manifest a TTFB), potom
predložiť Marekovi D1 vs D2 s číslami. **Nebrzdi tým A–C.**

Ak sa D robí: `lang="en"` je platné; `en-US`/`en-CA` sa dá vziať z `LOCALE_MAP[*].htmlLang`
alebo `ogLocale`, ale **nezakladaj kvôli tomu nový locale systém**. Žiadne vnorené `<html>`,
žiadna URL migrácia.

---

## 6. PAYLOAD `maky-cms` VPS — `/o-nas` pre 11 trhov

### Čo už funguje na storefronte (netreba stavať)

- `src/lib/cms/markets.ts` mapuje **všetkých 12 trhov** vrátane `US: "en"`, `CA: "en"`.
- Bloky majú pole `markets` a filtrujú sa per-trh (`isVisibleInMarket`, `page-schema.ts:255`).
- CMS odkazy sú **relatívne** (`cmsPathForRelationship` vracia `/o-nas` bez prefixu), takže
  `/us/` vs `/ca/` sa doplní samo — editor musí použiť **Page relationship**, nie natvrdo URL.

### Jediná brána v kóde

`src/lib/cms/page-route.tsx:65` — `isSlovakChannel()`, volaná na `:99` (metadata) a `:121` (page).
To je **dvojriadková zmena** — ale až keď v Payloade naozaj existuje publikovaný dokument,
inak sa otvorí 404 na 11 trhoch.

### Presný kontrakt, ktorý storefront volá

```
GET {PAYLOAD_CMS_URL}/api/pages
  ?where[slug][equals]=o-nas
  &where[_status][equals]=published
  &locale={sk|cs|pl|hu|ro|de|it|fr|es|en}
  &fallback-locale=none
  &depth=1
```

⚠️ **`fallback-locale=none` je zámerné.** Ak `en` locale nie je vyplnená, Payload vráti
prázdno → soft-404, **nie** slovenský text. To je správne správanie, nemeniť.

Dokument musí mať: `title`, `slug`, `summary`, `layout` (bloky), `markets`, `meta`,
`_status: "published"`, vyplnené v danej locale.

**Podporované `blockType`:** `hero`, `richText`, `image`, `gallery`, `cta`, `faq`, `mediaText`.
Akýkoľvek iný **zhodí celý dokument** (fallback na bootstrap / soft-404), nie len ten blok.

### ⚠️ Kľúčové obmedzenie: US a CA zdieľajú Payload locale `en`

Payload má **10 locales na 12 trhov** (AT+DE = `de`, US+CA = `en`). Dodané telá o-nas sa
ale líšia:

|     | US                                   | CA                        |
| --- | ------------------------------------ | ------------------------- |
|     | _traveling_                          | _travelling_              |
|     | _vacation_                           | _holiday_                 |
|     | „For customers in the United States" | „For customers in Canada" |

**Riešenie bez nového systému:** jeden `en` dokument, a tie odseky ako **dva `richText`
bloky s `markets: ["US"]` a `markets: ["CA"]`**. Zvyšok textu ako spoločné bloky s
`markets: null`. Toto Payload aj storefront **už vedia** — netreba nový model ani druhý
statický zdroj.

Rovnaká úvaha platí pre `de` (DE vs AT), ak sa o-nas bude publikovať aj tam.

### Zdroje textov

- `docs/design/market-rollout/us-ca/o-nas.{us,ca}.md` (H1, SEO, telo)
- `es-ro/o-nas.{es,ro}.md`, a analogicky pre staršie páry v ich adresároch

### Postup

1. **Dry-run proti fixture alebo izolovanému staging Payloadu**, nie proti produkcii.
2. Idempotentný import (opakované spustenie nesmie vyrobiť duplicitný dokument).
3. Až po overení: `route-policy.ts` — `o-nas` z `SK_ONLY` na trhy, ktoré CMS naozaj má.
4. Až potom brána v `page-route.tsx`.
5. **Produkčná publikácia len na osobitné GO.**

⚠️ Pripravený import **nie je** `CMS_PUBLISHED`. Prítomnosť textu v gite nie je dôkaz publikácie.

### Prístup

Repo `MakySto/maky-cms` **na tomto stroji nie je** — treba ho naklonovať. Produkčný CMS je
`cms.maky.store` za **Cloudflare Access**; `PAYLOAD_CMS_URL`, `PAYLOAD_CF_ACCESS_CLIENT_ID`
a `PAYLOAD_CF_ACCESS_CLIENT_SECRET` sú v produkčnom `/opt/storefront/.env`.
**Nekopíruj produkčné secrety do worktree ani do commitu** (CLAUDE.md §10.1 — repo je
verejný fork, commitnutý secret sa dá už len rotovať).

---

## 7. SALEOR VPS — bez tohto nie je US/CA predajné

### Overený stav (read-only, verejné API `https://api.maky.store/graphql/`)

| kanál               | existuje | produktov |
| ------------------- | -------- | --------- |
| `sk-eur`            | ✅       | **9 577** |
| `us-usd`            | ✅       | **0**     |
| `ca-cad`            | ✅       | **0**     |
| `zz-zzz` (kontrola) | ❌       | —         |

**Ako som existenciu dokázal** (a prečo počet produktov na to nestačí): `products(channel:)`
vráti `totalCount: 0` aj pre **neexistujúci** kanál, takže nula nič nedokazuje. Rozlišuje to
až `channel(slug:) { isActive }`: pre reálny kanál vráti `PermissionDenied` (kanál sa
vyriešil, chránené pole nie), pre vymyslený vráti `channel: null` bez chyby.

### `UNKNOWN` — musí overiť K v Saleor dashboarde

- Mena kanálov (`currencyCode`) — anonymne je staff-gated. Musí byť **USD** pre `us-usd`
  a **CAD** pre `ca-cad`. `CHANNEL_MAP` to na storefronte predpokladá.
- `isActive` oboch kanálov.
- Dodacie zóny pokrývajúce US a CA + dodacie metódy v nich.
- Sklad(y) priradené k tým zónam.
- Daňová konfigurácia.

### Čo treba spraviť

1. Publikovať produkty do `us-usd` a `ca-cad` (`channelListings`), s cenami v USD/CAD.
2. Dodacie zóny + metódy pre US/CA (FedEx, Slovenská pošta), vrátane hmotnostných/rozmerových
   pravidiel — CLAUDE.md §9: cenu vidí zákazník v košíku, žiadne „doprava zadarmo".
3. Overiť, že colné/dovozné náklady sú **v oznámenej cene** — to je jediný obchodný sľub,
   ktorý text robí a ktorý vie doložiť len K.
4. Stripe: povolené metódy pre US/CA; **Québec** — platba vopred je pri dotknutom predaji
   spravidla viazaná na kreditnú kartu (zdroj QC-4). To je výber metódy, **nie dôvod vypnúť
   celú Kanadu**.

### Čo Saleor NEBLOKUJE

Úlohy A–D ani Payload na Saleore nezávisia. Prázdne kanály nebránia tomu, aby právne
stránky boli dostupné — `noindex` ani prázdny katalóg nie sú dôvod skrývať povinné informácie.

---

## 8. Akceptačný beh (jeden, na konci)

- `tsc --noEmit`, `eslint`, `vitest run` — dnes 1731 testov, 9 skipped.
- i18n parita 12/12 identických (dnes 637 kľúčov).
- Reálny build vo vlastnom worktree. `pnpm build` padne na prebuild codegen hooku; použi
  `NEXT_PUBLIC_SALEOR_API_URL=… NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur NEXT_PUBLIC_STOREFRONT_URL=… npx next build`
  a **nenazývaj to štandardným buildom**.
- 96 statických rout (8 × 12): text, H1, jeden brand suffix, canonical, trhové odkazy.
- **Footer: reálne kliknutie po hydratácii pre všetkých 12 trhov**, nie HTTP 200 na ručnú URL.
- 360 / 1280 px + **print-preview cez `printToPDF`**, A4 aj Letter.
- Regresia proti `e1a4558` na 96 rout — nie proti `8bd1c6c`.
- Zachovať syntetický negatívny test aj pozitívne testy 12 reálnych trhov.

### ⚠️ Dve pasce, ktoré ma stáli kolo

1. **Regresný extraktor nesmie čítať iba `<main>`.** Pri PPR je v shelli len Suspense
   placeholder a telo príde neskôr v tej istej odpovedi v `<div hidden id="S:…">`.
   Prvý pokus hlásil bezchybných 80/80, pričom z 50 z 96 stránok neextrahoval **nič**.
   Ber celý dokument mínus `<script>`/`<style>` (to zároveň vyhodí RSC flight payload =
   druhú escapovanú kópiu toho istého). **Vždy vypíš minimálnu porovnanú dĺžku textu** —
   nula znamená falošný priechod. Hotový harness: pozri `HANDOFF-20260909-us-ca.md`.
2. **Footer a fixed prvky sa nedajú overiť z `curl`.** Footer je v Suspense (raw HTML má len
   skeleton) a `fixed` prvky sa v full-page screenshote zložia na nesprávne miesto.
   Používaj prehliadač po hydratácii a viewport-only capture.

Headless Chromium funguje: `~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`,
cez CDP obyčajným Node (`ws` je v `node_modules/.pnpm/ws@8.19.0/node_modules/ws`).
Chrome zabíjaj cez `pgrep -x chrome`, nikdy `pkill -f`.

---

## 9. Odovzdanie

Plný HEAD, základ, zmenené súbory, skutočne spustené príkazy s výsledkami, cesty k artefaktom.
Jedna matica po trhoch: **obsah / routa / CMS / Returns / obchod / nasadenie / indexácia**,
pri neoverenej položke `UNKNOWN`, nie automaticky `FAIL`.

Lokálne testy nie sú GitHub CI. Produkčný SHA a BUILD_ID sa čítajú z `MAKY_DEPLOY_META`,
nevymýšľajú sa. Historický BUILD_ID neprenášaj ako nové meranie.
