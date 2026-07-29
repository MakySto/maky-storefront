# Natvrdo zapísané anglické reťazce — na preklad

Stav k 2026-07-29, vetva `feat/product-experience-v1`.

Toto sú reťazce, ktoré **neprechádzajú cez next-intl** — sú napísané priamo v kóde,
takže sa zobrazia po anglicky vo všetkých dvanástich jazykoch vrátane slovenčiny.
Nájdené skenom `src/` (bez dev nástrojov a testov).

**Ako to čítať:** stĺpec „Návrh SK" je môj návrh, nie hotová vec — prepíš, čo sa ti
nepáči. Každý riadok znamená nový kľúč v `src/i18n/messages/*.json`, ktorý musí
pribudnúť do **všetkých 12 súborov** naraz (next-intl chýbajúci kľúč nenahlási pri
builde, zlyhá až za behu).

**Priorita.** Sekcie sú zoradené podľa toho, koho sa dotknú. Produkty, košík a
pokladňa sú už preložené — tam nič nechýba. Účet a registrácia sú najväčšia skupina,
ale zákazník ich uvidí až po prihlásení.

Už opravené (netreba prekladať, kľúče existovali): mobilná nákupná lišta na PDP
hlásila „Add to bag" / „Adding…" — teraz používa `common.addToCart` a
`product.addingToCart`.

---

## 1. Hlavička a navigácia — vidí ich každý návštevník (6)

Toto je najviditeľnejšia skupina. „Log in" je v hlavičke na každej stránke.

| Anglicky               | Návrh SK          | Kde                                                   |
| ---------------------- | ----------------- | ----------------------------------------------------- |
| Log in                 | Prihlásiť sa      | `nav/components/user-menu/user-menu-container.tsx:37` |
| Open user menu         | Otvoriť menu účtu | `nav/components/user-menu/user-menu.tsx:20`           |
| Open menu              | Otvoriť menu      | `nav/components/mobile-menu.tsx:38`                   |
| Navigation menu        | Navigačné menu    | `nav/components/mobile-menu.tsx:44`                   |
| Search for products    | Hľadať produkty   | `nav/components/search-bar.tsx:16`                    |
| Search for products... | Hľadať produkty…  | `nav/components/search-bar.tsx:28`                    |

## 2. Galéria a chybové stavy — vidí ich návštevník bez prihlásenia (8)

| Anglicky                        | Návrh SK                                    | Kde                                                          |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Previous slide                  | Predchádzajúci obrázok                      | `ui/carousel.tsx:205`                                        |
| Next slide                      | Ďalší obrázok                               | `ui/carousel.tsx:233`                                        |
| Go to slide {N}                 | Prejsť na obrázok {N}                       | `ui/carousel.tsx` (bodky pod galériou)                       |
| No image                        | Bez obrázka                                 | `search-results.tsx:63`                                      |
| No products match your filters. | Vášmu výberu nezodpovedajú žiadne produkty. | `products-client.tsx:83`, `collections/[slug]/client.tsx:71` |
| Unable to load product options. | Nepodarilo sa načítať možnosti produktu.    | `pdp/variant-section-error.tsx:18`                           |
| Page Not Found                  | Stránka sa nenašla                          | `app/not-found.tsx:22`                                       |
| Channel Not Configured          | Trh nie je nastavený                        | `app/page.tsx:19`                                            |

## 3. Prihlásenie a registrácia (13)

| Anglicky                                        | Návrh SK                                                    | Kde                              |
| ----------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| Welcome Back                                    | Vitajte späť                                                | `auth/login-mode.tsx:120`        |
| Enter your password                             | Zadajte heslo                                               | `auth/login-mode.tsx:177`        |
| Set New Password                                | Nastaviť nové heslo                                         | `auth/set-password-mode.tsx:109` |
| Password Updated!                               | Heslo bolo zmenené                                          | `auth/set-password-mode.tsx:94`  |
| At least 8 characters…                          | Aspoň 8 znakov…                                             | `auth/set-password-mode.tsx:131` |
| Confirm your password                           | Potvrďte heslo                                              | `auth/set-password-mode.tsx:158` |
| Create an Account                               | Vytvoriť účet                                               | `sign-up-form.tsx:123`           |
| Account Created!                                | Účet bol vytvorený                                          | `sign-up-form.tsx:105`           |
| Please check your email to verify your account. | Účet si potvrďte cez odkaz, ktorý sme vám poslali e-mailom. | `sign-up-form.tsx:106`           |
| First name                                      | Meno                                                        | `sign-up-form.tsx:153`           |
| Last name                                       | Priezvisko                                                  | `sign-up-form.tsx:168`           |
| Minimum 8 characters…                           | Aspoň 8 znakov…                                             | `sign-up-form.tsx:208`           |
| Re-enter your password                          | Zadajte heslo znova                                         | `sign-up-form.tsx:237`           |

Ďalej sú tam dvojice pre tlačidlá stavu: `Hide password` / `Show password`
(→ Skryť heslo / Zobraziť heslo), `Creating account…` (→ Vytvárame účet…).

