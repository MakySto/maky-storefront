# Blok 1 — identita a pravdivosť homepage (2026-09-07)

Vetva `fix/site-identity-v1`, odbočená z **produkčného `a5978f5`** — zámerne nie z vlákna A
ani B, aby sa dala nasadiť samostatne a aby si ju obe vlákna zobrali jedným malým diffom.

**Branch-only. Nič z toho nie je nasadené.**

---

## 1. Čo sa opravilo

|                                             | pred                                                                           | po                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Dlaždica „Nosiče lyží“ na homepage          | `/categories/nosice-lyz` → **HTTP 200 + telo „Stránka nenájdená“**             | `/categories/nosice-lyzi`, 26 produktov                |
| Zdroj slugov kategórií                      | ručne v dvoch súboroch, rozišli sa                                             | `src/config/categories.ts`, jedno miesto               |
| `<title>` homepage                          | `MAKY.STORE`                                                                   | `Strešné nosiče, boxy a nosiče bicyklov \| MAKY.STORE` |
| Meta description                            | „ťažné zariadenia, elektrické sady. 10 európskych trhov.“                      | bez zakázaných kategórií, bez zakladateľských metrík   |
| `<h1>`                                      | tri menu-labely zlepené: „Strešné nosiče, Strešné boxy, **Ťažné zariadenia**“  | vetná copy z `home.heroTitle`, 12 jazykov              |
| Podnadpis hero                              | ternár na `common.country === "Slovensko"` — 9 z 12 jazykov dostalo angličtinu | `home.heroSubtitle`, 12 jazykov                        |
| Ikony (9 súborov)                           | Paperove „P“                                                                   | jeleň z `public/logo-deer.webp`                        |
| `site.webmanifest`                          | `"name": "Paper"`                                                              | `MAKY.STORE` / `MAKY`, 3 ikony vrátane maskable        |
| `favicon.ico`                               | PNG s príponou `.ico`                                                          | skutočné ICO 16/32/48                                  |
| `opengraph-image.png` + `twitter-image.png` | Saleor demo „**Acme Storefront** — powered by Saleor“                          | karta MAKY v Geiste                                    |
| `og:image`                                  | **chýbal na celom webe okrem PDP**                                             | doplnený v `(main)/layout.tsx`                         |
| Kategórie na homepage                       | 7 dlaždíc, z toho 2 prázdne (ťažné 0, reťaze 0), chýbali stany                 | 6 dlaždíc, všetky s produktmi                          |

Ťažné zariadenia sú von podľa CLAUDE.md §6 (a majú 0 produktov). Snehové reťaze sú von,
lebo majú 0 produktov. Obe zostávajú v katalógu s uvedeným dôvodom — keď dostanú tovar,
vráti ich jeden riadok v `categories.ts`.

## 2. Prečo to nič nezachytilo

Kategóriová stránka **nevie vrátiť 404**, keď je streamovaná škrupina už odoslaná (PPR).
Rozbitá dlaždica preto odpovedala **HTTP 200** s telom „Stránka nenájdená“ a `noindex`.
Žiadny status-code monitoring to nevidí. Preto sú v tomto bloku dve brány, nie oprava:

- **`src/config/categories.test.ts`** padne, keď sa slug kategórie objaví ako literál
  kdekoľvek inde v `src/`. Overené tým, že som starý slug vrátil späť — test pomenoval
  súbor. Drift je odteraz nemožný, nie len opravený.
- **`pnpm check:nav`** sa pýta živého webu a Saleoru. Číta `<title>` a robots meta, nie
  status kód, takže vidí soft-404; a padne aj na dlaždici, ktorá vedie do reálnej, ale
  prázdnej kategórie. Overené tým istým spôsobom: `nosice-lyz` → `FAIL … Stránka nenájdená`.

## 3. Konflikt s vláknom B — presné riešenie

`git merge-tree` proti `claude/vlakno-b-selektor-datasethash-0387f6 @ 2139f1a`:
**jediný konflikt**, `src/ui/components/homepage/hero-section.tsx`, dva riadky. Všetko
ostatné vrátane 12 i18n súborov sa zlučuje samo.

Obe strany mažú iný hook v tom istom bloku: B maže `tf` (spolu s mŕtvym tlačidlom, ktoré
ho používalo), ja mažem `tc` (spolu s tým jazykovým ternárom). Riešenie je **zobrať obe
mazania**:

