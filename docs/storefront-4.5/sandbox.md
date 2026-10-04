# Sandbox · lokálny Saleor, storefront a producent CFM

Neplatené, izolované testovacie prostredie na jednom stroji. Slúži na to, aby sa výstup CFM, zápis a čítanie v Saleore a storefront dali skúšať spolu bez dotyku produkcie. Vzniklo pri CoolZ pilote (4. 10. 2026) a dá sa postaviť od nuly podľa tohto návodu.

## Čo to je a čo nie

- Lokálny Saleor 3.23.31 zostavený zo zdroja (tag `3.23.31`, commit `a1ab3a23a3f5711bb74abb3a2972cf28454cb59e`) nad PostgreSQL 16 v Dockeri, storefront z tejto vetvy a producent CFM spustený bez databázy a bez siete.
- Nič z toho nevedie do produkcie. Skripty v `scripts/sandbox/` odmietnu adresu, ktorá nie je na tomto stroji, prihlasujú sa účtom sandboxu (nikdy tokenom z prostredia) a druhé spustenie nič nezdvojí.
- Obsahuje päť CoolZ (TK20409 až TK20413) v kanáli `sk-eur`, kategóriu, typ produktu, výrobcu Pro-USER, dopravu „Kuriér“ za 4,90 € a sklad 25 ks na model. Ceny sú katalógové hodnoty z návrhu, v sandboxe iba skúšobné.
- Keď je v adresári popisov aj `gallery.description.json`, pribudne šiesty produkt „Ukážka blokov popisu (len sandbox)“ (SKU `SANDBOX-GALLERY`): vymyslená galéria všetkých rolí a ikon typovaného popisu, nie produkt.
- Päť CoolZ má 25 atribútov autochladničky (`scripts/sandbox/coolz-attributes.mjs`). Kľúče (`cfm:attribute:<kľúč>`), typy vstupu a čísla sú to, čo CFM zapisuje a čo je v onboarding manifeste. **Zobrazované názvy a textové hodnoty sú predpoklad**, napísaný po slovensky ručne; skutočné produkčné riadky sa nečítali.
- Nemá fotografie produktov (médiá z prostredia nejdú), Payload CMS ani platobnú bránu. CMS nahrádza prázdna atrapa, platba chýba.
- Nie je dôkazom, že produkčný Saleor prijme blok `table`. To uzatvára bezzápisová kontrola na produkčnej inštancii (`docs/contracts/comparison-table.md`).

## Predpoklady

Docker, `uv`, Python 3.12, Node 22, pnpm 10.28.1, Chromium (snímky cez Playwright). Sieť prostredia pustí `github.com`, `pypi.org`, `registry.npmjs.org` a Docker Hub; obraz `ghcr.io/saleor/saleor` sa stiahnuť nedá (blobový host ghcr je zablokovaný), preto Saleor zo zdroja. Docker démon sa tu sám nespustí:

```bash
dockerd --host=unix:///var/run/docker.sock --iptables=false --ip6tables=false --bridge=none &
```

## Postup

**1. PostgreSQL.** `fsync=off` je v poriadku, databáza je na jedno použitie.

```bash
docker run -d --name saleor-pg --network host \
  -e POSTGRES_USER=saleor -e POSTGRES_PASSWORD=<heslo-sandboxu> -e POSTGRES_DB=saleor \
  -v /tmp/saleor-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine -c fsync=off -c shared_buffers=256MB -c max_connections=100
```

