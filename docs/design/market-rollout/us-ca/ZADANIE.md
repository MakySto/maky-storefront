# US/CA — odovzdanie pre Claude Code

Pripravené 9. septembra 2026. **GO na implementáciu obsahu v samostatnej vetve.** Nie je to GO na merge, deployment, CMS publikáciu, platbu, refundáciu, zásielku ani testové právne podanie.

## 1. Začni úplným balíkom, nie jedným súhrnom

ZIP: `MAKY_STORE_US_CA_preklad_a_implementacia_2026-09-09.zip`.

Rozbaľ celý adresár `MAKY_STORE_US_CA/`. Cestu uploadu najprv reálne zisti; nevymýšľaj `/home/ubuntu/...` ako potvrdenú cestu. Súhrny `TEXTY_US_SPOLU.md` a `TEXTY_CA_SPOLU.md` nie sú náhradou dát, formulárov, e-mailov a stavov.

Prečítaj toto odovzdanie, `README_PRE_CLAUDE_CODE.md`, `interne/M_R_K_OTVORENE_BODY.md`, `interne/HANDOFF_RETURNS_V2.md` a relevantné časti právnych delt. Over bezpečné cesty a integritu ZIP-u, manifest a jedenkrát spusti `python3 scripts/validate_bundle.py`. Opakuj po skutočných zmenách, nie pre číslo kontrol.

## 2. Overený implementačný základ

Repo `MakySto/maky-storefront`.

Vetva ES/RO: `claude/maky-store-es-ro-impl-c025ae`.
Browserom načítaný HEAD: **8bd1c6cc26adf0b79abcc28c5203f2efa9b44a82**.
Je štyri commity nad IT/FR `b34927a082ce5925e51f8346108c148bf829da0f`; ten je o dva ďalej než skoršie `55a3d48…`. Toto je historický údaj tohto overenia, nie záväzok, že remote odvtedy stojí.

V novom worktree over `git status`, aktuálnu vetvu a `git ls-remote` plus ancestry. Pri novšom tip-e rozlíš pridané commity a pokračuj bez straty práce. Žiadny reset, force-push, opätovné zlučovanie starých SK/CS/garáž commitov ani ignorovanie neznámej divergencie.

Čítaj aktuálne `CLAUDE.md`/`AGENTS.md`, `docs/design/market-rollout/HANDOFF-20260909-es-ro.md` a ES/RO `PREFLIGHT.md`. Existujúci `legalRoute` už má voliteľné `heading`. Implementačný limit: žiadna nová architektúra namiesto existujúcich modulov.

## 3. Dodané stránky a mapovanie

Osem celých stránok na trh:
`kontakt`, `doprava-a-platba`, `reklamacie-a-vratenie`, `odstupenie-od-zmluvy`, `o-nas`, `obchodne-podmienky`, `ochrana-osobnych-udajov`, `cookies`.

Samostatná routa modelu: `/<market>/odstupenie-od-zmluvy/vzorovy-formular`.

`data/pages.en-US.json` a `data/pages.en-CA.json` nesú presné H1, SEO a body. `metaTitle` obsahuje koncové ` | MAKY.STORE`: pred existujúcim `formatPageTitle` suffix odober, nech je na výstupe raz. H1 mapuj cez `heading` tam, kde sa líši. Slovenské slugs sa nemenia.

`us` → `us-usd`, `en-US`, USD; `ca` → `ca-cad`, `en-CA`, CAD. Dve samostatné legálne entry zachovajú miestne delty; názvy interných typov zvoľ konzistentne (napr. `enUs`/`enCa` a `EnUs`/`EnCa`). Nemeň zákaznícke locale ani Saleor channel. Spoločné anglické vety sú legitímne, test nesmie vyžadovať odlišnosť všetkých reťazcov.

Sedem statických modulov rozšír o oba jazyky s existujúcimi company/address/SOI helpers. Tabuľka príjemcov má dva stĺpce ako ES/RO; nezavádzaj nový právny základ na každý riadok. Krajinu zobraz `Slovakia`, neprekladaj názvy ulíc. `companyInfo.ico` môže zachovať spoločné medzery.

**O nás patrí do existujúceho CMS:** telá v `interne/O_NAS_PRE_CMS.*.md` odovzdaj M. Kódový bootstrap nie je CMS publikácia, nový statický druhý zdroj nevytváraj. Model je ďalšia routa, nie náhrada About.

## 4. Zásadné obchodné a jazykové pravidlá

Predajca MAKY.STORE s. r. o.; Slovensko, FedEx a Slovenská pošta; platba vopred cez existujúci Stripe, bez dobierky. USD nie CAD v USA a naopak. Dovozný záväzok je celý v cene, bez neočakávaného doplatku príjemcu; K dokladá techniku. Text sám nie je dôkaz DDP, predajnosti produktu ani lokálnej registrácie.

14/30 dní sa zachováva ako benefit/rámec MAKY, nie údajné univerzálne federálne US/CA právo. Vady a miestne povinné práva oddelene; výrobcova záruka nenahrádza zodpovednosť predajcu. Bez vymysleného „all sales final“, „as is“, miestneho skladu, restocking fee, arbitráže alebo výlučných slovenských súdov.