```tsx
export function HeroSection({ vehicleAction }: { vehicleAction?: ReactNode }) {
	const t = useTranslations("nav");
	const th = useTranslations("home");
```

Zvyšok súboru sa poskladá sám: B-čkovský slot `{vehicleAction}` a moja copy v `<h1>`/`<p>`
sa nedotýkajú. **Mŕtve tlačidlo „Vybrať vozidlo“ som zámerne nechal tak — patrí vláknu B.**

## 4. Overenie

Build **vo worktree**, nikdy v `/opt/storefront` (CLAUDE.md §13.1/§13.7), potom
`next start -p 3311` a čítanie skutočne vyrenderovanej stránky.

```
lint          rc=0   (6 warningov, všetky v súboroch, ktorých som sa nedotkol)
tsc --noEmit  rc=0
pnpm i18n:check      rc=0
vitest        83 súborov / 1231 testov, rc=0
pnpm build    rc=0
pnpm check:css       rc=0   — 6 animate-* tried, všetky emitované
pnpm check:nav       rc=0   — 6 kategórií, všetky s produktmi a indexovateľné
pnpm check:published rc=1   — jediná červená položka je `brand`, čo je diera CFM
```

Vyrenderovaná homepage z toho buildu: `<title>` a description nové, `og:title` aj
`twitter:title` ich dedia, `og:image` je späť, v HTML nie je ani `Acme`, ani `Paper`,
ani `elektrické sady`, ani `10 európskych trhov`. Reťazec „Ťažné zariadenia“ v HTML
**zostáva** — ale iba v serializovanom slovníku next-intl, ktorý sa posiela klientovi;
nikde sa nerenderuje. Kľúč je ponechaný zámerne.

Všetkých 12 ikonových/OG URL odpovedá 200 so správnym typom vrátane nového
`/android-chrome-maskable-512x512.png` (`pnpm generate:routing` musí bežať po každom
pridaní súboru do `public/`, inak ho proxy považuje za neplatnú trhovú predponu).

## 5. Nálezy, ktoré som NEOPRAVIL

- **`en-CA.json` chýba 212 kľúčov** oproti ostatným 11 jazykom — celé namespacy `cart.*`
  a `checkout.*`. Je to **na produkcii**, nie z tohto bloku. `pnpm i18n:check` to
  nezachytí (kontroluje manifest closure a maticu, nie paritu kľúčov); vidí to až
  paritný skript z CLAUDE.md §11. next-intl nie je type-augmentovaný, takže by to padlo
  ticho za behu. Trh nie je živý, takže to dnes nikoho nebolí.
- **`Počet lyží / snowboardov: 46 057`** na `gp-prislusenstvo-ku-nosicu-lyzi-pz-gp1001`.
  Saleor vracia doslova `"46057"` na `cfm:attribute:ski_snowboard_capacity`. Dáta, nie
  kód — patrí CFM. Stálo by za to spraviť pre atribúty to, čo `check:published` spravil
  pre JSON-LD.
- **`src/app/api/og/route.tsx`** nie je odnikiaľ volaný a nesie zastarané hex hodnoty
  (CLAUDE.md §12). Mŕtva routa.
- **Mŕtve CTA „Vybrať vozidlo“** v hero — vlákno B ho už nahradilo slotom.
- **Celý slovník next-intl (448 kľúčov) sa posiela klientovi** na každej stránke. Pre
  blok „rýchlosť“, nie sem.

## 6. Ako ikony a kartu prekresliť

```bash
node scripts/brand/generate-icons.mjs     # 9 súborov + maskable
node scripts/brand/generate-og-image.mjs  # opengraph-image.png + twitter-image.png
pnpm generate:routing                     # po každom pridaní súboru do public/
```

Zdroj je `public/logo-deer.webp`, farby sú sRGB prepočty OKLCH primitív z `brand.css`
(copper-600 / copper-300 / sand-50 / gray-900). Karta je sadzaná v Geiste z TTF, ktoré
balík `geist` už dodáva; librsvg fonty nachádza výhradne cez fontconfig, preto si skript
píše vlastný `fonts.conf` a sharp načítava až potom dynamickým importom.
