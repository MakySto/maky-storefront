# PL/HU → Returns V2 (R)

Čo z dodaného PL/HU balíka patrí tebe, kam to v kóde smeruje a čo ešte nie je zapojené.
Nič z toho **nie je** povolenie zapnúť podanie pre PL alebo HU.

Zdroj: `data/ui.pl-PL.json`, `data/component-copy.pl-PL.json` a oba e-maily z dodaného
PL/HU balíka. Na stroj sa dostali cez `reference/` v IT/FR balíku
(`/home/ubuntu/maky-podklady/2026-09-09/rozbalene-it-fr/MAKY_STORE_IT_FR/reference/`),
kde sú vedené ako nemenné vstupy. Pôvodný PL/HU ZIP (SHA256 `1305692b…`) ani balík
`MAKY_PL_HU_REVIEW_A_OPRAVA_2026-09-09.zip` na tomto stroji **nie sú** — pozri § 4.

---

## 1. Mapovanie source → target

| Zdroj                                                                   | Cieľ v kóde                               | Stav                                       |
| ----------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `data/ui.pl-PL.json` → `withdrawal.*`                                   | `src/lib/withdrawal/copy-pl.ts`           | **v kóde, doslovne, nezapojené**           |
| `data/ui.pl-PL.json` → `formExtras.*`                                   | —                                         | **nezapojené** — `WithdrawalCopy` ich nemá |
| `data/ui.pl-PL.json` → `withdrawal.privacyHref`                         | —                                         | **nezapojené** — pozri § 2                 |
| `data/ui.pl-PL.json` → `cookies.*`                                      | `src/ui/content/legal/cookies.tsx`        | pokryté stránkou, nie formulárom           |
| `component-copy.pl-PL.json` → `withdrawalOnline.previewNotActivated`    | `odstupenie-od-zmluvy.tsx`, funkcia `Pl`  | v kóde, servíruje sa dnes                  |
| `component-copy.pl-PL.json` → `withdrawalOnline.active`                 | —                                         | **nezapojené** — až s funkciou             |
| `component-copy.pl-PL.json` → `withdrawalOnline.temporarilyUnavailable` | `copy-pl.ts` → `unavailable`              | v kóde, nezapojené                         |
| `component-copy.pl-PL.json` → `termsOnline.previewNotActivated`         | `obchodne-podmienky.tsx`, `Pl`            | v kóde, servíruje sa dnes                  |
| `component-copy.pl-PL.json` → `termsOnline.active`                      | —                                         | **nezapojené** — až s funkciou             |
| `component-copy.pl-PL.json` → `withdrawalMetadata.*`                    | `odstupenie-od-zmluvy/page.tsx` `META.pl` | v kóde, `withForm` sa neservíruje          |
| `component-copy.pl-PL.json` → `modelForm.*`                             | `vzorovy-formular/page.tsx` `COPY.pl`     | v kóde, servíruje sa dnes                  |
| `email-potvrdenie-odstupenia.pl-PL.txt`                                 | —                                         | **nezapojené, odovzdané tebe**             |
| `email-pre-obsluhu.pl-PL.txt`                                           | —                                         | **nezapojené, odovzdané tebe**             |

Maďarsko nemá v tejto tabuľke ani jeden riadok so zdrojom: `ui.hu-HU.json`,
`component-copy.hu-HU.json` ani maďarské e-maily na stroj neprišli. `copy-hu.ts` je
naďalej moje znenie s opravenými dvoma stavovými textami — pozri § 4.

---

## 2. Premenné šablón — zachované doslovne

Obe poľské šablóny sú nižšie iba ako **zoznam tokenov**; telá sú v `reference/` a
neprepisoval som ich.

**Zákaznícke potvrdenie** (`email-potvrdenie-odstupenia.pl-PL.txt`):

`{{receipt_id}}`, `{{submitted_at_local_with_timezone}}`, `{{notice_verbatim}}`,
`{{customer_name}}`, `{{confirmation_email}}`, `{{contract_reference}}`,
`{{scope_human_readable}}`, `{{items_if_applicable}}`,
`{{optional_message_if_provided}}`, `{{return_instructions_for_actual_collection_state}}`

**Interná notifikácia** (`email-pre-obsluhu.pl-PL.txt`):

`{{receipt_id}}`, `{{submitted_at_local_with_timezone}}`, `{{contract_reference}}`,
`{{scope_human_readable}}`, `{{pickup_interest_human_readable}}`,
`{{confirmation_delivery_status}}`, `{{authenticated_admin_record_link}}`

### ⚠️ Poľské šablóny žiadajú čas ODOSLANIA, nemecké žiadali čas PRIJATIA

Toto je najdôležitejší rozdiel oproti `de-at/README.md`. Nemecké šablóny používali
`{{received_at_local_with_timezone}}` — token, ktorý **neexistuje**. Poľské používajú
`{{submitted_at_local_with_timezone}}`, čo sa dá namapovať na dnešné `submittedAt`.

