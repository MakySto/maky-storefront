# Vlákno B — odovzdanie po rebase na nasadené A (2026-09-05, neskoro UTC)

Nadväzuje na `handoff-20260905-vlakno-b-pokracovanie.md` (ktorý zostáva platný pre
uzavreté rozhodnutia §5 a pasce §6). Tento dokument nesie **stav po rebase**, výsledok
prvého behu **reálnej** cesty a formát reportu podľa §10.

---

## 1. Stav

|                        |                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| vetva                  | `claude/sf-b-vehicles-continue-4f53aa`                                                                                |
| základ                 | `27b7088` = **nasadené A** (`MAKY_DEPLOY_META`, BUILD_ID `EeqdrEsFOEh2OMnTDHF03`)                                     |
| obsah                  | 11 commitov B (`a4d78cb..667c986`) cherry-picknutých na `27b7088` + 2 nové commity kódu (`b1e0395`, `bdb792b`) + docs |
| `claude/sf-b-vehicles` | **nedotknutá** na `667c986` (vysadená v inom worktree; force push zakázaný)                                           |
| nasadené               | **nič** — branch-only                                                                                                 |
| worktree               | `/opt/storefront/.claude/worktrees/sf-b-vehicles-continue-4f53aa`                                                     |

Rebase bol presne taký, ako bol zmeraný: jediný konflikt `.env.example` (nechané oboje),
12 i18n katalógov sa zlúčilo automaticky. Overené po rebase:

