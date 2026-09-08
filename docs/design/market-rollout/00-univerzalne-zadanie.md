# Univerzálne zadanie — pridanie jazykovej verzie a spustenie trhu

Platí pre **každé** vlákno rozvoja trhov. Pár trhov má navyše vlastný súbor
(`01-de-at.md` … `05-us-ca.md`); ten dopĺňa toto zadanie, nenahrádza ho.

Napísané 2026-09-08 po dokončení SK + CS. Vlákna môžu bežať **paralelne** — dotýkajú
sa rôznych súborov obsahu a jedného zdieľaného zoznamu (§ 3.1), ktorý sa rieši rebasom.

---

## 1. Kde teraz stojíme

|                      |                                                          |
| -------------------- | -------------------------------------------------------- |
| **Produkcia**        | `3b0843f`, BUILD_ID `HYtxP2Z7BIpVY8eLK5fR0`              |
| **Vetva so SK + CS** | `claude/maky-store-slovak-pages-8df66b` — **nenasadená** |
| **Živé trhy**        | iba `sk` (`MAKY_LIVE_MARKETS` nenastavené → default)     |
| **Hotové jazyky**    | `sk`, `cs`                                               |

⚠️ **Vetva so SK/CS ešte nie je v produkcii.** Tvoje vlákno na nej stavia. Over si
`git ls-remote`, či medzitým nebola nasadená alebo posunutá — nespoliehaj sa na toto
číslo.

⚠️ **Nikdy neprepisuj slovenské ani české texty.** Sú schválené. Ak v nich nájdeš
chybu, nahlás ju — neopravuj ju v svojom vlákne, lebo dve vlákna by si sadli do
rovnakého súboru.

---

## 2. Čo tvoje vlákno robí a čo nie

**Robí:** pridá jazykové telá pre svoje dva trhy, sprístupní ich na `/<trh>/*`,
overí a odovzdá vetvu.

**Nerobí bez osobitného schválenia (CLAUDE.md §10):**

- nenasadzuje do produkcie,
- nemení `MAKY_LIVE_MARKETS` ani žiadnu inú premennú prostredia,
- nezapína `WITHDRAWAL_BACKEND_LIVE`,
- nesiaha na Saleor, checkout, košík, CFM, kanály ani routovanie nad rámec § 3,
- nepridáva závislosti.

Trh zostane **preview** — proxy mu posiela `X-Robots-Tag: noindex, nofollow`, takže
Google nič neuvidí. To je zámer, nie nedorobok.

---

## 3. Ako sa pridáva jazyk — presné súbory

Architektúra je hotová. Pridanie trhu je **jedna zmena v mape + jedno telo na stránku**.

### 3.1 Mapa jazykov — jediný zdroj pravdy

`src/lib/legal/locale.ts`:

```ts
export const LEGAL_LOCALES = ["sk", "cs", …] as const;
const APPROVED_COPY: Readonly<Record<string, LegalLocale>> = { sk: "sk", cz: "cs", … };
```

**Toto je jediné miesto, kde sa rozhoduje, ktorý trh má schválený text.**
`src/lib/route-policy.ts` si zoznam trhov odvodí sám (`marketsWithLegalCopy()`), takže
proxy a stránka nemôžu nesúhlasiť.

⚠️ Toto je **jediný súbor, o ktorý sa vlákna delia.** Konflikt je triviálny (pridanie
riadku), ale ráta s ním — rebasuj pred odovzdaním.

⚠️ Mapa je **opt-in a nie je odvodená z `CHANNEL_MAP[...].locale`.** To, že trh má
preklad rozhrania, nie je dôvod servírovať mu záručné podmienky.

### 3.2 Telá stránok

`src/ui/content/legal/<slug>.tsx` — sedem súborov, každý exportuje jednu funkciu na
jazyk (`Sk`, `Cs`, …). Podpis: `({ channel }: { channel: string })`, pri odstúpení
navyše `form` a `modelFormHref`.

Sedem stránok: `kontakt`, `doprava-a-platba`, `reklamacie-a-vratenie`,
`odstupenie-od-zmluvy`, `obchodne-podmienky`, `ochrana-osobnych-udajov`, `cookies`.

### 3.3 Routy

`src/app/[channel]/(main)/<slug>/page.tsx` — pridaj do `copy` položku pre svoj jazyk
(`title`, `description`, `Body`). Nič iné v route nemeň.

