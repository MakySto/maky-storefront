# ES/RO — krátke zadanie

Sprievodca k `PRVY_PROMPT.txt`. Referenčná implementácia je IT/FR:
`../HANDOFF-20260909-it-fr.md`, vetva `claude/maky-store-it-fr-impl-f1125b @ 8f84ed0`.
Toto je rozsah, vlastníctvo a brány na jednej strane.

> **Preflight neexistuje, a je to zámer.** Pri IT/FR bol balík na stroji, dal sa overiť a
> `PREFLIGHT.md` ušetril prvé kolo. **ES/RO balík na stroji nie je** (overené 9. 9. 2026).
> Preflight teda napíše až vlákno, ktoré balík dostane — nie tento dokument dopredu.

## 1. Čo vlákno vlastní

Vlastní: španielske a rumunské telá siedmich statických právnych stránok, ich metadáta
(`h1` a `metaTitle` oddelene), tlačiteľný vzor odstúpenia na oboch trhoch, jazykové testy
a pripravené — nezapojené — texty Returns V2.

Nevlastní: CMS publikáciu O nás (M), Returns V2 kontrakt a jeho zapojenie (R), katalóg,
meny, dane, dopravu a Stripe (K), `<html lang>` a integračnú vetvu (M).

Do cudzej rozpracovanej vetvy nezapisuje nič.

## 2. Rozsah

|                 |                                                                                      |
| --------------- | ------------------------------------------------------------------------------------ |
| Trhy            | `es` → `es-eur` / **EUR** / `es-ES`, `ro` → `ro-ron` / **RON** / `ro-RO`             |
| Stránky         | 8 na jazyk — 7 statických + O nás (CMS)                                              |
| Ďalšia routa    | `/odstupenie-od-zmluvy/vzorovy-formular` — deviata, nie náhrada O nás                |
| VOP / privacy   | po 10 sekcií, neskracovať                                                            |
| `LEGAL_LOCALES` | 8 → 10                                                                               |
| Zdroj           | celý balík: `pages/`, `data/`, `formulare/`, `interne/` — nie iba `TEXTY_*_SPOLU.md` |

**Španielsko je eurové, Rumunsko nie je.** V jednom vlákne máš obe situácie. Vetu o mene
čítaj z `CHANNEL_MAP`, neprenášaj ju z jedného tela do druhého — presne táto chyba sa už
raz stala pri češtine.

ES a RO nezdieľajú prózu (ako PL/HU a IT/FR, na rozdiel od `de`/`deAt`). Firemné údaje,
adresy a tabuľkové komponenty sa naopak zdieľajú a iba rozširujú.

## 3. Čo je pripravené a čo je pasca

**Pripravené.** `legalRoute` má voliteľné `heading`; druhý helper sa nepíše. Zdieľané
komponenty už majú voliteľný `country` a per-jazyk záznamy — rozširujú sa, needitujú.
Tlačiteľný vzor je servovaný pre každý schválený trh (`04-es-ro.md` § 5 tvrdí opak a je
zastaraný: nezapína sa **online formulár**, nie vzor).

**Pasca.** `es` aj `ro` sú dnes negatívne fixtúry „trh bez schváleného textu". Rola išla
`de` → `pl` → `it`/`fr` → `es`/`ro`. Po pridaní ES/RO ju musia prevziať `us` a `ca`.
Assertion sa nemaže — zmazaná nechá päť zelených testov kontrolovať nič. Presné riadky sú
v prompte, vrátane toho, že `legalLocaleFor("es-eur")` má ísť na `"ca-cad"` a nie na
`"us-usd"`, ktorý je o riadok nižšie.

**A po vás už nie je kam ju posunúť.** US/CA je posledný nepokrytý pár. Napíšte to do
handoffu: nasledujúce vlákno bude musieť assertion premyslieť, nie potichu zmazať.

**Suffix značky.** `metaTitle` v dodaných balíkoch už obsahuje ` | MAKY.STORE`, a
`formatPageTitle` ho pridáva. Odstrihni ho, inak je značka na každej stránke dvakrát.

## 4. Stavy namiesto prísľubov

Returns V2 prijíma len SK/sk. Formulárové texty idú do kódu ako PREPARED a nezapojené, so
strážcom podľa `src/lib/withdrawal/copy-it-fr.test.ts`.

Tri stavy zostávajú oddelené: `previewNotActivated`, `active`, `temporarilyUnavailable`.
Telo, VOP, navigácia aj metadáta musia hovoriť o tej istej reálnej capability. Výpadkový
text nesmie tvrdiť, že funkcia nikdy nebola spustená.