**2. Saleor 3.23.31.** Heslá a kľúč si vymysli, nepatria do Gitu ani do chatu.

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --branch 3.23.31 https://github.com/saleor/saleor
cd saleor && uv sync --frozen --python /usr/bin/python3.12
cat > saleor.env <<'EOF'
DATABASE_URL=postgres://saleor:<heslo-sandboxu>@localhost:5432/saleor
SECRET_KEY=<lubovolny-retazec-iba-pre-sandbox>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
ALLOWED_CLIENT_HOSTS=localhost,127.0.0.1
PUBLIC_URL=http://localhost:8000
DEFAULT_COUNTRY=SK
DEFAULT_CURRENCY=EUR
DEFAULT_FROM_EMAIL=sandbox@example.invalid
EMAIL_URL=consolemail://
ENABLE_ACCOUNT_CONFIRMATION_BY_EMAIL=False
PLAYGROUND_ENABLED=True
EOF
set -a; . ./saleor.env; set +a
uv run --frozen python manage.py migrate
uv run --frozen python manage.py shell -c "
from saleor.account.models import User
u, _ = User.objects.get_or_create(email='sandbox-admin@example.invalid')
u.is_staff = u.is_superuser = u.is_active = True
u.set_password('<heslo-sandboxu-admina>')
u.save()"
uv run --frozen uvicorn saleor.asgi:application --host 127.0.0.1 --port 8000 --log-level warning &
```

Migrácie sami založia sklad „Default Warehouse“, dopravnú zónu „Default“ a kanál `default-channel` (USD); kanál `sk-eur` pridá seed.

**3. Storefront.** `.env.local` je v `.gitignore`; hodnoty pre CMS sú zjavné atrapy, nie prístupy.

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SALEOR_API_URL=http://127.0.0.1:8000/graphql/
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_CHANNEL=sk-eur
MAKY_LIVE_MARKETS=sk
PAYLOAD_CMS_URL=http://127.0.0.1:8100
PAYLOAD_CF_ACCESS_CLIENT_ID=sandbox-not-a-secret
PAYLOAD_CF_ACCESS_CLIENT_SECRET=sandbox-not-a-secret
EOF
pnpm install --frozen-lockfile
pnpm run generate:all        # čerpá schému zo sandbox Saleoru, ten už musí bežať
```

**4. Producent CFM a naplnenie.** Producent beží v hermetických nastaveniach `config.settings.test_writers` (SQLite v pamäti, bez Redisu a Saleoru); nikdy s nastaveniami, ktoré mieria na produkčnú databázu.

```bash
cd CarFitManager-4/backend
python scripts/storefront_comparison_sample.py --out /tmp/coolz-sample   # päť popisov presne tak, ako ich posiela CFM dnes (zoznam, bez šablóny)
python scripts/storefront_maky_content_sample.py --out /tmp/coolz-typed  # päť typovaných popisov šablóny autochladničky + galéria

cd maky-storefront
export NEXT_PUBLIC_SALEOR_API_URL=http://127.0.0.1:8000/graphql/
SANDBOX_STAFF_EMAIL=sandbox-admin@example.invalid SANDBOX_STAFF_PASSWORD=<heslo-sandboxu-admina> \
  node scripts/sandbox/seed-coolz.mjs --descriptions /tmp/coolz-sample
```

Typovaný popis sa zapíše rovnako, z druhého adresára (`--descriptions /tmp/coolz-typed`); seed popis existujúcich produktov prepíše, takže ten istý sandbox ukáže „pred“ aj „po“.

**5. Beh storefrontu.**