Výnimka: `odstupenie-od-zmluvy/page.tsx` má vlastnú routu (formulár, `connection()`).
Pridáva sa do `META` a do výberu tela.

### 3.4 Odkazy

Interné odkazy **vždy** cez `marketHref(channel, "/…")` a `next/link`. Napevno
napísané `/sk/…` v cudzojazyčnom tele pošle čitateľa na slovenskú stránku a
**nezachytí to nič okrem testu**, ktorý na to existuje.

### 3.5 `/o-nas` je iné

Ide z Payload CMS cez `cmsPageRoute`, ktorý je **natvrdo len pre `sk`**
(`isSlovakChannel`). Text v kóde je iba bootstrap pri výpadku CMS.

Pre nový trh treba **oboje**: rozšíriť `cmsPageRoute` o svoj trh **a** publikovať
dokument v Payloade. Samotný bootstrap nestačí — návštevník uvidí, čo je v CMS.
Ak dokument nemáš, nechaj `o-nas` mimo svojho trhu (404) a napíš to do odovzdávky.
**Nevyrábaj druhý zdroj pravdy v kóde.**

---

## 4. Čo je naozaj „to isté" a čo nie

Skoršie zhrnutie „mení sa len jazyk, mena a miestny úrad" je **zjednodušené**.
Trhy EÚ zdieľajú _smernice_, nie ich znenie. Líšia sa:

- **národná transpozícia a jej dátumy účinnosti** — dve krajiny môžu mať tú istú
  smernicu s inou účinnosťou;
- **národná terminológia** — to isté právo sa v dvoch krajinách volá inak;
- **ePrivacy predpis** pre cookies — každá krajina má vlastný;
- **dozorný orgán, ARS subjekt a úrad na ochranu údajov**;
- **cezhraničná podpora spotrebiteľa** (ECC / EVZ siete).

Preto: **neprenášaj tvrdenie z jedného trhu na druhý len preto, že „je to tiež EÚ".**
Ak dodaný preklad nejaký národný údaj neuvádza, **nedopĺňaj ho odhadom** — daj ho do
zoznamu otvorených položiek.

Rovnako **neprenášaj slovenské prevádzkové čísla**. Hranica **35 kg** je slovenský
fakt (viď § 8). Pre iný trh platí len vtedy, ak to niekto overil pre tamojšie služby.

---

## 5. Mena a jazyk zmluvy sa neprekladajú — čítajú sa z konfigurácie

`CHANNEL_MAP` v `src/lib/channel-map.ts` je autorita:

| trh | kanál  | mena | locale |
| --- | ------ | ---- | ------ |
| sk  | sk-eur | EUR  | sk-SK  |
| cz  | cz-czk | CZK  | cs-CZ  |
| de  | de-eur | EUR  | de-DE  |
| at  | at-eur | EUR  | de-AT  |
| pl  | pl-pln | PLN  | pl-PL  |
| hu  | hu-huf | HUF  | hu-HU  |
| it  | it-eur | EUR  | it-IT  |
| fr  | fr-eur | EUR  | fr-FR  |
| es  | es-eur | EUR  | es-ES  |
| ro  | ro-ron | RON  | ro-RO  |
| us  | us-usd | USD  | en-US  |
| ca  | ca-cad | CAD  | en-CA  |

Pri CS sa toto už raz pokazilo: dodaný preklad ponechal „ceny sa uvádzajú v eurách"
a „zmluva sa uzatvára v slovenčine". Oboje bolo na `/cz` nepravdivé. **Skontroluj obe
vety v každom preklade, ktorý dostaneš.**

---

## 6. Online odstúpenie je zamknuté na SK — a to je správne

Kontrakt Returns V2 (`src/lib/withdrawal/contract.ts`) má:

```ts
export const WITHDRAWAL_MARKET = "SK";
export const WITHDRAWAL_LOCALE = "sk";
```

Sú to **literálové typy**, ktoré Payload validuje. Podanie z iného trhu endpoint
odmietne. Preto `servesOnlineFunction()` vyžaduje `legalLocaleFor(channel) === "sk"`
navyše k prevádzkovej poistke.

**Tvoje vlákno formulár na svojom trhu NEZAPÍNA.** Stránka sa servíruje ďalej (je to
zákonná informačná povinnosť), formulár nie. Text musí ponúknuť e-mail a poštu.

❌ **Nikdy neposielaj cudzí trh ako `market: "SK"`.** Vyrobilo by to právny záznam
s nepravdivým trhom.

