# Dizajn v1 — návrh smeru (na schválenie)

Písomný zámer podľa CLAUDE.md §2/§3 pre „vylepšiť štýl a rozloženie celého frontendu,
nie radikálne" (Marek, 22. 9. 2026). Makety (homepage, kategória, PDP, desktop + mobil)
boli vyrenderované zo skutočných dát zo Saleoru a zo skutočných tokenov `brand.css`;
do repozitára nejdú, lebo hero používa fotku z galérie Thule (verejný fork, §10.1 —
nechceme v ňom cudzie fotky). Implementácia začne až po schválení tohto dokumentu.

## 1. Hranice

- **Žiadny nový tokenový systém.** Iba tokeny z `brand.css`; ak niečo chýba, pridá sa
  alias (§4.1 — nikdy nepremenovať).
- Farby podľa §4: **meď = značka a navigácia**, **zelená = akcia** (vozidlo, košík),
  graphite = text a bežná cena, červeno-oranžová = zľava, jantár len na akcie/promo.
- Homepage podľa §6 (bez dopravy zadarmo, len povolené značky, žiadne interné čísla),
  karty podľa §7, PDP podľa §8.
- Checkout, košík, Saleor dotazy a routing sa nemenia; zmeny sú v prezentácii.

## 2. Princípy

1. **Obsah pred dekoráciou.** Fotky kategórií a produktov namiesto ikon a prázdnych plôch.
2. **Jedna primárna akcia na obrazovku, zelená.** Dnes je hero tlačidlo hnedé a v hlavičke
   zelené — to isté „vybrať vozidlo" dvoma farbami.
3. **Svetlý teplý podklad, tmavý len hero a footer.** Dnes končí stránka dvoma tmavými
   pásmi (newsletter + footer).
4. **Rovnaký rytmus všade.** Sekcia = nadpis H2 + krátky úvod + odkaz „Zobraziť všetko →".
5. **Mobil ako prvý.** Dve karty vedľa seba, nie jedna na celú šírku (PLP má dnes 10 400 px
   na 12 produktov).

## 3. Základy

|           | Hodnota                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------- |
| Písmo     | Geist (od `59465e7`), číslice cien `tabular-nums`                                                   |
| Škála     | display 56/59 (mobil 36) · H2 32/37 (24) · H3 20/26 · text 16/26 · meta 13–14 · drobné 12,5         |
| Nadpisy   | tučné, `letter-spacing` −0,02 až −0,03 em                                                           |
| Rytmus    | sekcie 80 px desktop / 48 px mobil; mriežka 20 px / 10 px                                           |
| Kontajner | `max-w-7xl` (1280 px), okraje 32 / 16 px                                                            |
| Zaoblenia | existujúca škála: 12 tlačidlá, 16 karty, 20 dlaždice, 24 bannery                                    |
| Karty     | biele, 1 px `border-subtle`, bez dvojitého rámu; tieň len na hover                                  |
| Ikony     | lucide, 20 px, jedna hrúbka čiary; ikonové podložky v `forest-50` alebo `surface-muted`, nie dúhové |

## 4. Komponenty

- **Hlavička:** plná biela (dnes 80 % priehľadná s rozmazaním — obsah presvitá);
  „SK" a „EUR" spojené do jedného čipu „🌐 SK · €" (oba dnes otvárajú ten istý zoznam
  a „EUR" vyzerá ako prepínač meny, čo §5 zakazuje); „Vybrať vozidlo" zelený čip.
- **Produktová karta:** obrázok prvý (1 : 1, biely), pod ním „Značka · Kategória",
  názov na 2 riadky, dostupnosť, cena + „s DPH" a kompaktné zelené „Do košíka".
  Stav kompatibility podľa §7 („Overená kompatibilita" / „Vyberte vozidlo" /
  „Univerzálny produkt"). **Počet kusov sa z karty presúva na PDP** (dnes má každá karta
  stepper aj tlačidlo). Mobil: 2 stĺpce; desktop: 4 stĺpce od 1280 px.
- **Dlaždica kategórie:** fotka kategórie zo Saleoru (`backgroundImage`, 28–51 KB),
  tmavý prechod dole, názov a šípka. Nahrádza ikony s dúhovými podkladmi.
- **Dôvera:** 4 fakty s ikonou — Kompletná zostava · Overená kompatibilita · Záruka 2 roky ·
  Doručenie 5–10 pracovných dní (Slovenská pošta a FedEx, cenu dopravy uvidíte v košíku).
  Nahrádza vágne „Rýchle dodanie — odosielame rýchlo a spoľahlivo".

## 5. Stránky

**Homepage:**

1. Hero — súčasný nadpis a podnadpis, zelené „Vyberte vaše vozidlo" + sekundárne
   „Strešné boxy →", tri fakty, vpravo fotka so štítkom produktu.
2. Nakupujte podľa kategórie — 6 dlaždíc s fotkami.
3. Nosič presne na vaše auto — výber vozidla + značky áut ako odkazy na 1 475
   stránok vozidiel (interné prelinkovanie).
4. Odporúčané produkty — Saleor kolekcia `featured-products`, 8–12 kariet.
5. Pás dôvery.
6. Značky (povolený zoznam §6) ako odkazy.
7. Poradňa — hlavný článok + 3–4 otázky.
8. Newsletter — **ponechaný** (rozhodnutie vlastníka), svetlá karta namiesto tmavého pásu.
9. Footer so stĺpcom kategórií (už v `3a52e64`).

**Kategória:** hero s fotkou a čitateľnými drobkami, čipy podkategórií
(„Všetko (101) · Strešné boxy (60) · Príslušenstvo (41)"), zelená lišta vozidla,
4 / 2 stĺpce. **Strešné nosiče:** bez vybraného auta najprv výber značky (dnes je
zoznam značiek až pod 12 zostavami zoradenými abecedne od Alfa Romeo).

**PDP:** nadpis rozdelený na produktovú líniu a vozidlo (celé meno zostáva v H1 kvôli
SEO, vozidlo je menší riadok), kompatibilita tesne nad cenou (§8, 4 stavy),
„Kompletná zostava: tyče + pätky + kit" s číslami dielov namiesto `SKU: N21242|N20001|N15021`,
cena, počet + zelené „Pridať do košíka", štyri fakty pod tlačidlom (záruka, 14 dní na
odstúpenie, dopravcovia, cena dopravy v košíku).

## 6. Poradie implementácie (malé vetvy, každá so screenshotmi desktop + mobil)

1. Produktová karta + mriežka (PLP, vyhľadávanie, homepage) — najviac videná zmena.
2. Homepage (sekcie 1–8; produkty až keď existuje kolekcia, dovtedy sa sekcia skryje
   ako dnes).
3. PDP buy box.
4. Hlavička (čip trhu, plné pozadie) a kategória (čipy, poradie pre strešné nosiče).

## 7. Otázky pred implementáciou

1. **Fotka v hero:** galéria Thule v Saleore obsahuje lifestyle zábery (makety ich
   používajú). Či ich smieme použiť aj mimo produktu, na homepage, treba overiť
   u distribútora — inak vlastná fotka.
2. **Stepper na karte preč?** Návrh áno (menej šumu, rovnaká akcia); počet ostáva na PDP.
3. **2 stĺpce na mobile, 4 na desktope** — súhlas?
4. **Newsletter ako svetlá karta** namiesto tmavého pásu — súhlas?