- každý súbor vlastnený B (mimo i18n a `.env.example`) je **byte-identický** s `667c986`;
- 165 kľúčov `fitment` / `garage` / `configurator` je vo všetkých 12 katalógoch;
- `common.onDemand` v `sk-SK` je verzia A („Na objednávku, dodanie 5–10 pracovných dní")
  a konfigurátor ju prevzal — vidno na screenshotoch;
- `pnpm generate:all` bežal proti živej **3.23.31**; `tsc` 0.

## 2. Čo sa zmenilo v kóde (dva commity)

**`src/lib/fitment/cart-actions.ts`** volá `addVariantToCart` z
`src/ui/components/plp/actions.ts` (A). Zmazané: `countLine()`, `addListingItemToCart`,
FormData hop, import `@/lib/checkout`. Zachované v tomto poradí: validácia vstupu →
provider → **serverový demo interlock** → re-read aktívneho vozidla → re-resolve fitmentu
pre ten produkt → presný variant → `verifyPurchasable` s `externalReference` → out-of-stock
→ hand-off s `quantity: 1`.

**`src/lib/fitment/cart-result.ts`** (čistý modul, bez `"use server"`): typy
`AddSetFailure` / `AddSetResult` a mapper `toAddSetResult`:

```
added                      → { ok: true }
unconfirmed                → lookup-failed     („Nevieme potvrdiť, či sa zostava pridala. Skontrolujte prosím košík.")
rejected / unavailable     → not-available     („Táto zostava už nie je v ponuke.")
rejected / iné             → cart-rejected     („Zostavu sa nepodarilo pridať do košíka.")
```

`unconfirmed` sa **nikdy** nestane `ok` ani `cart-rejected` — `checkoutLinesAdd` nie je
idempotentná a `cart-rejected` by pozývalo na druhý klik.

Druhý commit `bdb792b` (z adverzárnej revízie): **pred-mutačné** zlyhanie
`verifyPurchasable` (katalóg sa nedal opýtať, nič sa neposlalo) už **nie je**
`lookup-failed` — bola to tá istá veta „skontrolujte košík" pre stav, kde sa košík
preukázateľne nezmenil a druhý klik je bezpečný. Je to nový dôvod:

```
verifyPurchasable → lookup-failed  → catalogue-unavailable  („Dostupnosť zostavy sa teraz nepodarilo overiť. Skúste to prosím znova.")
```

`configurator.errorCatalogueUnavailable` pridaný do všetkých 12 katalógov (166 B kľúčov,
0 drift). Akcia navyše sama odmietne `productKind !== roof-rack-set` (`not-verified`) —
offer vrstva to filtruje, ale akcia je POST endpoint.

**`src/ui/components/vehicle/configurator-results.tsx`**: `next/image` →
`ResilientProductImage`; typ `AddSetFailure` sa importuje z `cart-result.ts`.

Testy: `cart-result.test.ts` (8, čistý mapper, vyčerpávajúco cez celý union) a
`cart-actions.composition.test.ts` (16, mocky provider/garage/offers/plp-actions,
**iba syntetické identity**): hand-off je volaný raz s `{channel, variantId, quantity: 1}`,
`unconfirmed → lookup-failed` aj na zloženej úrovni, každá brána pred košíkom zastaví
volanie. Pôvodný `cart-actions.test.ts` (demo interlock nad reálnou fixture, bez mockov)
je nezmenený.

## 3. Reálna cesta — prvýkrát spustená

Dočasný harness (vitest, in-memory cookie jar namiesto `next/headers`, po behu zmazaný,
**nikdy necommitnutý**) proti živému `api.maky.store`, kanál `sk-eur`:

| krok                                                                     | výsledok                                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `resolveFitmentOffers` s 3 refs (`UHJvZHVjdDo0ODE=` / `0ODI=` / `0ODM=`) | 3 ponuky, `isDemo=false`, `rejected` samé nuly                                                                               |
| `externalReference`                                                      | zhoduje sa s katalógom: `cfm:product:CFMP-B-NOR-57acce2f8ef56b-000000`, `…-d9331b111bd8fd-000000`, `…-7580c97859183e-000000` |
| cena presného variantu                                                   | 245,00 / 121,00 / 87,99 € (varianty `…NDgx` / `…NDgy` / `…NDgz`)                                                             |
| `metafield("cfm_availability_mode")`                                     | **`sale_to_order` na všetkých troch** (pri poslednej kontrole B bolo `null` — CFM to doplnilo) → `availability = on-demand`  |
| `translation(SK).name`                                                   | `null` → názov padá na `node.name` (už slovenský)                                                                            |
| thumbnail                                                                | 481 z `cdn.maky.store`, 482/483 z `api.maky.store/thumbnail/…` (retryable vzor)                                              |
| identity mismatch (zámerne cudzí `externalReference`)                    | `identity-mismatch = 1`, produkt vylúčený                                                                                    |
| cudzí variant                                                            | `variant-missing = 1`                                                                                                        |
| `productKind: roof-box`                                                  | `wrong-kind = 1`, bez dotazu                                                                                                 |
| `verifyPurchasable(483)`                                                 | `ok`, on-demand, 87,99 € ; s cudzou referenciou `identity-mismatch`                                                          |
| `addVariantToCart(483, qty 1)`                                           | **`{ status: "added" }`**, cookie `checkoutId-sk-eur` zapísaná, read-back `[{ variant: …NDgz, qty: 1 }]`                     |

Vznikol **jeden anonymný checkout** s jedným riadkom (id `Q2hlY2tvdXQ6OWFhZWU2MTMtZDk3OC00YWQ0LTk1ZGQtMGY0ZjFlNDc0ODA3`).
**Objednávka nevznikla.** Žiadny iný Saleor zápis.

Známy zvyšok nepresnosti (vedome ponechaný): A-ovský klasifikátor dáva `INSUFFICIENT_STOCK`
do `unavailable`, takže vypredanie zistené až mutáciou znie „už nie je v ponuke", kým to
isté zistené o krok skôr znie „Vypredané". Bez zmeny A-ovského kódu (§10) sa to rozlíšiť
nedá; na sale-to-order katalógu bez skladu je to prakticky nedosiahnuteľné.

Dve poctivé poznámky:

- `productKind = roof-rack-set` bol v harnesse **dodaný ručne**, aby sa mechanika dala
  spustiť. Nie je to CFM dáta. Saleor `productType.name = "Roof Rack Bundle"` to
  koroboruje, ale kontrakt vyžaduje kind zo zdroja fitmentu.
- **Zložená akcia `addConfiguredSetToCart` nebola spustená proti reálnym produktom** —
  potrebovala by vymyslený fitment riadok (vozidlo → produkt), čo handoff zakazuje. Jej
  zloženie dokazuje kompozičný test so syntetickými ID; každý živý spolupracovník
  (`verifyPurchasable`, `addVariantToCart`) bol dokázaný samostatne.

Saleor hlási `isAvailable: false` pri `isAvailableForPurchase: true` na všetkých troch.
`checkoutLinesAdd` napriek tomu prijal riadok, takže ide o sale-to-order bez skladu, nie
o blokujúci stav. Offer vrstva `isAvailable` nečíta, správne.

## 4. Prehliadač nad produkčným buildom

`pnpm build` (BUILD_ID `hYuxanKs3zJHTJxMT6Mjk`, lokálny, nenasadený) → `next start -p 3021`
s `MAKY_FITMENT_PROVIDER=fixture` a 40-znakovým `MAKY_GARAGE_COOKIE_SECRET`. Chromium 140
cez CDP, desktop 1440×900 a **360×780**, oba po **„Odmietnuť všetko"** (`maky-consent`
so všetkým `denied`).

| kontrola                                                                                 | desktop | 360 px |
| ---------------------------------------------------------------------------------------- | ------- | ------ |
| prázdny stav „Najprv vyberte vozidlo"                                                    | ✓       | ✓      |
| sheet: demo upozornenie, Škoda → Octavia → IV (NX) → 2022 → strecha/karoséria            | ✓       | ✓      |
| „Potvrdiť vozidlo" disabled kým chýba kvalifikátor                                       | ✓       | ✓      |
| po uložení: zhrnutie „Škoda Octavia IV (NX) · 2022 · Kombi · Integrované pozdĺžniky"     | ✓       | ✓      |
| 3 zostavy, 2× „Overené pre vaše vozidlo", 1× „Overené s podmienkami" + výzva kontaktovať | ✓       | ✓      |
| odznaky „Kompletná zostava" + „Ukážka", placeholder bez fotky, ceny, podmienky           | ✓       | ✓      |
| „V ukážke sa nedá nakupovať" disabled, žiadna reálna značka v DOM                        | ✓       | ✓      |
| „Na objednávku, dodanie 5–10 pracovných dní" (copy A)                                    | ✓       | ✓      |
| `/sk/garage`: 1 z 3, aktívne, Odstrániť, Otvoriť konfigurátor                            | ✓       | ✓      |
| cookie `maky-garage` httpOnly, SameSite=Lax, podpísaná                                   | ✓       | ✓      |
| všetky tlačidlá v `<main>` hydratované                                                   | ✓       | ✓      |