- Vývoj: `pnpm exec next dev -p 3000` (Turbopack, to isté ako `pnpm dev:turbopack`). `pnpm dev` beží s `--webpack` a v tomto prostredí padá na `node:crypto`; nie je to zmena z CoolZ pilotu.
- Produkčný režim: `node scripts/sandbox/cms-empty.mjs &`, potom `pnpm run build` a `pnpm exec next start -p 3000`. Build bez CMS padne zámerne (chýbajúce CMS je chyba, nie prázdna stránka), preto atrapa.
- Okružná kontrola, bez zápisu: `node scripts/sandbox/roundtrip-coolz.mjs --descriptions /tmp/coolz-sample` (alebo `/tmp/coolz-typed`). Pre každý model porovná to, čo poslal producent, s tým, čo Saleor vráti pri novom čítaní (bloky, `id` a `version` rovnaké; jediný rozdiel, ktorý toleruje, je `rel="noopener noreferrer"`, ktoré Saleor pridá k odkazom), a s tým, čo storefront nakreslí (jedna tabuľka, zvýraznený správny model, názvy modelov, riadkov a častí; pri typovanom popise aj každý značkovaný blok nakreslený ako jeho rola, presne toľkokrát, koľkokrát ho producent poslal).
- `next dev` si pri štarte dopíše blok „nextjs-agent-rules“ do `AGENTS.md`. Nie je to zmena zadania; do commitu nepatrí (`git checkout -- AGENTS.md`).
- Stránka produktu v dev režime beží na `/sk/<slug>` (napr. `/sk/kompresorova-autochladnicka-pro-user-coolz-32-l-tk20410`). Prvé vykreslenie trvá pár sekúnd; chyby čítačky typovaného popisu idú do konzoly servera ako `[maky-content] …`.

## Nákupný priechod

Vyskúšané 4. 10. 2026 na produkčnom builde (`next build` a `next start`) v Chromiu, desktop 1440 × 900 a mobil 390 × 844:

1. stránka CoolZ 32, „Pridať do košíka“,
2. košík: jedna položka, 279,00 €,
3. pokladňa, krok 1: kontakt a dodacia adresa vymysleného kupujúceho (`sandbox-buyer@example.invalid`),
4. krok 2: doprava Kuriér, 1 až 3 pracovné dni, 4,90 €, celkom 283,90 €,
5. krok 3: „Platba je momentálne nedostupná“, lebo sandbox nemá platobnú aplikáciu.

Objednávka sa nevytvorila a vytvoriť sa tu nedá. Neskúšané ostáva: platba a dokončenie objednávky, e-maily o objednávke, prihlásený zákazník, zľavové kódy. Platobná brána je nová služba, preto sa nepridávala; ak sa má skúšať dokončenie, treba o nej rozhodnúť osobitne.

V režime `next dev` (Turbopack) pokladňa padá na `createContext only works in Client Components` v generovanom checkout kóde (`src/checkout/graphql/generated/index.ts` importuje `urql` zo serverového modulu). Súbory pokladne tento pilot nemení a produkčný build túto chybu nemá, takže ide o vývojový režim.

## Čo sandbox nedokazuje

- že produkčný Saleor prijme `table` ani typovaný popis (bezzápisová kontrola na produkcii, viď `docs/contracts/comparison-table.md` a `docs/contracts/maky-content.md`),
- ako vyzerá živá stránka autochladničky: názvy a textové hodnoty atribútov sú predpoklad (viď vyššie), takže zoskupenie parametrov a pás kľúčových faktov sa tu ukazuje na vymyslených hodnotách,
- ako sa blok správa po uložení v Saleor Dashboarde,
- preklady popisov do ostatných jazykov,
- obsah a obrázky z Payload CMS, fotografie produktov, platby.

## Známa slabina, ktorú sandbox odhalil

Produkčný build s katalógom bez jediného výrobcu padá: `src/lib/brands/catalog.ts` zostaví dotaz `BrandCounts` s nulou položiek (`query BrandCounts { }`), Saleor ho odmietne a prerender stránok účtu a domovskej stránky zlyhá. V produkcii výrobcovia sú, preto sa to tam neprejaví. Sandbox preto dostane výrobcu Pro-USER (seed ho zakladá). Oprava v kóde (vrátiť prázdny zoznam, keď nie je koho spočítať) nie je súčasťou CoolZ pilotu.

## Upratanie

```bash
docker rm -f saleor-pg && rm -rf /tmp/saleor-pgdata
# zastaviť uvicorn (8000), next (3000) a cms-empty (8100); zmazať /tmp/coolz-sample a .env.local
```
