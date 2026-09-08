# Vlákno 6 — Returns V2 pre viac trhov

Najprv `00-univerzalne-zadanie.md`. Toto vlákno **nepíše texty** — vlastní backendovú
závislosť, kvôli ktorej štyri jazykové vlákna inak iba zapíšu „formulár nebude".

Beží **paralelne** s jazykovými vláknami. Tie naň nečakajú.

## 1. Prečo existuje

`src/lib/withdrawal/contract.ts`:

```ts
export const WITHDRAWAL_MARKET = "SK";
export const WITHDRAWAL_LOCALE = "sk";
```

Literálové typy, ktoré Payload validuje. Podanie z iného trhu endpoint odmietne, preto
`servesOnlineFunction()` formulár mimo SK nevykreslí.

To je správna **dočasná** ochrana. Nie je to cieľ: nemecký **§ 356a BGB** online funkciu
odstúpenia priamo predpokladá, takže pre `/de` je to blokátor spustenia.

## 2. Rozsah

1. **Rozšíriť kontrakt na viac trhov a jazykov.** Trh, jazyk a verzia podmienok musia
   sedieť s tým, čo zákazník videl.
   ❌ **Nikdy neposielaj cudzí trh ako `market: "SK"`.** Vyrobilo by to právny záznam
   s nepravdivým trhom, čo je horšie než chýbajúci formulár.
2. **Zachovať SK kompatibilitu.** Existujúce podania a ich artefakty sa nesmú zmeniť.
   Historické záznamy hromadne neprepisuj.
3. **Časové údaje.** Dve krajiny, dve rôzne udalosti:

   - **SK § 20a ods. 5** zákona 108/2024 — dátum a čas **odoslania**,
   - **DE § 356a ods. 4 BGB** — **prijatie** („Datum und Uhrzeit ihres Eingangs“).
     Ods. 3 je potvrdzovací krok („Widerruf bestätigen“), nie obsah potvrdenia.

   Dnes Payload generuje `submittedAt` **pri ukladaní záznamu**, čo nie je presne ani
   jedno. Navrhni malý serverový kontrakt, ktorý rozlíši udalosti, ktoré systém naozaj
   pozoruje: dokončenie podania zachytené serverom, prijatie, uloženie. Čas klienta sa
   smie zaznamenať len ako **deklarovaný**, nikdy ako autoritatívny.

   ⚠️ Samotné pridanie poľa problém nerieši. Musí byť jasné, ktorú udalosť ktoré
   poučenie cituje.

4. **Vratkové pravidlo nesmie určiť klient.** Ani cez URL, ani cez skryté pole.
5. **Oddeliť tri veci:** prijatie oznámenia ≠ posúdenie nároku ≠ vykonanie refundácie.
   Verejné podanie samo nespúšťa platbu, rušenie objednávky ani objednanie zvozu.
6. **Neviazať prijatie na podmienky.** Žiadny účet, dôvod, fotografia ani dohodnutý
   zvoz ako podmienka prijatia oznámenia.

## 3. Čo musí byť otestované proti skutočnému backendu

Nie proti mocku — tie prešli aj vtedy, keď formulár nikdy nefungoval:

- trvalé uloženie podania,
- e-mail zákazníkovi,
- opakované odoslanie rovnakého `submissionId` (idempotencia),
- **timeout po úspešnom zápise**,
- **zlyhanie e-mailu po úspešnom zápise** — podanie zostáva platné, retry, upozornenie
  obsluhe.

⚠️ Pri neistom výsledku **UI nesmie tvrdiť, že nič neprišlo**. Stránka s potvrdením nad
neuloženým podaním je najhorší možný výsledok; opačná chyba je takmer rovnako zlá.

⚠️ Testovacie zápisy do produkcie iba s osobitným súhlasom — vyrábajú reálny právny
záznam. Uprednostni staging alebo riadené podanie na testovacej objednávke so zmazaním.

## 4. Čo nezapínať

`WITHDRAWAL_BACKEND_LIVE` ani žiadnu inú premennú prostredia (CLAUDE.md §10).
Odovzdáš overený tok; zapnutie je Marekovo rozhodnutie.

## 5. Odovzdanie

Vetva, zoznam vlastnených súborov, a oddelene: implementované / overené proti
skutočnému backendu s výstupmi / zostávajúce závislosti s vlastníkom.
