# Vlákno A — uzavretie (2026-09-05)

**Úzke dokončenie podľa zadania `A-FINAL-DOKONCENIE.md`. Žiadny nový audit, žiadne
modelovanie, žiadny Saleor upgrade, žiadne multimarket SEO.**

|           |                                                                       |
| --------- | --------------------------------------------------------------------- |
| Základ    | `origin/claude/sf-a-catalog-l10n-seo @ 9b78142`                       |
| Výsledok  | **5 commitov**, branch-only                                           |
| Testy     | 1175 → **1210** (80 súborov)                                          |
| Brány     | tsc 0 · lint 0 errors · i18n closure OK · locale matrix OK · build ✅ |
| Saleor    | **3.23.31** — codegen prebehol proti nej, bez blockera                |
| Produkcia | `feat/cms-m2 @ e353c70`, artefakt `bdcc925` — **nedotknutá**          |

```
BASE_SHA                    = 9b78142f1d249c39f9296c38e574f5b0b916252e
FINAL_SHA                   = (tip tejto vetvy)
CHECKOUT_LOOKUP_TRI_STATE   = PASS
AUTHENTICATED_DEADLINE      = PASS
NO_MUTATION_REPLAY          = PASS
EXISTING_CART_PRESERVED     = PASS
BROWSER_UAT                 = PENDING  (na tomto stroji prehliadač neexistuje)
SK_RELEASE_CANDIDATE        = YES, s výhradou BROWSER_UAT
MULTIMARKET_SEO_READY       = NO  (samostatné A4)
PRODUCTION_DEPLOYED         = NO
CATALOG_WRITES              = NO
```

**Oprava čísel z minulého handoffu:** vetva je **63 commitov / 175 súborov** pred
`e353c70`, nie „10/53". Tie čísla popisovali jednu vlnu, nie deltu voči produkcii.

---

## 1. Dve zadané chyby — a tretia, ktorá bola horšia

### Deadline nebol deadline

`reconcile()` čakal na čítanie a **až potom** sa pozrel na hodiny, takže čítanie, ktoré
sa nevrátilo, znamenalo, že sa na limit nikdy neprišlo. 2 500 ms bol popis šťastnej cesty.

Pod tým to bolo horšie: autentifikovaná cesta — jediná, ktorú add-to-cart používa — volala
`fetchWithAuth(url, input)` bez `signal`, takže 15 s AbortController transportu sa jej
netýkal vôbec. A telo odpovede sa číta až po návrate z `fetchWithRetry`, teda mimo každého
timeoutu — server, ktorý pošle hlavičky a potom zasekne stream, nebol ohraničený nikde.

Rozpočet teraz vynucuje **zrušenie práce**, nie kontrola hodín po jej návrate, a pokrýva
to, čo predtým nepokrýval: čakanie v procesnej fronte, autentifikačnú cestu, telo odpovede
aj spánok medzi čítaniami. Read-backy idú s `retry: false` — `CheckoutFind` je query, inak
si drží tri pokusy s exponenciálnym backoffom a jedno čítanie minie celý rozpočet samo.

**Overené zo zdroja SDK, nie predpokladom:** `runAuthorizedRequest` robí
`fetch(input, {...init, headers})`, takže signál sa **prenáša**. A refresh vetva sa
rekurzívne vracia do `fetchWithAuth`, ale pôvodnú požiadavku odosiela na každej vetve
práve raz — token refresh je samostatná operácia, nie prehratie nákupnej mutácie.

### Výpadok sa zamieňal s neexistujúcim košíkom

`Checkout.find()` vracal `null` pre dve rôzne veci a `findOrCreate()` konal podľa tej
druhej ako podľa prvej. Pár sekúnd nedostupnosti Saleoru → nový checkout → prepísaná
cookie. **Košík sa nezmazal. Zmazal sa ukazovateľ naň**, čo je z pohľadu zákazníka to isté
a je to nevratné.

`lookup()` teraz odpovedá `found | not-found | upstream-error`. Náhradný checkout vzniká
iba pri **potvrdenom** `not-found`, cookie sa zapisuje iba pre checkout, ktorý sme naozaj
vytvorili.

**Dôležitý rozdiel, ktorý som odmeral:** dobre tvarované ale neexistujúce ID vracia
`data.checkout: null` (→ `not-found` → nový košík, správne); **poškodené** ID vracia
GraphQL chybu (→ `upstream-error` → cookie ostane). Bežný prípad expirovaného košíka teda
funguje ďalej.

### Tretia chyba: náš vlastný duplicitný odosielač

Našiel som ju pri dokazovaní, že auth SDK neprehráva požiadavky. Neprehráva — ale
`graphql.ts` áno.

`try` obaľoval aj **volanie** `fetchWithAuth`, a klasifikátor prijme akúkoľvek chybu,
ktorej správa obsahuje `"cookies"`. Takže odmietnutie _samotnej požiadavky_ — upstream,
ktorý spomenie cookies, proxy chyba, reset spojenia s tým slovom — sa zodpovedalo
**opätovným odoslaním identického tela** cez neautentifikovaný fetch.

Pri `checkoutLinesAdd` je to druhá položka v košíku, vyrobená tým jediným miestom, ktoré
tomu má brániť. Ležalo to **pod** prácou o neprehrávaní na drôte aj pod read-backom a ani
jedno to nemohlo zachytiť: obe počítajú pokusy, ktoré robí `fetchWithRetry`, a toto sa
dialo vnútri jedného pokusu.

Regresný test som **najprv pustil proti starému kódu**: tam padá, tu prechádza.

---