Maďarský zákon si pýta to isté: `45/2014. (II. 26.) Korm. rendelet § 22 ods. (1c)` hovorí
o „a megküldés napját és időpontját“ — deň a čas **odoslania**. Balík preto zámerne
nepreberá nemecký „Eingang“.

Napriek tomu si to over sám, lebo `submittedAt` generuje Payload pri **zápise záznamu**,
a to je tretia udalosť. Zápis v CMS, prijatie na BFF, odoslanie podania a odoslanie
e-mailu sa nemajú volať jedným nejasným časom. `receivedTimeLabel` je v `copy-pl.ts` aj
`copy-hu.ts` ako **dormant** label pre deň, keď budeš mať skutočnú udalosť prijatia —
**nevypĺňaj ho kópiou `submittedAt`.** Regresný test v `copy-pl-hu.test.ts` stráži vetu,
ktorú číta zákazník, nie to pole.

### `privacyHref` a `formExtras`

`data/ui.pl-PL.json` nesie navyše `privacyHref` (`/pl/ochrana-osobnych-udajov`) a blok
`formExtras` (telefón, položky, režim hosť/účet, výber objednávky, tlač potvrdenia,
neplatný odkaz, „oświadczenie nie zostało zapisane“ a ďalšie). `WithdrawalCopy` pre ne
nemá miesto a **nové spoločné rozhranie nevlastní obsahové vlákno**. Sú preto tu, nie
pribúchnuté na zdieľaný typ. Až ich budeš zapájať, vezmi ich z `reference/`, nie odtiaľto.

---

## 3. Čo NEROBIŤ

- ❌ **Neposielaj PL ani HU ako `market: "SK"`.** Vyrobilo by to právny záznam
  s nepravdivým trhom.
- ❌ **Nerozširuj `WithdrawalReturnMethod` podľa slovenských názvov redakčných súborov.**
  Redakčné JSON-y **nie sú provider schema**. Enum má dnes jedinú hodnotu
  `merchantPickup` a jeho rozšírenie je zmena kontraktu, ktorú vlastníš ty.
- ❌ **Nezapínaj cudziu locale iba globálnym prepínačom.** `WITHDRAWAL_BACKEND_LIVE=true`
  dnes otvorí formulár len na `sk`, pretože brána je
  `isWithdrawalFormServable() && legalLocaleFor(channel) === "sk"`. Test to overuje pri
  oboch stavoch prepínača; **ten test nechaj žiť**, len ho prepíš na capability test, keď
  kontrakt trh naozaj podporí.
- ❌ **Nevymýšľaj zákaznícky „stav prípadu“.** Prvá verzia `unknownBody` naň odkazovala
  (`stan sprawy` / `az ügy állapotát`) a nič také neexistuje. Opravené a zastrážené.

## Aktivácia nie je zmena jedného riadka

Dodaný `component-copy.pl-PL.json` to hovorí priamo v `withdrawalOnline.activationRequires`:

> R confirms actual provider market+locale support, complete truthful receipt, runtime
> gate and M release approval. **Static preview state is NOT a lawful permanent substitute.**

Prakticky to znamená, že spolu musia pohnúť: kontrakt (market+locale), pravdivé
potvrdenie, behová brána, próza `preview` → `active` na stránke odstúpenia **aj** vo VOP,
metadáta `withoutForm` → `withForm`, a rebuild (metadáta sa pod `cacheComponents` zapekajú
— pozri `README.md` v tomto priečinku). Komentáre v routе, ktoré tvrdili opak, sú opravené.

---

## 4. Čo na stroji nie je

| Chýba                                                | Dôsledok                                               |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `data/ui.hu-HU.json`                                 | `copy-hu.ts` je moje znenie, nie dodaný export         |
| `data/component-copy.hu-HU.json`                     | HU preview/active/outage prózu nemám proti čomu overiť |
| `formulare/*.hu-HU.txt` (oba e-maily)                | HU e-maily neexistujú                                  |
| `formulare/pokyny-podla-zvozu.{pl-PL,hu-HU}.json`    | **štyri stavy vratkovej dopravy pre PL/HU nemám**      |
| `formulare/vzor-odstupenia.{pl-PL,hu-HU}.{txt,html}` | vzory som skladal zo zákonných príloh, nie z dodaných  |

Štyri stavy dopravy (`self_shipping`, `quote_requested_only`, `collection_offered`,
`not_specified`) sú pre DE/AT v `de-at/README.md` aj v ich balíku; pre IT/FR sú
v `formulare/pokyny-podla-zvozu.{it-IT,fr-FR}.json`. **Pre PL/HU nie sú nikde.**
Token `{{return_instructions_for_actual_collection_state}}` v poľskom potvrdení je presne
ten, ktorý ich potrebuje — bez nich sa e-mail nedá naplniť. Vyžiadaj si ich; nedopĺňal
som ich prekladom zo slovenčiny, lebo to sú hotové prílohy, nie chýbajúci preklad.
