# CFM — chybové hlásenie: chýbajúce generácie vozidiel v exporte 3.0.0-full-20260907.2

**Nájdené 2026-09-08 Marekom pri kontrole konfigurátora. Ide o dieru v dátach, nie o chybu
storefrontu — nižšie je dôkaz, prečo.** Dokument je písaný tak, aby sa dal preposlať CFM
bez ďalšieho vysvetľovania.

---

## 1. Príznak

Konfigurátor ponúka pre **TOYOTA RAV4** iba roky **2000 – 2018**. Aplikačný list Nordrive
_Fitting Chart Passenger Cars (March 2026)_, z ktorého export vznikol, má pritom pre RAV4
dva riadky:

| riadok | Model                            | Year          | Roof type     |
| ------ | -------------------------------- | ------------- | ------------- |
| 1397   | Rav4                             | `03/13>02/19` | standard roof |
| 1401   | Rav4 (also with sunroof) – flush | **`03/19>`**  | flush railing |

Riadok 1397 v exporte **je**. Riadok 1401 v exporte **nie je** — a je to práve ten, ktorý
pokrýva súčasnú generáciu (XA50, od marca 2019 dodnes).

Zákazník so štyri roky starým RAV4 teda v konfigurátore svoje auto nenájde, hoci preň
Nordrive nosiče vyrába a my ich máme na sklade.

## 2. Prečo to nie je chyba konfigurátora — tri nezávislé dôkazy

**(a) Formát `03/19>` sa parsuje správne.** Ten istý reťazec je v exporte použitý pri
dvoch iných vozidlách a obe fungujú:

```
sourceWindow "03/19>"  →  BMW X7 G07              (9 produktov)
sourceWindow "03/19>"  →  TOYOTA Corolla Kombi E21 (9 produktov)
```

**(b) Otvorené obdobia export bežne obsahuje a storefront ich zobrazuje.**
288 z 1 102 aplikácií má `endPrecision: "open"` a `to: null`; 282 z 856 generácií nemá
`productionYearTo`. Merané v prehliadači na produkcii:

| model         | generácie v exporte                         | roky v selektore |
| ------------- | ------------------------------------------- | ---------------- |
| **RAV4**      | XA20, XA30, XA40 — všetky uzavreté, do 2018 | **2000 – 2018**  |
| Yaris Cross   | XP210 (2021 → dosiaľ)                       | 2021 – 2027      |
| Corolla Kombi | E21 (2019 → dosiaľ)                         | 2001 – 2027      |

Selektor teda verne zobrazuje to, čo v dátach je. Pri RAV4 nie je čo zobraziť.

**(c) Produkty z chýbajúceho riadku v exporte existujú.** Kódy `N15085` a `N15080` sa
v `evidence.sourceRef` vyskytujú 404-krát, resp. 401-krát — len nikdy nie na RAV4.

**Záver: chýba samotné VOZIDLO.** V strome vozidiel nie je generácia RAV4 XA50, takže
aplikačný riadok nemal kam pripojiť a vypadol.

## 3. Rozsah — koľko ďalších áut môže byť rovnakých

Z 557 modelov má **279 aspoň jednu otvorenú generáciu** (t. j. CFM ich vedie ako
vyrábané) a **278 má všetky generácie uzavreté**.

**92 modelov má najnovšiu generáciu uzavretú v rokoch 2016 – 2021.** To je zoznam
kandidátov, nie zoznam chýb: časť z nich sa naozaj prestala vyrábať (Alfa Romeo Giulietta,
Opel Adam, VW Golf Sportsvan). Ale sú medzi nimi aj modely, ktoré sa vyrábajú dodnes a
vyzerajú ako rovnaký prípad — napríklad:

```
2021  HONDA Civic Sedan · LEXUS NX · MAZDA CX-3 · MITSUBISHI Outlander · TOYOTA Aygo
2020  AUDI A3 · FORD Edge · ISUZU D-Max · RENAULT Megane IV
2019  BMW X6 · NISSAN Juke
```

Prosíme CFM, aby si tých 92 modelov prešlo proti aplikačnému listu. RAV4 je potvrdený
prípad; ostatné treba overiť, netvrdíme o nich chybu.

## 4. Čo od CFM potrebujeme

1. **Doplniť RAV4 XA50** (od 03/2019, otvorené obdobie) do stromu vozidiel a pripojiť naň
   riadok 1401 s typom strechy `flush-rails`.
2. **Zistiť, prečo riadok vypadol.** Podozrenie je na názve modelu: list ho volá
   `Rav4 (also with sunroof) - flush`, čo sa nemusí spárovať s modelom `RAV4`. Ak importér
   zahodí riadok, ktorý sa nepodarí spárovať s existujúcim vozidlom, **musí to hlásiť**,
   nie ticho preskočiť — inak sa rovnaká diera zopakuje pri každom novom liste.
3. **Priložiť k ďalšiemu exportu počet nespárovaných riadkov.** Ak by ho mal export
   z 2026-09-07 nenulový, vysvetľuje to celý tento nález.
4. Prejsť 92 kandidátov z §3.

## 5. Ako overíme opravu

```bash
# v strome vozidiel musí pribudnúť otvorená generácia RAV4
node -e 'const d=require("./ds.json");
const mk=d.makes.find(m=>/toyota/i.test(m.name));
const mo=d.models.find(m=>m.makeId===mk.id&&/rav/i.test(m.name));
console.log(d.generations.filter(g=>g.modelId===mo.id)
  .map(g=>`${g.name} ${g.productionYearFrom}-${g.productionYearTo??"dosiaľ"}`))'
```

Očakávaný výsledok: v zozname pribudne generácia s `productionYearTo = null`. Potom
`pnpm check:fitment` a v prehliadači ŠKODA→TOYOTA→RAV4: rozsah rokov musí siahať po
aktuálny rok.

## 6. Čo NErobiť v storefronte

**Nedopĺňať chýbajúce vozidlá v kóde.** Kontrakt (`src/lib/fitment/contract.ts`) hovorí,
že CFM je autorita na dáta a storefront na ich tvar. Vozidlo dopísané ručne v storefronte
by pri ďalšom exporte zmizlo, a medzitým by tvrdilo kompatibilitu, ktorú nikto nepotvrdil.

Rovnako **nerozširovať zoznam rokov nad rámec generácií.** Ponúknuť rok, pre ktorý nemáme
aplikačný riadok, by viedlo na „Kompatibilitu zatiaľ nevieme potvrdiť" — teda na horšiu
skúsenosť než dnešný stav, plus nepravdivý dojem, že sme vozidlo posudzovali.
