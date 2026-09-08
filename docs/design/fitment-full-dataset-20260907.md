# Blok 2 — plný CFM snapshot a integrácia vlákna B (2026-09-07)

Vetva `feat/fitment-full-dataset-v1`. Obsahuje **blok 1**, **root URL kategórií** aj
**celé vlákno B**, postavené nad nasadeným `f8ffeba`.

---

## 1. Čo priniesol plný snapshot

`maky_roof_fitment_3.0.0-full-20260907.2.json`, 7 977 643 B.

|           | pilot |      plný |
| --------- | ----: | --------: |
| značky    |     6 |    **62** |
| modely    |     — |   **557** |
| generácie |     — |   **856** |
| aplikácie |     2 | **1 102** |
| produkty  |    67 | **9 163** |

Tých 9 163 je presne obsah kategórie `stresne-nosice`, teda 96 % katalógu. **Dôvod, pre
ktorý handoff hovoril provider nezapínať — že Škodovkár uvidí šesť cudzích značiek — tým
zmizol.** Octavia má šesť generácií so 6 až 12 zostavami.

Overené ako artefakt, a **modulmi tohto buildu, nie druhou implementáciou**: transportný
checksum, sémantický hash prepočítaný a porovnaný s deklarovaným, zhoda text-hash vs
value-hash, tvar, CFM-ovská aritmetika (9 192 riadkov manifestu − 29 deaktivovaných =
9 163) a hlavne **`validateFitmentDataset` ho prijíma bez zmeny**.

94 varovaní, všetky jednej triedy: okno aplikácie presahuje koniec výroby generácie. CFM
ich nechalo zámerne a počet sedí s ich hlásením.

**Súbor NIE JE v repozitári.** Pilot má 60 KB a v strome je; tento má 7,9 MB a repozitár
je verejný fork (CLAUDE.md §10.1). Provider ho ťahá cez HTTP a validuje pri každom
načítaní. V strome sú len čísla, ktoré sme prijali — vďaka tomu je `pnpm check:fitment`
opakovaný dôkaz, nie požehnanie toho, čo sa práve servíruje.

## 2. Vec, ktorá by sa bez reálnych dát nikdy neukázala

`next: { revalidate }` v provideri je zamýšľaná cache a jej komentár to hovorí nahlas.
S pilotom fungovala. **S plným datasetom nerobí vôbec nič**, lebo Next odmieta akýkoľvek
záznam nad 2 MB:

```
Failed to set Next.js data cache … items over 2MB can not be cached (10637357 bytes)
```

Fetch prejde, takže nič nevyzerá pokazene — stránka sa vykreslí, resolver odpovie, brány
sú zelené. Ticho prestane fungovať len to cacheovanie. **Odmerané na produkčnom builde
proti živému CFM: dvanásť requestov, dvanásť stiahnutí po 8 MB.** Pri 9 577 produktových
stránkach je to veľa cudzej linky na jeden crawl — a žiadny test, ktorý mockuje `fetch`,
to nevidí.

Memo na úrovni modulu, kľúčované URL, s in-flight záznamom, aby studený štart pod záťažou
stiahol dataset raz, nie raz na request. Zlyhania sa držia 30 s, nie celý úspešný TTL.
**Po oprave: dvanásť requestov, jedno stiahnutie.**

## 3. Zoradenie značiek

Selektor sa otváral na `PORSCHE, BMW, FORTHING, FORD, NISSAN, JAECOO…` — poradie CFM.
Pri šiestich značkách to nevadilo, pri 62 musí človek hľadajúci ŠKODU prečítať celý
zoznam. Zoradené cez `Intl.Collator("sk")`, lebo obyčajné porovnanie reťazcov zaradí Š
až za Z.

## 4. Merge vlákna B

Jediný konflikt, `hero-section.tsx`, a obe strany mali pravdu: B zmazalo `fitment` hook
spolu s mŕtvym tlačidlom, ktoré nahradilo slotom, a root-URL vetva zmazala `common` hook
spolu s natvrdo zadrôtovaným jazykovým ternárom. Obe mazania platia.

Dve veci, ktoré merge sám nevidel:

- `basePath` filtra vozidiel bol ručne skladaný `/categories/${slug}` — po migrácii by bol
  každý klik vo filtri 308 hop. Volá `categoryUrl()`.
- `src/gql/` bolo treba pregenerovať; B pridáva dokument `FitmentProductsByIds`. To je ten
  prípad, keď prepnutie vetvy naozaj zneplatní codegen.

`categories.test.ts` sa osvedčil pri prvom kontakte — zhodil merge na zastaranom príklade
`/categories/boxy` v komentári.

## 5. Stav a čo ešte treba

Brány: lint 0 · tsc 0 · i18n 12/12 (633 kľúčov) · **1 593 testov** · build 0 ·
`check:fitment` 9/9 proti živému CFM.

Overené v prehliadači nad produkčným buildom so zapnutým providerom: selektor vypíše 62
značiek, PDP renderuje blok kompatibility s reálnymi dátami (25 zmienok oproti 12 na
produkcii), tabuľka „Pre ktoré vozidlá je tento produkt určený" má skutočné vozidlá.

**Provider sa nasadzuje VYPNUTÝ.** Produkčný `.env` nemá ani jednu `MAKY_FITMENT_*`
premennú, takže kód pôjde von bez toho, aby sa funkcia objavila. Zapnutie je potom jeden
reštart PM2 bez buildu:

```
MAKY_FITMENT_PROVIDER=http
MAKY_FITMENT_URL=https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20260907.2.json
MAKY_FITMENT_REVALIDATE_SECONDS=300
MAKY_GARAGE_COOKIE_SECRET=<≥32 znakov>     ← bez neho je garáž vypnutá a povie to
```

Otvorené, mimo tohto bloku: 1 475 vozidlových stránok z CFM je `draft` a ich cesty
(`/stresne-nosice/skoda/octavia-combi/nx`) potrebujú routy, ktoré ešte neexistujú — root
kategórie z predošlého bloku je ich predpoklad, nie ony samy.

---

## 6. Známa diera v tomto snapshote (doplnené 2026-09-08)

Snapshot **neobsahuje niektoré súčasné generácie vozidiel**. Potvrdený prípad je
TOYOTA RAV4: aplikačný list má riadok `03/19>` (generácia XA50), export ho nemá, takže
konfigurátor ponúka pre RAV4 iba roky 2000 – 2018.

Nie je to chyba storefrontu — formát `03/19>` sa inde parsuje správne (BMW X7 G07,
TOYOTA Corolla Kombi E21) a selektor pri otvorených generáciách roky až po dnešok
zobrazuje. Chýba samotné vozidlo v strome.

Podrobné hlásenie pre CFM aj s rozsahom (92 kandidátskych modelov) a spôsobom overenia
opravy: `docs/design/cfm-chybajuce-generacie-20260908.md`.
