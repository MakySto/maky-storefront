# Titulok, meta popis a nadpis popisu · strana storefrontu (17. 11. 2026)

Odpoveď webu na `STOREFRONT_TEXT_STANDARD_V1` (CFM, 17. 11. 2026). Dĺžky (titulok do 70, meta popis 70 až 155 znakov) sú odporúčanie CFM, nie hranica: web nič z toho, čo CFM poslal, neorezáva.

| Časť stránky                            | Zdroj                                                                                               | Čo robí web                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| H1                                      | `name`                                                                                              | bez zmeny                                                                |
| Nadpis karty popisu (H2)                | prvý blok popisu, `header` úrovne 2 bez značky                                                      | pozri `maky-content.md`, „Nadpis popisu“; bez neho karta nadpis nemá     |
| `<title>`                               | `maky_seo_title:<jazyk>` z verejných metadát produktu, inak `seoTitle`, inak názov (ten reže na 60) | celý, ako prišiel                                                        |
| Meta popis (`description`, OG, Twitter) | `seoDescription`                                                                                    | celý, ako prišiel; len náhradný názov a iné druhy stránok sa režú na 155 |
| Riadok pod H1                           | `seoDescription`                                                                                    | bez zmeny                                                                |

## Titulok dlhší než pole Saleoru (70 znakov)

Prijaté: kľúč verejných metadát produktu `maky_seo_title:<jazyk>`, kde `<jazyk>` je jazyková časť miestneho kódu trhu malými písmenami (`sk`, `de`, `pl`; `de-AT` aj `de-DE` čítajú `de`, `en-US` aj `en-CA` čítajú `en`). `seoTitle` ostáva so skrátenou hodnotou, takže čítač, ktorý kľúč nepozná, ukáže to, čo dnes.

- Stránka vezme kľúč svojho jazyka, ak má hodnotu, ktorá nie je iba názov obchodu. Kľúč iného jazyka nečíta nikdy. Bez kľúča je to `seoTitle` ako doteraz.
- Celý titulok z kľúča sa berie ako schválený (`titleSource: "seo"`): web ho neskracuje a „ | MAKY.STORE“ pripíše len vtedy, keď výsledok nepresiahne 65 znakov, ako pri `seoTitle`.
- Web číta kľúč iba pri produkte (GraphQL `ProductDetails`, pole `metadata`). Kategórie a stránky `seoTitle` bez kľúča.
- Kľúč, ktorý CFM ešte nepíše, nič nemení: kým ho CFM nezačne zapisovať, stránky vyzerajú ako predtým.

## Čo web nemení

Pravidlo zahraničných trhov (`exact-locale.ts`: produkt bez `name`, `description`, `seoTitle`, `seoDescription` alebo `slug` v jazyku sa neukáže) ostáva. Náhradné hodnoty (názov) ostávajú ako záchranná sieť; to, čo čítalo ako obsah (pevný nadpis), je preč.
