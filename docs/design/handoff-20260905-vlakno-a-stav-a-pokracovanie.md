# MAKY.STORE — stav a zadanie pre nové vlákno (2026-09-05, 22:30 UTC)

**Toto je jediný dokument, ktorý nové vlákno potrebuje prečítať ako prvý.** Je
samostatný: obsahuje stav produkcie, stav vlákna A, diagnostiku výpadku, ktorý sa práve
stal, a zoznam toho, čo zostáva.

---

## 0. TL;DR — čo sa stalo a kde sme

| Vec                    | Stav                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| **maky.store**         | ✅ **BEŽÍ.** Bola dole; opravené o 22:04 reštartom PM2.                  |
| **Produkčný commit**   | `3089012` (Codexova oprava obrázkov)                                     |
| **BUILD_ID**           | `4AUvZOM-cw-dCnOrMxrQg`                                                  |
| **`MAKY_DEPLOY_META`** | ❌ **CHÝBA** — nasadené mimo deploy skriptu                              |
| **Rollback snapshoty** | ❌ **ŽIADNE.** `/opt/storefront-rollbacks/` je prázdny.                  |
| **Vetva A**            | `origin/claude/sf-a-catalog-l10n-seo @ 07f0e3e`, pushnutá, branch-only   |
| **Pätička**            | ✅ Nebola to samostatná chyba — bol to symptóm výpadku. Vysvetlené v §2. |

---

## 1. Výpadok: čo sa presne stalo (a čo z toho platí do budúcna)

**Príčina.** Codex spustil `pnpm build` priamo v `/opt/storefront`, kým bežal PM2 proces.
To je presne to, čo CLAUDE.md §13.1 zakazuje. Build prepísal `.next` novými hashovanými
chunkami; bežiaci `next start` (uptime 29 dní) mal v pamäti starý manifest a servíroval
HTML odkazujúce na chunky, ktoré build zmazal.

**Symptóm.** `HTTP 200` na `/sk` — a rozbitá stránka. Presne ten prípad, ktorý §13.1
opisuje ako neviditeľný pre monitoring, čo kontroluje len status kód. Namerané pred
opravou:

```
/sk                          HTTP 200, 111 335 B
5 z 20 referencovaných chunkov   HTTP 500  (súbory neexistovali na disku)
```

**Oprava.** `pm2 restart maky-storefront` (§13.4: platné zotavenie po _dokončenom_ builde,
`BUILD_ID` existoval). `maky-smtp-app` som nechal na pokoji — beží 35 dní bez prerušenia.

**Overenie po oprave** — nie „HTTP 200", ale každý asset:

```
/sk        22 assetov, 0 zlyhaní   (lokálne aj verejne)
/sk/products   24 / 0
/sk/cart       22 / 0
PDP Niva       24 / 0
/sk/kontakt    21 / 0
```

**Pozor na pascu, do ktorej som sám spadol:** hneď po reštarte ešte 5 chunkov padalo.
Nebola to neúspešná oprava — na disku ležalo staré prerenderované HTML z predchádzajúceho
buildu a `next start` ho servíruje, kým ho ISR neprepíše. `sk-eur.html` sa prepísal o
22:04 a odvtedy je čisté. **Po reštarte teda počkaj a meraj znova, nezáver z prvého behu.**

### Čo zostáva otvorené po tomto výpadku

1. **Neexistuje rollback snapshot.** Codexovo tvrdenie, že „zachované sú staršie rollback
   snapshoty `a5e5ff3` a `b6b633`", je **nepravdivé** — `/opt/storefront-rollbacks/` je
   prázdny (overené cez `sudo -n ls`). Produkcia teraz beží bez akejkoľvek zálohy.
2. **Chýba `MAKY_DEPLOY_META` a záznam v `/opt/DEPLOYMENTS.log`** (posledný je zo 7. augusta). Nikde nie je zapísané, čo vlastne beží.
3. **Odporúčanie:** pri najbližšej príležitosti spustiť riadny
   `./scripts/ops/deploy-production.sh -m "..."` na `3089012`. Nie preto, že stránka je
   rozbitá — nie je — ale preto, že to vytvorí snapshot, metadata a log. Predpoklady sú
   splnené (čistý strom, sudo OK, ~11,8 GB voľných).

---

## 2. Pätička — diagnóza: nebola to samostatná chyba

Nahlásené: „zmenila sa farba" a „na produktovej stránke sa vôbec nezobrazuje".

Prešiel som to a **oboje bolo prejavom toho istého výpadku.** Reťazec:

