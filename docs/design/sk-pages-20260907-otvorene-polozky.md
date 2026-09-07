# Slovenské stránky — otvorené položky pred publikovaním

Stav k 2026-09-07. Vetva `claude/maky-store-slovak-pages-8df66b`, základ = produkčný
commit `3b0843f`. **Nenasadené.** Obsahuje aj českú verziu (§ D).

Texty z balíka sú zapracované. Tento súbor je jediný zoznam údajov, ktoré som
**nemohol overiť** z kódu ani z konfigurácie a ktoré preto nie sú vymyslené —
čakajú na rozhodnutie alebo doplnenie. Zoradené podľa toho, čo blokuje
publikovanie.

---

## A. Blokuje publikovanie

### A1. Doprava — VYRIEŠENÉ 2026-09-07 (Marek)

„FedEx a Slovenská pošta" je **správne**; do Saleoru sa to doplní 8. 9. 2026. Texty
zostávajú bez zmeny.

Doplnené podľa upresnenia: **nad 35 kg sa doprava dojednáva individuálne na
vyžiadanie.** Je to teraz na `/sk/doprava-a-platba` aj v bode 5 VOP.

⚠️ **Zvyšný nesúlad:** Saleor má pre `sk-eur` pásmo „Kuriér Slovensko – 30-45kg",
ktoré objednávku od 35 do 45 kg pustí cez pokladňu automaticky — teda inak, než
hovorí text. Buď to pásmo zmeniť na 30–35 kg, alebo text preformulovať. Text je
zatiaľ napísaný opatrne („nemusí pokladňa ponúknuť automaticky"), takže neklame
ani v jednom prípade, ale mal by sa zosúladiť.

### A2. Online odstúpenie — pripravenosť Payloadu sa zo storefrontu overiť nedá

Kód Returns V2 je v produkcii už teraz, len vypnutý. Prepínač je jediná premenná:

```
WITHDRAWAL_BACKEND_LIVE=true
```

`LEGAL_COPY_APPROVED` je `true` v kóde a všetky štyri prístupové údaje k Payloadu
(`PAYLOAD_CMS_URL`, `PAYLOAD_CF_ACCESS_CLIENT_ID`, `PAYLOAD_CF_ACCESS_CLIENT_SECRET`,
`MAKY_FORMS_HMAC_SECRET`) sú v `/opt/storefront/.env` nastavené.

**Čo som overil:** poradie operácií (validácia → uloženie, žiadny tretí krok),
rozdelenie chybových stavov (`invalid` / `notReceived` / `confirmationPending` /
`received`), to, že zlyhanie uloženia **nikdy** nevyrobí stránku s potvrdením, a
to, že úspešné uloženie platí aj keď e-mail nevyjde. Formulár aj potvrdenie sa
korektne vykresľujú v oboch stavoch prepínača (screenshoty v zhrnutí).

**Čo overiť nedokážem a čo treba pred zapnutím:**

1. Či má Payload publikovanú **Returns V2 experience a SK/sk bundle**. Endpoint
   je za Cloudflare Access a jediná operácia, ktorú klient vie, je _zápis_ —
   read-only sonda neexistuje. Neurobím teda skúšobné podanie do produkcie, lebo
   by vzniknul reálny právny záznam.
2. **QA dokument z balíka nie je na tomto stroji** (v ZIP-e, ktorý sa sem
   nedostal — mám len text stránok). Scenáre som overil proti testom, nie proti
   vášmu zoznamu.
3. Skutočné end-to-end podanie: uloženie, e-mail zákazníkovi, `ODS-…` číslo,
   duplicitné odoslanie rovnakého `submissionId`, a správanie pri vypnutom
   Payloade.

**Návrh:** zapnúť najprv na staging alebo urobiť jedno riadené podanie na testovacej
objednávke a záznam potom v Payloade zmazať.

### A3. `returnMethod` je natvrdo `"merchantPickup"`

Kontrakt pozná jedinú hodnotu:

```ts
export type WithdrawalReturnMethod = "merchantPickup";
```

Nové texty (správne) hovoria, že zákazník **môže použiť vlastného dopravcu bez
nášho schválenia**. Každý uložený záznam však aj tak povie „merchantPickup".
Údaj v CMS teda nebude zodpovedať tomu, čo si zákazník vybral.

Storefront to sám opraviť nemôže — pole je na strane Payloadu (kontrakt V2).
**Rozhodnutie:** buď pridať do kontraktu druhú hodnotu (napr. `customerReturn`) a
doplniť do formulára voľbu, alebo vedome akceptovať, že pole je konštanta a
nepoužívať ho na vyhodnocovanie.

---

## B. Právne údaje, ktoré musí doplniť človek

### B1. Dátumy účinnosti

Balík hovorí „doplniť skutočný dátum účinnosti pri publikovaní" pre VOP,
Reklamácie, Odstúpenie, GDPR a Cookies. Zatiaľ **nie sú na stránkach uvedené**.
`companyInfo.termsEffectiveFrom` je `4. 8. 2026` a týka sa DPH — nie tejto verzie
textov. Treba dátum pre každý dokument a rozhodnúť, či ho zobrazovať v päte
stránky.

### B2. Poskytovatelia — právne subjekty, postavenie, prenosy

Tabuľka na `/sk/ochrana-osobnych-udajov` uvádza **služby**, ktoré sme reálne
našli v konfigurácii, ich účel a právny základ. Zámerne **neuvádza**:

- ktorá spoločnosť službu poskytuje (Stripe Payments Europe? Google Ireland?
  závisí od zmluvy, nie od kódu),
- kto je sprostredkovateľ a kto samostatný prevádzkovateľ,
- konkrétny mechanizmus prenosu mimo EHP (rozhodnutie o primeranosti / SZD),
- či je na každú službu podpísaná zmluva podľa čl. 28 GDPR.

Stránka namiesto toho odkazuje na `info@maky.store`, čo čl. 15 ods. 2 GDPR
umožňuje. Ak chcete mať zoznam priamo na stránke, potrebujem od vás tieto štyri
údaje ku každej službe.

### B3. Obsah GTM kontajnera

Storefront načítava Google Tag Manager (`NEXT_PUBLIC_GTM_ID` je nastavené), ale
**ktoré tagy kontajner spúšťa, sa v repozitári zistiť nedá** — to je nastavenie v
GTM. Preto je v tabuľke cookies voliteľný riadok všeobecný a neuvádza `_ga` s
konkrétnou platnosťou. Export kontajnera by to doplnil.

### B4. Cloudflare Web Analytics beží bez súhlasu

`beacon.min.js` sa načítava `afterInteractive`, teda **pred akýmkoľvek súhlasom**
— na rozdiel od GTM, ktorý má Consent Mode v2 s prednastaveným `denied`. Služba
neukladá cookies, takže z pohľadu § 55 ods. 5 zákona o elektronických komunikáciách
je to obhájiteľné a text to tak aj popisuje. Je to však **vaše rozhodnutie**, nie
technický fakt. Ak ho chcete pod súhlas, je to malá zmena v `src/app/layout.tsx`.

### B5. Automatizované rozhodovanie — potvrdiť Stripe Radar

Bod 9 GDPR stránky hovorí, že my automatizovane nerozhodujeme, ale poskytovateľ
platby automatizovane vyhodnocuje riziko podvodu a môže platbu odmietnuť.
Vychádzam z toho, že Radar bol pri testovaní checkoutu aktívny. Potvrďte, či a
aké pravidlá Radar má.

### B6. Lehoty uchovávania

Text uvádza kritériá (účel, premlčacie lehoty, 10 rokov pre účtovníctvo). Presné
lehoty pre jednotlivé kategórie neuvádza. Ak máte retenčnú politiku, doplní sa.

---

## C. Menšie / na zváženie

### C1. `/sk/o-nas` je z Payloadu, nie z kódu

Autoritatívny obsah tejto jednej stránky je v Payload CMS. Zmenil som iba
**bootstrap** v kóde (renderuje sa, keď CMS nedostupné). **Kým sa nový text
nepublikuje aj v Payloade, návštevník uvidí starý.** Sedem ostatných stránok je
priamo v Next.js a mení sa nasadením.

### C2. 30-dňová lehota pre registrovaných

Texty sľubujú predĺženú lehotu 30 dní pre zákazníkov, ktorí objednali prihlásení.
Je to nad rámec zákona, takže je to obchodný záväzok. Overte, že ho viete
dodržať aj procesne — v kóde formulára sa lehota nikde nevyhodnocuje.

### C3. Drobná odchýlka od balíka

Na `/sk/reklamacie-a-vratenie` som vetu „Oznámenie odošlite cez **online formulár
na odstúpenie**…" zmenil na „…cez **stránku Odstúpenie od zmluvy**…". Dôvod: tá
stránka je staticky generovaná, takže vetvenie podľa `WITHDRAWAL_BACKEND_LIVE` by
sa do nej zapieklo v čase buildu a mohlo by odporovať samotnej stránke odstúpenia,
ktorá sa renderuje pri každej požiadavke. Nové znenie je pravdivé v oboch stavoch.
Po zapnutí funkcie sa dá vrátiť pôvodné znenie.

---

## D. Čeština — čo treba rozhodnúť pred spustením trhu CZ

Sedem právnych stránok je preložených a na `/cz/*` sa reálne renderujú. **Nič z toho
nie je indexovateľné** — `/cz` je preview trh a proxy mu posiela
`X-Robots-Tag: noindex, nofollow`. Trh spúšťate vy pridaním `cz` do `MAKY_LIVE_MARKETS`.

Než to urobíte:

### D1. Kanál `cz-czk` má 0 produktov

`sk-eur` má 9 577 produktov, `cz-czk` má **0**. Spustený český trh by bol obchod bez
tovaru s kompletnými obchodnými podmienkami. Toto je jediný dôvod, prečo som trh
nezapol.

### D2. Online odstúpenie na `/cz` NEEXISTUJE — zámerne

Kontrakt Returns V2 má `market: "SK"` a `locale: "sk"` ako literálové typy, takže
Payload podanie z iného trhu odmietne. Formulár sa preto na `/cz` nezobrazí ani keď
je `WITHDRAWAL_BACKEND_LIVE=true` (overené). Česká stránka namiesto toho ponúka e-mail
a poštu, čo zákon dovoľuje.

**Ak má mať český zákazník online formulár, musí sa rozšíriť kontrakt na strane
Payloadu** — storefront to sám neurobí.

### D3. `/cz/o-nas` je 404

Táto stránka ide z Payloadu a `cmsPageRoute` je natvrdo len pre `sk`. Český text
existuje, ale patrí do CMS, nie do kódu — inak vzniknú dva zdroje pravdy. Treba
publikovať český dokument v Payloade a rozšíriť `cmsPageRoute`.

### D4. Čo som v českom texte zmenil oproti dodanému prekladu

Dodaný preklad ponechal dve vety zo slovenskej verzie, ktoré by na `/cz` neboli
pravdivé. Opravil som ich podľa **overenej konfigurácie** (`CHANNEL_MAP`), nie podľa
odhadu:

| Dodaný preklad                                                  | Na `/cz`                                                    | Prečo                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| „Ve slovenské jazykové verzi se smlouva uzavírá ve slovenštině" | „V české jazykové verzi se smlouva uzavírá v češtině"       | Českému zákazníkovi to inak nehovorí nič o jeho vlastnej zmluve |
| „Při nákupu ve slovenské verzi se cena uvádí v eurech"          | „Při nákupu v české verzi se cena uvádí v českých korunách" | `CHANNEL_MAP.cz.currency === "CZK"`                             |

Doplnil som tiež vetu, že českému spotrebiteľovi zostávajú zachované kogentné predpisy
ČR, a do GDPR stránky kontakt na ÚOOÚ ČR popri slovenskom úrade.

### D5. Čo treba potvrdiť právne

- **Orgán dozoru a ARS.** Texty uvádzajú SOI (sme slovenský predajca). Pre českého
  spotrebiteľa je dozorným orgánom ČOI. Doplnil som len neutrálnu vetu, že sa môže
  obrátiť aj na subjekt vo svojej krajine. **Overiť u právnika.**
- **12-mesačné predĺženie po oprave od 31. 7. 2026** je slovenská novela. České právo
  má vlastný režim. Text hovorí, že sa riadi slovenským právom a že kogentné české
  predpisy zostávajú — či to stačí, je právna otázka.
- **Doprava.** Kanál `cz-czk` má pásma „CE 0-5kg / 5-15kg / 15-30kg", teda strop 30 kg
  a bez mena dopravcu. Český text preto **neobsahuje** hranicu 35 kg — tá je slovenská.
  Treba potvrdiť, ktorí dopravcovia doručujú do ČR a od akej hmotnosti je doprava na
  vyžiadanie.

### D6. Ďalšie jazyky

Pridanie trhu je **jedna zmena** v `src/lib/legal/locale.ts` — `route-policy.ts` si
zoznam trhov odvodí sám. Musia však existovať obe jazykové telá v každom module
`src/ui/content/legal/*`, inak to test zachytí. Preklad sám o sebe nestačí: text musí
hovoriť pravdu o mene, dopravcoch a dozorných orgánoch daného trhu.