Rozšírenie kontraktu je vec vlastníka Payloadu, nie tvojho vlákna.

### 6.1 Nález, ktorý sa týka všetkých trhov

`submittedAt` **generuje Payload v okamihu, keď záznam ukladá** — je to teda čas
**prijatia**, nie čas odoslania zákazníkom. Slovenský text pritom hovorí „dátum a čas
jeho **odoslania**".

Storefront dôveryhodný čas odoslania ani vyrobiť nevie (hodiny klienta). Správne
riešenie je **opísať existujúci údaj pravdivo**, nie premenovať ho. Ak tvoj trh
vyžaduje oba časy, je to zmena kontraktu na strane Payloadu — nahlás ju, nerieš ju
v storefronte. Nahlás to aj vtedy, ak sa ťa to netýka; oprava SK/CS textu je vlastná
úloha (§ 1).

---

## 7. Cookies a GDPR — iba overený inventár

Inventár je **overený z kódu a `.env`**, nie z vendor šablóny. Nekopíruj ho z
prekladu — prelož ten, ktorý už v repozitári je:

- `maky-market` — cookie, 1 rok (`src/proxy.ts`)
- `checkoutId-<kanál>` — **session** cookie, `saveIdToCookie()` nenastavuje `maxAge`
- Saleor prihlásenie — prístupový 15 min, obnovovací 7 dní (`src/lib/auth/constants.ts`)
- `maky-consent` — **localStorage**, nie cookie (`CookieConsent`)
- GTM — `lazyOnload`, Consent Mode v2 s prednastaveným `denied`
- Cloudflare Web Analytics — `afterInteractive`, **bez súhlasu**, bez cookies

**Čo v texte nesmie byť, lebo to repozitár nevie overiť:** zmluvné právne subjekty
poskytovateľov, konkrétne mechanizmy prenosu mimo EHP, a **ktoré tagy GTM kontajner
spúšťa** (to je nastavenie v GTM, nie v kóde). Stránka namiesto toho odkazuje na
`info@maky.store`, čo čl. 15 ods. 2 GDPR umožňuje.

Čo **musíš** doplniť pre svoj trh: **ePrivacy predpis** danej krajiny a **úrad na
ochranu údajov**. Slovenský ÚOOÚ zostáva ako úrad predajcu; miestny sa pridáva.

---

## 8. Doprava — over, nekopíruj

Slovenské pásma (`sk-eur`): „Kuriér Slovensko" 0-5 / 5-15 / 15-30 / 30-45 kg.
Text hovorí, že **nad 35 kg** sa doprava dojednáva individuálne.

⚠️ To je **slovenský prevádzkový fakt** a navyše nesedí s pásmom 30-45 kg. Do iného
trhu ho **neprenášaj**. Zisti skutočné metódy svojho kanála:

```bash
API=$(grep '^NEXT_PUBLIC_SALEOR_API_URL=' /opt/storefront/.env | cut -d= -f2-)
curl -sS "$API" -H 'content-type: application/json' \
 -d '{"query":"{ shop { availableShippingMethods(channel:\"<kanál>\"){ id name } } }"}'
```

Ak metódy nepoznajú dopravcu menom, **netvrď v texte konkrétneho dopravcu**, kým to
niekto nepotvrdí. Rovnako over hmotnostný strop a či nad ním vôbec ide objednávka cez
pokladňu.

---

## 9. Validácia — celá, pred odovzdaním

```bash
npx tsc --noEmit
pnpm lint
npx vitest run
pnpm build
```

Plus:

**Paritný test i18n (CLAUDE.md §11)** — invariant je, že **všetkých 12 súborov je
identických**, nie konkrétny počet kľúčov.

**Skutočný render, nie iba build.** Build prejde aj nad rozbitým textom:

```bash
npx next start -p 30XX            # zvoľ si voľný port, vlákna bežia paralelne
for p in kontakt doprava-a-platba reklamacie-a-vratenie odstupenie-od-zmluvy \
         obchodne-podmienky ochrana-osobnych-udajov cookies o-nas; do
  for m in <trh1> <trh2> sk de; do
    printf "%-24s %-3s %s\n" "$p" "$m" \
      "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:30XX/$m/$p)"
  done
done
```

Očakávané: tvoje trhy 200, `sk` 200 (nesmieš nič rozbiť), `de` 404 (kým ho niekto
nepridá). `o-nas` 404 mimo `sk`, pokiaľ si ho neriešil podľa § 3.5.