```
layout.tsx:99   <footer class="animate-skeleton-delayed bg-foreground text-background opacity-0">
```

To je `FooterSkeleton`, teda **Suspense fallback**, nie skutočná pätička. Skutočná
pätička príde v streame v `<template>` a React ju vymení cez `$RC` — **klientským JS**.

Takže keď JS chunky vracali 500, výmena sa nikdy nestala, v DOM ostal skeleton — a ten má
`opacity-0`. Odtiaľ „pätička sa vôbec nezobrazuje". Na homepage sa CSS načítalo len
čiastočne, takže pätička sa vykreslila neoštýlovaná — odtiaľ „zmenila sa farba".

Overené, že to nie je token problém: `--color-foreground: var(--text-primary)` aj
`--color-background: var(--surface-primary)` sú v nasadenom CSS **definované**. Shadcn
most (CLAUDE.md §4.2) tu funguje.

### Jedna reálna vec, ktorú to odhalilo — a treba ju posúdiť

`animate-skeleton-delayed` **nie je definované nikde** — ani v `brand.css`, ani
v `globals.css`, ani v `checkout/index.css`, a `git log -S` nenašiel, že by kedy bolo.
V nasadenom CSS existujú iba `animate-ping`, `animate-pulse`, `animate-spin`.

Používa sa na **5 miestach** a všade v páre s `opacity-0`:

```
src/app/[channel]/(main)/layout.tsx:99              (pätička — každá stránka)
src/app/[channel]/(main)/products/page.tsx:174
src/app/[channel]/(main)/products/loading.tsx:9     (-long)
src/app/[channel]/(main)/collections/[slug]/page.tsx:239
src/app/[channel]/(main)/search/page.tsx:142
```

Pri fungujúcom JS to nevadí — skeleton má byť neviditeľný a hneď sa nahradí. **Ale keď JS
zlyhá, pätička je neviditeľná**, a s ňou odkazy na `/kontakt` a `/obchodne-podmienky`,
ktoré podľa CLAUDE.md §9 musia byť dostupné z každej stránky (zákon 22/2004, smernica
2000/31/ES čl. 5). To nie je kozmetika, ale ani to nie je akútne.

**Rozhodnutie pre nové vlákno, nie odo mňa:** buď definovať tú animáciu (fade-in po
oneskorení, ako to zjavne bolo zamýšľané), alebo `opacity-0` zo skeletonov odstrániť.
Neriešil som to — bolo by to tiché rozšírenie rozsahu do CSS na produkčnej ceste.

---

## 3. Vlákno A — čo je hotové

**`origin/claude/sf-a-catalog-l10n-seo @ 07f0e3e`**, pushnutá, **branch-only**.
63 commitov / 175 súborov pred `e353c70`.

```
Testy   1210 / 80 súborov     tsc 0     lint 0 errors
i18n    closure OK, locale matrix OK (12 lokalizácií)
build   zelený; akceptácia overená proti živému Saleoru cez prepínateľnú proxy
Saleor  codegen proti 3.23.31 prebehol, bez blockera
```

Detailný popis: `docs/design/handoff-20260905-vlakno-a-uzavretie.md`.
Kontrakt pre vlákno B: `docs/design/lane-a-contracts-for-lane-b.md`.

Posledná vlna opravila tri chyby v košíku/transporte:

1. **Deadline nebol deadline** — `reconcile` čakal na čítanie a až potom pozrel na hodiny;
   autentifikovaná cesta nemala `signal` vôbec. Teraz sa vynucuje zrušením práce a pokrýva
   frontu, auth cestu, **telo odpovede** (ktoré nemalo timeout na žiadnej ceste) aj spánok
   medzi čítaniami.
2. **`Checkout.find` zamieňal „neexistuje" s „nevedeli sme sa spýtať"** — pár sekúnd
   výpadku vytvorilo nový checkout a prepísalo cookie. Teraz
   `lookup() → found | not-found | upstream-error`.
3. **Náš vlastný duplicitný odosielač** — `try` v `graphql.ts` obaľoval aj _volanie_
   `fetchWithAuth` a klasifikátor prijme akúkoľvek chybu so slovom „cookies"; zlyhanie
   samotnej požiadavky sa zodpovedalo opätovným odoslaním tela. Pri `checkoutLinesAdd` je
   to druhá položka v košíku.

**BROWSER_UAT = PENDING.** Na tomto stroji prehliadač neexistuje (aarch64, Chrome for
Testing nemá linux-arm64 build).

---

## 4. Čo má nové vlákno spraviť

Poradie je zámerné.

### P0 — dokončiť ops po výpadku