## 2. Akceptačné dôkazy

Nie unit testy — skutočný build, `next start`, a prepínateľná proxy pred živým Saleorom.

| Scenár                                    | Operácie do Saleoru               | Cookie     | Čo videl zákazník             |
| ----------------------------------------- | --------------------------------- | ---------- | ----------------------------- |
| Reálna cookie + **503**                   | 12× `CheckoutFind`, **0× Create** | nedotknutá | „Košík sa nepodarilo načítať" |
| Neexistujúci checkout + **zdravý Saleor** | 3× `CheckoutFind`, 0× Create      | nedotknutá | prázdny košík (správne)       |

Obe vetvy sa teda naozaj rozlišujú, a „Váš košík je prázdny" sa pri výpadku
**nevyrenderovalo** (kontrolované na DOM po odstránení `<script>`, nie na flight payloade).

Ďalej overené na RC builde: `SKU: N21048|N20003|N15428|N15428`, `mpn` 0×, „Zobraziť celý
košík" v draweri, AVIF 10 613 B pri `Accept: avif`.

---

## 3. P1 — drawer

Atribútový blok **nikdy ani raz nebežal**: čítal `variant.attributes`, pole ktoré
`CheckoutFind` nevracia (query ich aliasuje ako `selectionAttributes` /
`nonSelectionAttributes`). TypeScript mlčal, lebo pole bolo `optional` a `lines` sa
odovzdáva premennou, takže excess-property check nikdy nebežal. Teraz je **povinné**, čo
je to, čo bráni opakovaniu.

**Odmerané pred zmenou: 0 zo 417 živých variantov má akýkoľvek atribút.** Oprava je teda
správna a **dnes nemení nič viditeľné** — a nepotrebuje prehliadač.

Súdržnosť draweru a `/sk/cart`: doplnená kategória a označenie variantu (obe už boli
v query aj v i18n), a preškrtnutá pôvodná cena sa už počíta **zdieľane**
(`compareAtLineTotal` v `pricing.ts`) namiesto toho, aby ju mal jeden povrch a druhý nie.
To je peňažný rozdiel — dnes neviditeľný (0 zo 417 variantov má zľavu), a práve preto sa
oplatí zjednotiť skôr, než prvá zľava rozdiel odhalí. **Čistá i18n delta: nula kľúčov.**

---

## 4. Saleor 3.23.31

- Codegen prebehol proti živej schéme, `CheckoutProblem` má teraz **4 členy**
  (`…DeliveryMethodStale` a `…DeliveryMethodInvalid` majú `delivery`, **nie `line`**).
- **A `Checkout.problems` nečíta v žiadnom dokumente** — overené grepom. Tiché riziko
  teda dnes neexistuje; keď sa začne čítať, musí vetviť cez `__typename`.
- `deliveryOptionsCalculate` / `Checkout.delivery` **zámerne nezavedené**.
- `checkoutShippingMethodUpdate` je iba deprecated a A ho nepoužíva.

---

## 5. Čo som našiel a **neopravil**

- **Cart page pri výpadku trvá ~14 s** (12× `CheckoutFind`: tri zobrazovacie lookupy ×
  štyri pokusy). Deadline zo zadania sa týka read-back fázy, ktorú som ohraničil;
  zobrazovacie čítania ho nemajú. Dať im `retry: false` je jednoriadková zmena, ale má
  reálny kompromis — krátky výpadok by potom ukázal „nepodarilo sa načítať" namiesto
  tichého zotavenia. To je rozhodnutie, nie oprava.
- **Poškodená checkout cookie** (nie expirovaná — poškodená) drží zákazníka v stave
  „nepodarilo sa načítať" natrvalo, lebo GraphQL chyba je `upstream-error`. Vyžaduje
  manipuláciu s cookie; konzervatívne správanie som nechal.
- `executeRawGraphQL` nemá frontu, timeout ani signál. Mimo rozsahu.
- **`ResilientProductImage`** (`codex/saleor-3-23-storefront-compat @ 3089012`) **nie je
  v tejto vetve.** Nezlučoval som ju.

---

## 6. BROWSER_UAT = PENDING, a prečo

Na tomto stroji prehliadač neexistuje (`aarch64`, Chrome for Testing nemá linux-arm64
build). Urobil som `next build` + `next start` + HTTP/DOM kontrolu a fault injection cez
proxy. **To nie je browser UAT a nevydávam to zaň.**

Na odovzdanie runneru: build a server musia byť z **tohto** commitu; overiť PDP a PLP,
galériu a zväčšenie, pridanie kusu, drawer → `/sk/cart`, reload a zachovanie cookie —
na desktope, mobile a **tablete v pásme 769–1023 px** (tam bol under-fetch galérie).

---

## 7. Prostredie — tri pasce

1. **`src/gql/` je gitignorované a generované.** Bez `pnpm generate:all` padne 17 test
   súborov.
2. **Build potrebuje `NEXT_PUBLIC_DEFAULT_CHANNEL`**, inak `generateStaticParams` vráti
   prázdno a cacheComponents build **spadne** na `/[channel]/cart`. Vyzerá to ako chyba
   kódu a nie je.
3. **`NEXT_PUBLIC_*` je zapečené do buildu** — potvrdené: `api.maky.store` je v **15
   serverových chunkoch**. Fault injection sa preto nedá spraviť premennou za behu; treba
   proxy na zapečenej URL, ktorá zmení správanie. A `pgrep -f "next start"` **zabije váš
   vlastný shell** — hľadajte PID cez `ss -ltnp`, a nikdy nesiahajte na `:3000`.
