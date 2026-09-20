# M · konzument `cfm.commerce2.market-slug-redirects/1`

Storefront strana PUBLIC_MARKET_URL_V2 (CFM handoff `baeb127382052d03a39b02823a0acc0e19358131`).
Kód: `f685f83`. **M slug negeneruje ani neodvodzuje** — číta, čo Saleor podáva, a pre nahradenú URL
číta túto mapu.

## Čo M prijíma

```json
{
	"schema": "cfm.commerce2.market-slug-redirects/1",
	"entries": [
		{
			"cfm_product_id": "CFMP-B-NOR-a51bec20924e7e-000000",
			"language_code": "DE_AT",
			"old_slug": "dachtrager-…-cfmp-b-nor-a51bec20924e7e-000000",
			"new_slug": "dachtrager-nordrive-helio-silver-audi-80-avant-1991-1995-offene-dachreling"
		}
	]
}
```

- `language_code` je kód z kontraktu v2, takže riadok patrí **práve jednému trhu**: `CS`→cz, `DE`→de,
  **`DE_AT`→at**, `PL`→pl, `HU`→hu, `IT`→it, `FR`→fr, `ES`→es, `RO`→ro, `EN`→us, **`EN_CA`→ca**.
  `SK` ani `EN_US` žiadny trh nečíta — také riadky M zahodí a spočíta, nikdy neuhádne.
  DE a DE_AT môžu mať rovnaký `new_slug`; sú to dva rôzne trhy a dva rôzne riadky.
- `new_slug` musí byť tvar `^[a-z0-9]+(?:-[a-z0-9]+)*$` (rovnaký ako produktový slug v kontrakte v2).
- `cfm_product_id` sa páruje so Saleor `externalReference`; prefix `cfm:product:` aj veľkosť písmen sú
  jedno. Overené 20. 9.: 500/500 produktov kohorty identitu nesie. **Produkt bez `externalReference`
  sa nepresmeruje** — bez identity sa nedá dokázať, že cieľ je ten istý produkt.

## Ako sa doručuje

```bash
# súbor mimo git stromu, vedľa ostatných artefaktov
/opt/storefront-artifacts/MARKET_SLUG_REDIRECTS_apply_<dátum>.json

# .env (zmena = reštart PM2, bez buildu)
MAKY_MARKET_SLUG_REDIRECTS_PATH=/opt/storefront-artifacts/MARKET_SLUG_REDIRECTS_apply_<dátum>.json
MAKY_MARKET_SLUG_REDIRECTS_SHA256=<sha256 doručených bajtov>
```

Mapa sa číta raz za proces. Každá chyba — chýbajúca cesta, nečitateľný súbor, nesúhlasný hash, cudzia
schéma, poškodený riadok — končí **bez presmerovaní**; to je bezpečný smer, lebo do výmeny v Saleore
je platná stará URL. Stav je v logu PM2 (`[market-slug-redirects] loaded N entries in M markets …`).

## Čo M s mapou robí

1. **Nepresmeruje predčasne.** Presmerovanie sa vykoná, iba ak `new_slug` v danom trhu a jeho jazyku
   **už existuje** v Saleore **a** patrí produktu z `cfm_product_id`. Kým výmena neprebehla, stará URL
   naďalej obsluhuje; kým beží, kontrola stojí jeden cachovaný dotaz (300 s pozitívne, 60 s negatívne).
2. **Jeden trvalý skok.** 301 na `/{trh}/{new_slug}`, query sa zachová, `.rsc` navigácia ide na čistú
   stránku. Reťazce (`a→b`, `b→c`) sú splošťené pri načítaní na `a→c`. Cyklus, príliš dlhý reťazec,
   starý slug s dvoma vlastníkmi a reťazec, ktorý by prešiel na iný produkt, sa zahadzujú.
3. **Stará `/{trh}/products/{slug}`** skončí tiež jedným skokom rovno na novú URL (nie 308 + 301).
4. **Žiadna rezervovaná cesta.** Čo je produktová URL, rozhoduje `classifyRoute` — košík (`warenkorb`,
   `kosik`, …), `search`, `products`, lokalizovaný koreň kategórie a právne stránky sú mimo. Ak by mapa
   taký slug obsahovala, M ho aj tak nepoužije. SK sa nedotýka vôbec.

## Čo M potrebuje od CFM

- Skutočné `old_slug` z dnešného Saleoru (nie rekonštrukcia normalizátorom) — inak mapa nepokryje
  dnešné URL. Týka sa najmä **33 dnes verejných canary kombinácií** (3 produkty × 11 trhov).
- `externalReference` nech zostane na každom produkte kohorty.
- Rezervované routy trhu nech neobsadí žiadny `new_slug` (zoznam vyššie).
- Po doručení M overí sha256 a **oznámi pripravenosť**; až potom má zmysel meniť slugy v Saleore.

## Revalidácia po výmene slugu (overené na canary 2026-09-20)

Udalosť sa posiela **nezmenená**: `{"product":{"slug":"<base slug>"},"channel":"<kanál>"}`. Preložený
slug do requestu nepatrí a endpoint ho nikdy nevráti.

- **Tag nesie base slug, nie preložený.** `/api/revalidate` skladá `product:{kanál}:{locale}:{slug}`
  z toho, čo dostal. Zahraničná PDP je pritom otagovaná **oboma** — svojím URL slugom aj base slugom
  (`src/lib/saleor/product-cache-tags.ts`), takže base-slug udalosť na ňu dosiahne. Kontrola
  `expected_tag` postavená na novom slugu preto nikdy neprejde, hoci purge prebehol správne.
- **Cachovaný not-found pod novou URL** čistí `product-miss:{kanál}:{locale}`, ktorý každá produktová
  aj kategóriová udalosť v danom kanáli vydá. SK sa netaguje — tam je URL slug zároveň base slug.
- **Purge sa neprejaví okamžite.** Request vyslaný hneď po odpovedi endpointu ešte dostane starý
  záznam; pri odstupe ~2 s sa prepočíta vždy. Pri overovaní zvyšku kohorty s tým treba rátať.