## 4. Účet zákazníka — najväčšia skupina (30)

Uvidí ju až prihlásený zákazník, takže je menej naliehavá, ale je jej najviac.

| Anglicky                                        | Návrh SK                                                 | Kde                                                           |
| ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Account                                         | Účet                                                     | `account/account-nav.tsx:73`                                  |
| Overview                                        | Prehľad                                                  | `account/account-nav.tsx:19`                                  |
| Orders                                          | Objednávky                                               | `account/account-nav.tsx:20`, `account/orders/page.tsx:37`    |
| Addresses                                       | Adresy                                                   | `account/account-nav.tsx:21`, `account/addresses/page.tsx:18` |
| Settings                                        | Nastavenia                                               | `account/account-nav.tsx:22`, `account/settings/page.tsx:19`  |
| Here is an overview of your account activity.   | Prehľad vášho účtu.                                      | `account/page.tsx:30`                                         |
| Recent Orders                                   | Nedávne objednávky                                       | `account/page.tsx:35`                                         |
| Default Address                                 | Predvolená adresa                                        | `account/page.tsx:62`                                         |
| Manage your saved addresses                     | Spravujte svoje uložené adresy                           | `account/addresses/page.tsx:19`                               |
| No saved addresses yet.                         | Zatiaľ nemáte uložené žiadne adresy.                     | `account/addresses/page.tsx:26`                               |
| Manage your account settings                    | Spravujte nastavenia účtu                                | `account/settings/page.tsx:20`                                |
| Load more orders                                | Načítať ďalšie objednávky                                | `account/orders/page.tsx:58`                                  |
| Order number                                    | Číslo objednávky                                         | `order-list-item.tsx:17`                                      |
| Date placed                                     | Dátum objednania                                         | `order-list-item.tsx:21`                                      |
| Payment status                                  | Stav platby                                              | `order-list-item.tsx:27`                                      |
| Total amount including delivery                 | Celková suma vrátane dopravy                             | `order-list-item.tsx:127`                                     |
| Order Timeline                                  | Priebeh objednávky                                       | `account/order-timeline.tsx:92`                               |
| Subtotal                                        | Medzisúčet                                               | `account/orders/[number]/page.tsx:106`                        |
| Shipping                                        | Doprava                                                  | `account/orders/[number]/page.tsx:112`                        |
| Shipping Address                                | Dodacia adresa                                           | `account/orders/[number]/page.tsx:141`                        |
| Billing Address                                 | Fakturačná adresa                                        | `account/orders/[number]/page.tsx:142`                        |
| Payment Method                                  | Spôsob platby                                            | `account/orders/[number]/page.tsx:146`                        |
| Edit address                                    | Upraviť adresu                                           | `account/address-form-dialog.tsx:50`                          |
| Add new address                                 | Pridať novú adresu                                       | `account/address-form-dialog.tsx:62`                          |
| Delete address                                  | Vymazať adresu                                           | `account/address-actions.tsx:43`                              |
| First name / Last name                          | Meno / Priezvisko                                        | `account/address-form-dialog.tsx:80,90`                       |
| Street address                                  | Ulica a číslo                                            | `account/address-form-dialog.tsx:112`                         |
| Postal code                                     | PSČ                                                      | `account/address-form-dialog.tsx:144`                         |
| Country code                                    | Krajina                                                  | `account/address-form-dialog.tsx:166`                         |
| Password / Current / New / Confirm new password | Heslo / Súčasné heslo / Nové heslo / Potvrdiť nové heslo | `account/change-password-form.tsx:42,69,92,117`               |
| Delete account                                  | Zrušiť účet                                              | `account/delete-account-section.tsx:45`                       |

Plus stavové texty tlačidiel: `Saving…` (Ukladáme…), `Save` (Uložiť),
`Update address` (Upraviť adresu), `Add address` (Pridať adresu), `Not set`
(Nevyplnené), `Sending…` (Odosielame…), `Yes, delete my account`
(Áno, zrušiť môj účet).

---

## Čo NEPREKLADAŤ

- `Google Tag Manager` — `app/layout.tsx:30`, je to `title` skrytého iframu, ktorý
  vyžaduje GTM. Nie je to text pre zákazníka.
- `Doprava`, `Platba`, `Kontakt` — už sú po slovensky, len nie cez i18n. Netreba
  prekladať, ale patria do prekladových súborov, keď sa budú spúšťať ďalšie trhy.
- Názvy krajín v prepínači trhu (`Slovensko`, `Deutschland`, `Polska`…) — tie majú
  zámerne ostať vo svojom jazyku.

## Otvorená otázka pre ostatné jazyky

Slovenčinu viem doplniť podľa tejto tabuľky. Zvyšných jedenásť jazykov je otázka:
momentálne **majú produkty len `/sk`**, ostatné trhy sú prázdne, takže sa dá
argumentovať, že stačí slovenčina a angličtina a zvyšok sa doplní, keď sa trh
spustí. Rozhodni, či chceš (a) len SK + EN, (b) všetkých 12 naraz.