Screenshoty sú v scratchpade behu (efemérne) — 6 záberov, prezreté.

Nálezy z prehliadača:

- **React #418 (hydration mismatch)** na každej stránke — **aj na živej produkcii
  `maky.store/sk`** (a #419 na PLP). Nie je z B. Patrí A; nezasahoval som.
- Adverzárna revízia (5 šošoviek + 2 refutéri na nález) našla okrem `lookup-failed`
  dvojznačnosti iba pre-existujúce veci: en-CA parita (známe, §6.8 predchádzajúceho
  handoffu) a komentár pri `addListingItemToCart` v A-ovskom `plp/actions.ts`, ktorý
  tvrdí, že ho B ešte volá — už nevolá, wrapper je bez volajúceho. **Súbor A, nechal som
  ho** (§10); follow-up pre A: zmazať wrapper aj komentár.
- Na 360 px karta v garáži skracuje názov na „Škoda O…", lebo o šírku súperí chip
  „Aktívne vozidlo" a ikona odstránenia. Čitateľné, ale kozmetika B na neskôr
  (`garage-list.tsx`).
- `ResilientProductImage` v konfigurátore **nebolo vizuálne overené** — demo zostavy
  nemajú fotku, takže komponent sa nenamountoval. Renderuje sa iba v reálnej ceste, ktorá
  v prehliadači bez CFM snapshotu neexistuje.

## 5. Brány (nad `bdb792b`, posledný commit kódu; docs commit nad ním brány nemení)

```
tsc          0
lint         0 errors, 6 warnings — všetky mimo B (checkout hooky, generované gql, header)
i18n:check   OK (12 locales)
test:run     91 súborov, 1377 testov, 0 fail
build        exit 0, BUILD_ID Bbd5sHP4XHnOGV56SpX1E (lokálny, nenasadený)
```

Prehliadač zo §4 bol zopakovaný nad týmto buildom (desktop + 360 px, rovnaký scenár,
rovnaký výsledok).

## 6. Report (§10)

```
HEAD / remote                    kód bdb792b, docs commit nad ním = tip vetvy (over cez git ls-remote)
GUEST_GARAGE_FUNCTIONAL         = YES  [FIXTURE]  (prehliadač, prod build, desktop + 360)
CONFIGURATOR_FUNCTIONAL         = YES  [FIXTURE]  (prehliadač, prod build, desktop + 360)
PRODUCT_APPLICATIONS_FUNCTIONAL = YES  [FIXTURE]  (testy; PDP integrácia je B3.4, v prehliadači neoverené)
PROVIDER_CONNECTED              = NO
REAL_SNAPSHOT                   = NO
LIVE_OFFER                      = NO   (lookup/cena/identita/add-to-cart reálnych produktov dokázané
                                        na úrovni funkcií; ponuka bez fitment snapshotu neexistuje)
ACCOUNT_SYNC_IMPLEMENTED        = NO
PUBLIC_ACTIVATION_PERFORMED     = NO
integračný SHA pre vlákno A     = tip tejto vetvy (viď §1)
```

**Čo NIE JE overené a prečo:** zložená akcia proti reálnym produktom (vyžaduje fitment
riadok, ktorý nesmiem vymyslieť); `ResilientProductImage` v konfigurátore (demo nemá
fotky); PDP `CompatibilityBox` / `ProductVehicleApplications` v prehliadači (nie sú
zapojené — B3.4); `unconfirmed` vetva naživo (nedá sa vyvolať bez rozbitia transportu;
pokrýva ju test A aj kompozičný test B).

## 7. Čo zostáva (bez zmeny poradia)

- **B3.3** reálny fitment snapshot z CFM — kontrakt `2.0.0`, viď
  `lane-b-handoff-20260905.md` §6. Bez neho nič vyššie nemení stav `REAL_SNAPSHOT = NO`.
- **B3.4** integrácia (header launcher, hero, PDP CompatibilityBox + applications, PLP
  cez CFM facets → `filter:{ids}`) — presné riadky v `lane-b-handoff-20260905.md` §5.
  Vehicle filter cez Saleor atribúty stále NEZAPÁJAŤ.
- **B3.5** až potom.

Historické zmienky o „spätnom čítaní košíka" v `lane-b-handoff-20260905.md` §2/§5/§7
a v `handoff-20260905-vlakno-b-pokracovanie.md` §5 opisujú stav pred týmto commitom.
