# CFM — chybové hlásenie: chýbajúce generácie vozidiel v exporte 3.0.0-full-20260907.2

**Nájdené 2026-09-08 Marekom pri kontrole konfigurátora. Doložené je, že chýba vo
VÝSTUPNOM EXPORTE, a že to nespôsobuje storefront.** Dokument je písaný tak, aby sa dal
preposlať CFM bez ďalšieho vysvetľovania.

> ⚠️ **Čo tento dokument NEtvrdí.** Neurčuje príčinu. Chýbajúca generácia v exporte
> nedokazuje, že chýba aj v primárnej databáze CFM — rovnako dobre to môže byť
> nespárovaný dodávateľský názov, chýbajúca produktová väzba, stav kontroly alebo
> podmienka exportéra. Podozrenie na názov `Rav4 (also with sunroof) - flush` v §4 je
> hypotéza na overenie, **nie potvrdená príčina**. Rozlíšiť tieto možnosti je prvá úloha.

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

1. **Dohľadať, kde presne sa riadok 1401 stratil**, a podľa toho ho sprístupniť: pôvodný
   súbor → parsovaný riadok → dodávateľský odkaz → kanonické vozidlo/generácia → strešný
   profil → produktová zostava → export. Ak generácia v CFM existuje, ide o mapovanie
   alebo väzbu; ak nie, treba ju doplniť s doloženou identitou a obdobím.

   ⚠️ **Akceptačným kritériom je správna generácia a správna aplikácia — nie vynútený
   otvorený koniec.** Skorší text tohto dokumentu žiadal `productionYearTo = null`; to
   bolo prekročenie zadania. Toyota už predstavila **šiestu generáciu RAV4** a v roku 2026
   ju uvádza na európsky trh, takže otvorený dodávateľský zápis `03/19>` z listu z marca
   2026 sám osebe **nedokazuje kompatibilitu s novou generáciou**. Piata generácia môže
   mať uzavretý koniec a to je správny výsledok, ak tak znejú podklady. Novšia generácia
   nededí kompatibilitu predchodcu — vozidlo bez potvrdenej zostavy smie zostať bez
   kladného výsledku; nesmie dostať starší nosič len preto, aby konfigurátor niečo
   ukázal.

2. **Nespárovaný riadok musí byť hlásený, nie ticho zahodený.** Toto je trvalá oprava:
   bez nej sa rovnaká diera zopakuje pri každom novom liste a nájde sa opäť náhodou.
   Cieľom nie je „nula nespárovaných riadkov za každú cenu", ale **nula nevysvetlených
   strát** — nejednoznačný riadok je v poriadku zadržať, nie je v poriadku ho potichu
   stratiť ani nasilu pripojiť k podobnému vozidlu.

   Poznámky o streche (`flush railing`, `also with sunroof`) nesmú zaniknúť ako
   bezvýznamný text — ich význam musí zostať dohľadateľný v mapovaní alebo v podmienkach
   aplikácie, a nesmie sa z nich urobiť širšie tvrdenie, než podklad dovoľuje.

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

Očakávaný výsledok: pribudne generácia zodpovedajúca zápisu `03/19>` s obdobím, aké
skutočne vyplýva z podkladov — **nie nutne s otvoreným koncom**. Potom `pnpm check:fitment`
a v prehliadači TOYOTA → RAV4: rozsah rokov musí pokrývať vozidlá, pre ktoré máme
aplikačný riadok.

⚠️ **Rok 2027, ktorý dnes selektor pri otvorených generáciách ponúka, je dôsledok pravidla
„aktuálny rok + 1", nie dôkaz výrobného obdobia ani kompatibility.** Toto pravidlo sa
nemení a nesmie sa použiť ako obchádzka chýbajúcej RAV4.

Kódy `N15085` a `N15080` slúžia len ako vyhľadávacia pomôcka v poli `evidence.sourceRef`.
Ich opakovaný výskyt **neidentifikuje zostavu pre RAV4** — priečniky sú zdieľané naprieč
vozidlami. Väzbu treba overiť na produkt, variant a zloženie zostavy; nosič sa nepripája
k autu podľa zhodného kódu priečnikov.

## 6. Čo NErobiť v storefronte

**Nedopĺňať chýbajúce vozidlá v kóde.** Kontrakt (`src/lib/fitment/contract.ts`) hovorí,
že CFM je autorita na dáta a storefront na ich tvar. Vozidlo dopísané ručne v storefronte
by pri ďalšom exporte zmizlo, a medzitým by tvrdilo kompatibilitu, ktorú nikto nepotvrdil.

Rovnako **nerozširovať zoznam rokov nad rámec generácií.** Ponúknuť rok, pre ktorý nemáme
aplikačný riadok, by viedlo na „Kompatibilitu zatiaľ nevieme potvrdiť" — teda na horšiu
skúsenosť než dnešný stav, plus nepravdivý dojem, že sme vozidlo posudzovali.