Dve chyby, ktoré sa opravovali v PL/HU a nemajú sa zopakovať: potvrdenie nesmie sľubovať
dva časy, keď je doložený jeden; a neistý výsledok nesmie odkazovať na neexistujúci
verejný „stav prípadu".

**Overený stav časov, aby sa nezopakovala aj tretia:** storefront netlačí žiadny čas.
`WithdrawalV2Accepted` nenesie timestamp, `withdrawal-form.tsx` nerenderuje čas, a
`formsTimestampSeconds()` je HMAC replay okno. Obidva časové labely sú dormantné vo
všetkých jazykoch vrátane slovenčiny. Čo znamená `submittedAt`, vidí len Payload — z tohto
repa sa to tvrdiť nedá.

## 5. Španielsko a Rumunsko — čo overiť, nie predpokladať

**Povinnosť online odstúpenia sa NEPREDPOKLADÁ.** Pre IT/FR bola doložená účinnosť od 19. 6. 2026 z primárnych zdrojov. Pre ES a RO taký dôkaz nemáme. Zisti to z balíka; ak
balík mlčí, je to otvorená položka pre M — nie tvrdenie v jednom ani druhom smere.

- **Rumunská diakritika:** správne `ș`/`ț` (comma-below), nie `ş`/`ţ` (cedilla). Existujúci
  `ro-RO.json` je čistý — 400 správnych, 0 cedíl. Drž ten štandard a over ho skriptom.
- **Španielske autonómne spoločenstvá** majú vlastné spotrebiteľské orgány popri
  celoštátnych. Ak preklad uvádza len jeden, je to otvorená položka, nie chyba prekladu.
- **AEPD** (ES) a **ANSPDCP** (RO) musia prísť z prekladu; adresy ani kontakty nevymýšľaj.
- **Členstvo v mediácii sa nevymýšľa.** SOI zostáva ADR orgánom predajcu; miestne cesty sa
  pridávajú vedľa, nie namiesto.
- **`company.test.ts`:** doplň španielsku a rumunskú negáciu tvrdenia o DPH. IT/FR sú tam
  ako vzor (`regime forfettario`, `franchise en base de TVA`) — nájdi miestny ekvivalent
  oslobodenia pre malé podniky a falzifikuj ho.

## 6. Brány

Validátor balíka → typecheck → lint → testy → parita kľúčov a premenných → reálny build →
URL matica → 360 a 1280 px → regresia proti skutočnému základu.

Matica je 8 statických rout × práve podporované právne trhy — s ôsmimi doterajšími plus
ES/RO **80 statických URL**. O nás/CMS sa reportuje zvlášť, plus aspoň jeden nepodporovaný
trh ako negatívna kontrola. Regresia: **64 výstupov ôsmich doterajších trhov musí byť
zhodných** (IT/FR malo 48/48 pri šiestich trhoch).

Negatívny dôkaz cez submit-capability, nie počtom `<form>`: v hlavičke a pätičke sú dva
vyhľadávacie formuláre aj bez akéhokoľvek odstúpenia. Pri `WITHDRAWAL_BACKEND_LIVE=true`
musí zostať `sk` = 3 formy / 1 submit a ostatné trhy 2 / 0.

**Falzifikuj každú stráž, ktorú posunieš alebo pridáš.** Zelený test, ktorý nič
nekontroluje, je horší než žiadny. Pri IT/FR to odhalilo, že sa dá `es` pridať do
`APPROVED_COPY` a šesť testov sčervenie — čo je dôkaz, že fixtúra funguje.

Staging beží len na schválenom env allowliste — bez Stripe, bez HMAC, bez živých podaní.
Build nikdy v `/opt/storefront`. Vlastné PID a worktree sa upratujú.

## 7. Odovzdanie

Presný base, HEAD, vetva, commity — a odlíš **posledný implementačný SHA** od
dokumentačného, lebo dokument si nevie zapísať vlastný hash. Zdrojové odchýlky, vykonané
vs nevykonané testy a závislosti s vlastníkom. Osem stavov sa reportuje oddelene:

CONTENT_PREPARED · CONTENT_REVIEWED · ROUTE_READY · CMS_PUBLISHED · BACKEND_READY ·
DEPLOYED · SELLABLE · INDEXABLE

Noindex nie je blokácia nákupu. Počet offline kontrol nie je dôkaz o implementácii.
Produkčný SHA a BUILD_ID sa čítajú z `MAKY_DEPLOY_META`, nevymýšľajú sa. Lokálne logy nie
sú GitHub CI. Repo je **verejný fork** — pred pushom over, že neodovzdávaš tajomstvá,
`.env` ani osobné údaje.