**Rutinný spätný zvoz pri bežnom vrátení US/CA nie je ponúkaný.** `data/form-capabilities.*.json` je redakčné pravidlo pre R, nie runtime import. Pole `pickupInterest` je ponechané kvôli schéme, ale `showPickupInterest=false`. Nevystaviť ho ako ponuku. Existujúci SK `returnMethod: merchantPickup` nie je pravdivé označenie vlastného odoslania. To vyrieši R v existujúcom kontrakte, jazykové vlákno ho neobíde nesprávnym enumom.

Québec nie je zakázaný. Balík neobsahuje fr-CA a nepredstiera splnenie povinnosti francúzskej zmluvy všade. M má presne opísanú pôsobnosť/výnimky; K podmienky platby vopred. Nepridávaj vlastné teritoriálne blokovanie alebo novú dobierku.

## 5. Formulár, potvrdenia a stavy

`data/ui.*.json` → pripravené jazykové copy moduly podľa existujúceho `WithdrawalCopy`. Všetky kľúče zachovať. `privacyHref` a `formExtras` odovzdať R oddelene, nie naslepo rozšíriť API. Prepared copy zatiaľ nesmie sprístupniť podanie pre nepodporovaný trh.

Presné stavy sú v `data/component-copy.*.json`: preview, active, outage; zhodný stav musí mať telo, VOP aj metadata. Tlačiteľný TXT musí zodpovedať dodanému; jeho HTML náhľad nie je produkčný komponent. Nahradiť cookie marker existujúcim `PrivacySettingsLink`.

E-maily, originálne tokeny a štyri varianty dopravy odovzdať R. `quote_requested_only` nie je prisľúbená služba. `collection_offered` iba na skutočnú individuálnu ponuku. Nevymýšľať API podľa názvov stavov.

**Časy nie sú projekt.** Bežná kontrola kanonického potvrdenia pri zapojení stačí. Nepridávať nový model, neposielať HMAC replay čas ako zákaznícky údaj a nevyrábať druhý čas kopírovaním. Neistý výsledok neoznačiť za úspech ani definitívne zlyhanie; neodkazovať na neexistujúci stavový portál.

## 6. Posledná negatívna fixtúra — vyrieš test, nie ďalší trh

`us` a `ca` sú dnes posledné reálne trhy bez schválenej copy. Po ich registrácii nestačí zoznam `NO_COPY` vyprázdniť, zmazať assertion alebo presunúť na trh s copy.

Udrž dva rozdielne prípady: **známy kanál bez schválenej copy** (syntetický iba v izolovanej testovej konfigurácii/mapách) a **neznámy kanál**. K tomu pozitívne over všetkých 12 reálnych trhov. Test-only mapovanie nesmie pribudnúť do produkčného `CHANNEL_MAP`. Použi existujúce mocking mechanizmy, izoláciu a obnovu modulov; minimálnu potrebnú zmenu, nie nový routing framework.

Miesta podľa ES/RO handoffu: `src/lib/route-policy.test.ts`, `src/proxy.test.ts`, `src/proxy.gate.test.ts`, `src/lib/legal/legal-route.test.ts`. Čísla riadkov sa mohli posunúť. Ochranu otestuj aj negatívne — kontrolovaný chybný grant copy musí zlyhať, potom presne obnov súbory. Nepožičiavaj runtime `ca` ako chýbajúci jazyk, ktorý práve implementuješ.

## 7. Overenie a odovzdanie

Content commit, registrácia a minimálne spoločné zapojenie oddelene pre M, prepared Returns copy/testy oddelene, dokumenty nakoniec. Typovo previazané mapy môžu ísť spolu; netreba nezostaviteľný medzicommit.

Typecheck, lint, unit tests a kľúčová i18n parita. Reálny build vo vlastnom worktree, nikdy v produkčnom `/opt/storefront`. Verejné build env len nevyhnutné, žiadne kopírovanie produkčných secretov. Pri codegen chýbaní rešpektuj existujúce pravidlá; nenazývaj obídený hook úspešným štandardným buildom. Pri znovupoužití generovaných súborov dolož nezmenené vstupy. Čítaj skutočný exit kód a log.

Očakávaný rozsah po registrácii: **96 statických URL = 8 × 12 trhov** (7 stránok + model), ak základ dovtedy nezmenil rozsah. About reportuj samostatne. Porovnaj existujúcich 10 trhov × 8 rout proti overenému základu; H1/title/canonical/description/viditeľný obsah a schopnosť podania. Neprázdny extraktor. Správny trh, presne jeden brand suffix, žiadna regresia desiatky.

Pri backend flage zapnutom nesmie samostatná registrácia otvorit US/CA podanie. Vyhodnoť skutočnú submit-capability, nie počet vyhľadávacích foriem. Vizuálne 360/1280 a tlač, otvor reprezentatívne screenshoty; TXT parita. Nespúšťaj živé právne podanie.

Po bezpečnostnej kontrole odovzdávaných súborov **bežný push iba vlastnej vetvy** na GitHub, bez force; over remote HEAD cez `ls-remote`. Mergovanie ani vydanie tým nie je autorizované. Finálny report s plným SHA, základom, implementačným vs dokumentačným commitom, výsledkami a cestami k existujúcim QA artefaktom. Nenazývaj lokálne testy GitHub CI.

Pripravený obsah / routa / CMS / backend / nasadenie / predaj / indexácia sú rôzne stavy. Noindex neblokuje nákup. Neprenášaj historický produkčný BUILD_ID ako nové meranie. Neotváraj CFM/VKE.
