# Vlákno 5 — `us` (USA) a `ca` (Kanada)

Najprv `00-univerzalne-zadanie.md`. **Angličtina je posledná etapa**, nie preto, že je
právne nemožná, ale preto, že trhy EÚ sú lacnejšie a rýchlejšie.

| trh | kanál    | mena | locale |
| --- | -------- | ---- | ------ |
| us  | `us-usd` | USD  | en-US  |
| ca  | `ca-cad` | CAD  | en-CA  |

## 1. Cieľ

**Použiteľná anglická verzia všetkých ôsmich stránok** pre slovenského predajcu:
spoločný základ MAKY + konkrétne overené trhové doplnky. Implementovateľný obsah,
nie zadanie pre právnika.

**Jeden anglický text stačí.** `en-US` a `en-CA` sa líšia pravopisom; druhý preklad
kvôli _color/colour_ nemá zmysel. Rozdiely, ktoré význam majú, riešiš doplnkami
podľa trhu — rovnako ako mena.

## 2. Čo NEROBIŤ — opravy môjho skoršieho zadania

Predchádzajúca verzia tohto súboru tvrdila, že päť právnych stránok treba zahodiť
a napísať nanovo. **To bolo príliš kategorické a v jednej veci vecne nesprávne.**

**GDPR sa nevypína.** MAKY spracúva údaje v kontexte svojej slovenskej prevádzky, a
čl. 3 ods. 1 GDPR sa viaže na prevádzkovateľa, nie na pobyt zákazníka. EDPB to
výslovne vysvetľuje aj na príklade európskej firmy, ktorej zákazníci sú výlučne mimo
EÚ. Stránku ochrany údajov teda **neprepisuješ na „americké GDPR"** — ponecháš
slovenský základ a preveríš, čo treba doplniť (PIPEDA, štátne zákony USA). Miestne
pravidlá GDPR dopĺňajú, nenahrádzajú.
→ EDPB Guidelines 3/2018, čl. 3 ods. 1.

**Benefit nie je to isté čo zákonný nárok.** To, že americký zákon nepredpisuje
14 dní, neznamená, že ich nesmieš dať. Schválené výhody MAKY (14 dní, 30 dní pre
prihlásených) **zachovaj** — ale opíš ich ako záväzok MAKY, nie ako miestny zákon.
Rovnako nevyrob z „24 mesiacov" konečný limit tam, kde miestne právo chráni dlhšie
(Quebec nemá všeobecnú pevnú dvojročnú hranicu).

**Daňová registrácia nie je automatická.** Neplatí, že prvá objednávka vyžaduje
registráciu. Kalifornia má prah 500 000 USD ročne — a to je **príklad jedného štátu**,
nie limit USA. Kanada rozlišuje, či subjekt „carries on business in Canada", a má
osobitný režim pre tovar posielaný priamo zo zahraničia poštou či kuriérom.
Úloha znie: **vyhodnotiť skutočný model a sledovať predaje**, nie preventívne
registrovať.

## 3. Čo naozaj treba vyriešiť pred predajom

Nie je to právnická práca, je to prevádzková:

1. **Clo a dovozné náklady.** Čo platí zákazník v pokladni, čo môže platiť pri dovoze,
   kto rieši colné konanie. Veta „ostatné náklady znáša zákazník" **nestačí** ako
   splnenie informačnej povinnosti. Over konkrétny variant s dopravcom — úloha
   colného zástupcu, platiteľa a _importer of record_ nie sú to isté.
2. **DPH pri vývoze.** Vývoz mimo EÚ môže byť oslobodený od slovenskej DPH pri
   splnení podmienok. **Nekopíruj „ceny vrátane DPH"** do US/CA bez overenia — na
   rozdiel od trhov EÚ tu to nie je automaticky pravda.
3. **Spätná doprava.** Nesľubuj zvoz z USA či Kanady, kým ho nemáš. Rovnaká filozofia
   pomoci, ale reálny rozsah služby.
4. **ARS.** Zákon 391/2015 § 1 ods. 2 vymedzuje spotrebiteľa s pobytom v SR alebo inom
   členskom štáte EÚ. **Nesľubuj zákazníkovi z US/CA prístup k slovenskému ARS.**
   SOI však zostáva orgánom dohľadu nad predajcom — to je iná veta, nevypúšťaj ju.
5. **Sortiment.** Pre prvú etapu vyber produkty s overenou vhodnosťou pre cieľový trh.
   Európsky názov modelu nie je dôkaz vhodnosti. Neistota pri jednom výrobku
   **obmedzí len jeho predaj**, nie celé stránky.

## 4. Quebec

Charta francúzskeho jazyka sa na spotrebiteľské zmluvy vzťahuje. Dve možnosti,
predlož obe Marekovi, nerozhoduj sám:

- francúzsky kanadský doplnok (jazykové podklady vieš vziať z vlákna IT/FR — ale
  **francúzske právo z toho neber**, je to iná jurisdikcia), alebo
- neskoršia etapa pre Quebec s reálnym obmedzením doručenia.

## 5. Odovzdanie

Osem stránok × 2 trhy, obsahová matica (spoločné / trhový údaj / miestne záväzné
pravidlo / prevádzkový dôkaz), a krátky zoznam vecí na **obchodné** rozhodnutie.
Pri každom právnom tvrdení zdroj a dátum kontroly.

Nie je to právne osvedčenie všetkých štátov a provincií a netvári sa tak.