- Spustiť `./scripts/ops/deploy-production.sh -m "..."` na `3089012`, aby vznikol
  snapshot, `MAKY_DEPLOY_META` a záznam v logu. **Až po odsúhlasení Marekom.**
- Po ňom overiť **každý asset**, nie status kód (postup v §1).

### P1 — pätička / skeleton

- Rozhodnúť medzi definovaním `animate-skeleton-delayed` a odstránením `opacity-0`.
- Skontrolovať všetkých 5 miest, nielen pätičku.
- Pozri §2. Je to malé, ale dotýka sa právne povinných odkazov.

### P2 — dokončiť A

- **BROWSER_UAT** nad presným `07f0e3e`: PDP, PLP, galéria a zväčšenie, pridanie kusu,
  drawer → `/sk/cart`, reload a zachovanie cookie — desktop, mobil a **tablet 769–1023 px**
  (tam bol under-fetch galérie).
- Až potom `SK_RELEASE_CANDIDATE` → nasadenie na samostatný pokyn.
- ⚠️ **A musí najprv začleniť `3089012`**, inak by jej nasadenie odstránilo Codexovu
  opravu obrázkov.

### P3 — nechané zámerne (v reporte majú vlastnú sekciu)

- Cart page pri výpadku trvá ~14 s (3 zobrazovacie lookupy × 4 pokusy). `retry: false` je
  jednoriadková zmena, ale krátky výpadok by potom ukázal chybu namiesto tichého
  zotavenia — rozhodnutie, nie oprava.
- Poškodená (nie expirovaná) checkout cookie drží zákazníka v „nepodarilo sa načítať".
- `executeRawGraphQL` nemá frontu, timeout ani signál.
- Multimarket SEO = samostatné **A4** (lokalizovaný URL reťazec, sitemap index,
  identity-based hreflang). **Neblokuje SK release** — pri jednom živom trhu je hreflang
  prázdny a exact-locale inertné.

---

## 5. Prostredie — pasce, ktoré stoja hodiny

1. **NIKDY `pnpm build` v `/opt/storefront`**, kým beží PM2 (§13.1). Práve to spôsobilo
   tento výpadok. Build vo worktree je výslovne povolený (§13.7).
2. **`pgrep -f "next start"` zabije tvoj vlastný shell.** Stalo sa mi to. PID hľadaj cez
   `ss -ltnp | grep :PORT`. A **nikdy nesiahaj na `:3000`** — to je produkcia
   (PID bežiaceho procesu si over, nie meno).
3. **`NEXT_PUBLIC_*` je zapečené do buildu** — `api.maky.store` je v **15 serverových
   chunkoch**. Fault injection sa preto nedá spraviť premennou za behu; postav proxy na
   zapečenej URL a meň správanie proxy. Tak som overil 503 scenár.
4. **`src/gql/` je gitignorované a generované.** Bez
   `NEXT_PUBLIC_SALEOR_API_URL=… pnpm generate:all` padne 17 test súborov.
5. **Build potrebuje aj `NEXT_PUBLIC_DEFAULT_CHANNEL`**, inak `generateStaticParams` vráti
   prázdno a cacheComponents build spadne na `/[channel]/cart`. Vyzerá to ako chyba kódu
   a nie je. Funkčná sada:
   ```
   NEXT_PUBLIC_SALEOR_API_URL=https://api.maky.store/graphql/ \
   NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur \
   NEXT_PUBLIC_STOREFRONT_URL=https://maky.store \
   MAKY_LIVE_MARKETS=sk pnpm build
   ```
6. **Po reštarte PM2 počkaj, kým ISR prepíše staré prerenderované HTML**, inak nameriaš
   zlyhania, ktoré už neexistujú (§1).
7. **`| tail` maskuje exit kód.** Zachytávaj ho zvlášť.
8. **Na tomto stroji nie je prehliadač.** HTTP kontrolu nevydávaj za browser test.

---

## 6. Saleor 3.23.31 — čo z toho platí pre storefront

- Codegen proti živej schéme prebehol; `CheckoutProblem` má teraz **4 členy**
  (`…DeliveryMethodStale` a `…DeliveryMethodInvalid` nesú `delivery`, **nie `line`**).
- **A `Checkout.problems` nečíta v žiadnom dokumente** — overené grepom. Keď sa začne
  čítať, musí vetviť cez `__typename`.
- `deliveryOptionsCalculate` / `Checkout.delivery` existujú, **zámerne nezavedené** —
  samostatná migrácia checkoutu.
- `checkoutShippingMethodUpdate` je iba deprecated (nie odstránené) a A ho nepoužíva.
