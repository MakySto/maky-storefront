# Obsah stránok v3

Mení tri pravidlá `storefront-cms-pages-v2`; REST tvar, `depth=1`, bloky a Lexical allowlist ostávajú.

## 1. Nepodporovaný alebo chybný blok sa preskočí

V2 odmietal celý dokument pri prvom nepodporovanom bloku. V3:

- **Redakčná stránka** (`legalMetadata.documentType` ≠ `legal`): blok nepodporovaného typu alebo blok, ktorý neprejde validáciou (neznámy Lexical uzol, neplatná URL, chýbajúce povinné pole, médium bez `alt`), sa **preskočí**. Ostatné bloky sa zobrazia.
  - Diagnostika: štruktúrovaný log `[cms] block-skipped` s `documentId`, `slug`, indexom bloku, `blockType`, `nodeType` a dôvodom — **bez** obsahu bloku.
- **Právna stránka** (`documentType: "legal"`) ostáva fail-closed: chybný blok = celý dokument neplatný, lebo vynechaný odsek právneho textu mení jeho význam.
- **Bezpečný fallback**: ak po preskočení nezostane v danom trhu žiadny zobraziteľný blok, dokument je neplatný ako doteraz (bootstrap stránky alebo „obsah nie je dostupný“ s `noindex`) — nikdy prázdna úspešná stránka.
- Kontroly sa **nezmäkčujú**: povolené protokoly odkazov, pôvod médií (`https://cms-media.maky.store/media/`), jazyk bez fallbacku, žiadne HTML. Blok, ktorý ich porušuje, sa nezobrazí.
- Nepodporovaný blok CMS od vlákna 2 nepustí ani do publikovania (kontrola pripravenosti) a admin ho neponúka; preskočenie je druhá obrana pre staré dáta.

## 2. Focal point

`public-media` nesie `focalX` a `focalY` (0–100, percentá, predvolene 50/50). Storefront ich pri orezaní (`object-fit: cover`) použije ako `object-position: <focalX>% <focalY>%`. Chýbajúca alebo neplatná hodnota = stred.

## 3. Značka revízie

Každá stránka zobrazená z CMS dokumentu (publikovaná aj náhľad) má v `<head>`:

```html
<meta name="maky-cms-revision" content="pages:<id dokumentu>@<updatedAt dokumentu>">
```

CMS podľa nej overuje, že verejná stránka ukazuje novú verziu ([revalidation-event-v2.md](./revalidation-event-v2.md)). Hodnota neobsahuje nič tajné.