**Formulár odstúpenia musí zostať mimo tvojho trhu aj so zapnutou bránou:**

```bash
WITHDRAWAL_BACKEND_LIVE=true npx next start -p 30XX
curl -s http://127.0.0.1:30XX/<trh>/odstupenie-od-zmluvy | grep -c "Potvrdiť odstúpenie"
# musí byť 0
```

**Vizuálna kontrola.** Headless Chromium na tomto stroji funguje:
`~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, ovládaj cez CDP z Node.
Screenshot potom **prečítaj** — nepíš „nech sa pozrie Marek".
Skontroluj aj vodorovný pretok pri 360 px (`scrollWidth === clientWidth`).

⚠️ `pgrep -f` matchne vlastný shell — kill cez `pgrep -x chrome`.
⚠️ Po prepnutí vetvy spusti codegen, inak tsc padne na chýbajúcom `src/gql/`:
`NEXT_PUBLIC_SALEOR_API_URL="$(grep '^NEXT_PUBLIC_SALEOR_API_URL=' /opt/storefront/.env | cut -d= -f2-)" pnpm generate && … pnpm generate:checkout`
⚠️ **Nikdy nespúšťaj `pnpm build` v `/opt/storefront`, kým beží PM2** (CLAUDE.md §13.1).
Pracuj vo worktree.

---

## 10. Testy, ktoré ti padnú — a je to správne

Sú to strážcovia, nie prekážky. **Aktualizuj ich, nevypínaj.**

| Test                                     | Prečo padne                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/legal/legal-route.test.ts`      | Vyžaduje telo pre **každý** jazyk v `LEGAL_LOCALES` v každom module                                               |
| `src/lib/route-policy.test.ts`           | Fixtúra trhov bez schváleného textu                                                                               |
| `src/proxy.test.ts`                      | To isté na úrovni HTTP                                                                                            |
| `src/config/company.test.ts`             | Globuje `src/ui/content/legal/` a kontroluje tvrdenie o DPH — vrátane **negácií vo svojom jazyku** (pridaj svoju) |
| `src/lib/withdrawal/ui-contract.test.ts` | Pripína znenie o vrátení tovaru                                                                                   |

---

## 11. Poradie pri spustení trhu (nerobíš ty, ale musíš to napísať)

1. **nasadiť kód** s prekladom,
2. **produkty** do kanála (bez nich je trh obchod bez tovaru),
3. `MAKY_LIVE_MARKETS` v `/opt/storefront/.env`,
4. `pm2 restart maky-storefront`.

⚠️ Opačné poradie spraví trh indexovateľným, kým jeho zákonné stránky 404-ujú.

⚠️ **`noindex` nie je zákaz nákupu.** Preview trh sa dá kúpiť, ak má produkty,
dopravu a platbu. Neplať sa na `noindex` ako na poistku proti predaju.

⚠️ **Nie všetko sa prejaví reštartom.** Podľa `src/lib/market-state.ts`:

- **okamžite** — `noindex` hlavička (proxy, per request) a sitemap (dynamická routa),
- **až po builde** — **hreflang**, lebo vzniká v `generateMetadata` a zapečie sa do
  prerenderovanej schránky.

Povýšenie trhu je preto bezpečné (chýbajúca anotácia, nikdy nesprávna), ale
**degradácia trhu musí byť nasledovaná deployom**, inak hreflang ďalej menuje trh,
ktorý už živý nie je.

---

## 12. Čo odovzdať

Vetvu `claude/trh-<t1>-<t2>-*`, pushnutú, **nenasadenú**, plus správu rozdelenú na:

**IMPLEMENTOVANÉ** — čo je v kóde.
**OVERENÉ** — čo si spustil a s akým výsledkom. Konkrétne čísla a výstupy, nie
„testy prešli". Pri každej z 8 stránok × 2 trhy uveď HTTP kód.
**NEPUBLIKOVANÉ / ZOSTÁVA** — jeden konkrétny zoznam otvorených položiek: národné
právne údaje, ktoré chýbali, prevádzkové fakty, ktoré sa nedali overiť, a čo musí
urobiť človek. Formát ako `docs/design/sk-pages-20260907-otvorene-polozky.md`.

**Nevymýšľaj.** Ak niečo nevieš overiť, patrí to do tretej sekcie. To je celý zmysel
tohto postupu.
