# DE/AT — čo tento priečinok odovzdáva ďalším vláknam

Obsahové vlákno DE/AT je hotové a je v kóde. Tu leží to, čo **nepatrí do storefrontu**,
lebo to vlastní niekto iný, ale bez čoho sa DE nedá spustiť do predaja.

Zdroj všetkého nižšie je dodaný balík
`/home/ubuntu/maky-podklady/2026-09-08/rozbalene/DE_AT/MAKY_STORE_DE_AT/`.

---

## Pre vlákno Returns V2 (R)

### Texty formulára

Sú v kóde ako `src/lib/withdrawal/copy-de.ts` — typované, kompletné, **nič ich
neimportuje**. `src/lib/withdrawal/copy-de.test.ts` to stráži vrátane tripwiru, ktorý
spadne, keď ich niekto zapojí skôr, než backend trh prijme.

⚠️ Reťazce formulára sú dnes **priamo v JSX** v `withdrawal-form.tsx`. Zapojenie druhého
jazyka teda začína ich vytiahnutím do mapy. To je plocha R, preto som to neurobil —
kolidovalo by to so súbežnou prácou.

### E-mailové šablóny

| Súbor                               | Komu                                 |
| ----------------------------------- | ------------------------------------ |
| `email-eingangsbestaetigung.de.txt` | zákazníkovi — potvrdenie o prijatí   |
| `email-intern.de.txt`               | obsluhe — notifikácia o novom podaní |

DE a AT verzia sú v balíku **bajtovo identické**, preto je tu jedna.

⚠️ Obe používajú token `{{received_at_local_with_timezone}}`, **ktorý zatiaľ neexistuje**.

### Časové údaje — dva trhy, dve rôzne udalosti

|                                   | udalosť           |
| --------------------------------- | ----------------- |
| SK — § 20a ods. 5 zákona 108/2024 | čas **odoslania** |
| DE — § 356a ods. 4 BGB            | čas **prijatia**  |

Implementácia má dnes iba `submittedAt`, ktorý generuje Payload pri uložení záznamu. To
je čas zápisu — blíži sa prijatiu, ale nie je s ním totožný, a slovenskému textu
zodpovedá presne.

**Nepremenúvaj existujúce pole a nevyrábaj druhý čas v storefronte** — hodinám klienta sa
veriť nedá. Je to serverová zmena kontraktu a vlastní ju R.

### `returnMethod` — dodaná oprava nepravdivosti

Kontrakt má dnes `WithdrawalReturnMethod = "merchantPickup"` ako jedinú hodnotu, takže
prijatie odstúpenia automaticky tvrdí, že si zákazník vybral zvoz obchodníkom. Balík
dodáva znenie pre **štyri** reálne stavy — použi ich, keď sa enum rozšíri:

- **`self_shipping`** — zákazník posiela sám:

  > Sie haben keine Abholung durch uns vereinbart. Senden Sie die Ware bitte spätestens
  > innerhalb von 14 Tagen nach Ihrer Widerrufserklärung an MAKY.STORE s. r. o., Stará
  > Vajnorská 11, 831 04 Bratislava, Slowakei, zurück. Rechtzeitiges Absenden genügt. Die
  > direkte Rücksendung mit einem selbst gewählten Versanddienstleister erfordert keine
  > vorherige Genehmigung. Bewahren Sie den Versandnachweis auf.

- **`quote_requested_only`** — vyžiadal si iba cenu, čo **nie je** objednávka zvozu:

  > Sie haben ein Preisangebot für eine Abholung angefragt. Das ist noch kein
  > kostenpflichtiger Abholauftrag und für sich genommen auch noch kein Abholangebot des
  > Verkäufers. Wir teilen Ihnen Preis und Ablauf mit. Solange wir Ihnen keine Abholung
  > angeboten haben, gilt die Frist von 14 Tagen ab Ihrer Widerrufserklärung für das
  > Absenden oder Übergeben der Ware. Sie können die Ware ohne vorherige Genehmigung
  > selbst an MAKY.STORE s. r. o., Stará Vajnorská 11, 831 04 Bratislava, Slowakei,
  > senden. Warten Sie mit einer fristgerechten Rücksendung nicht allein wegen der
  > Preisanfrage.

- **`collection_offered`** — zvoz sme ponúkli my (a tým padá zádržné právo):

  > Wir haben Ihnen eine Abholung angeboten. Bitte bereiten Sie die Ware für die
  > vereinbarte Übernahme vor. Eine kostenpflichtige Abholung beauftragen wir erst nach
  > Ihrer ausdrücklichen Zustimmung zum Preis. Wenn eine Abholung von uns angeboten wurde,
  > berufen wir uns nicht auf das sonst mögliche Zurückhalten der Erstattung bis zum
  > Rückerhalt der Ware oder bis zum Nachweis ihrer Absendung. Einzelheiten zur
  > tatsächlichen Terminvereinbarung erhalten Sie gesondert.

- **`not_specified`** — nevybral nič; **toto je hodnota, ktorá dnes chýba**:
  > Sie haben noch keinen Rücktransport ausgewählt. Das ändert nichts am Eingang Ihrer
  > Widerrufserklärung. Sofern wir Ihnen keine Abholung angeboten haben, senden Sie die
  > Ware bitte spätestens innerhalb von 14 Tagen nach Ihrer Erklärung an MAKY.STORE
  > s. r. o., Stará Vajnorská 11, 831 04 Bratislava, Slowakei, zurück; rechtzeitiges
  > Absenden genügt. Sie können einen Versanddienstleister selbst wählen oder bei uns ein
  > Preisangebot für eine Abholung anfragen. Eine Anfrage allein ist kein Abholauftrag.

❌ **Nikdy neposielaj DE/AT ako `market: "SK"`.** Vyrobilo by to právny záznam
s nepravdivým trhom.

---

## Pre integračné vlákno (M) — `/o-nas`

`cmsPageRoute` má `isSlovakChannel()` na dvoch miestach
(`src/lib/cms/page-route.tsx:99` a `:121`), takže `/de/o-nas` aj `/at/o-nas` sú dnes 404.
Podľa `00-univerzalne-zadanie.md` §3.5 treba **oboje** — rozšíriť bránu **a** publikovať
dokument v Payloade. Samotný bootstrap v kóde nestačí, návštevník uvidí, čo je v CMS,
a druhý autoritatívny zdroj v kóde vzniknúť nesmie.

Text je nižšie, pripravený na vloženie. DE a AT sa líšia **iba** cieľom dvoch odkazov
(`/de/kontakt` vs `/at/kontakt`), inak sú zhodné.

**Metadáta (obe verzie rovnaké):**

- `h1` — `Über uns`
- `title` — `Über uns – Ausrüstung fürs Auto und Reisen | MAKY.STORE`
- `description` — `Dachträger, Dachboxen, Fahrradträger und Zubehör: Lernen Sie
MAKY.STORE kennen. Wir helfen Ihnen, passende Ausrüstung für Ihr Auto und Ihre Reisen
zu finden.`

**Telo:** viď `o-nas.de.md` v tomto priečinku.

---

## Čo tu zámerne NIE JE

- **Zoznam zmluvných subjektov poskytovateľov a mechanizmy prenosov mimo EHP.** Sú to
  zmluvné fakty, ktoré repozitár nevie overiť. Stránka namiesto toho odkazuje na
  `info@maky.store`, čo čl. 15 ods. 2 GDPR umožňuje.
- **Konkrétna suma priamych nákladov na vrátenie nadrozmerného tovaru.** Chýba a je to
  **predzmluvná** informačná povinnosť — musí ju dostať zákazník pred nákupom. Vlastník:
  obchodná príprava (K). Neodhaduj ju.
- **Obsah GTM kontajnera.** Je to nastavenie v GTM, nie v kóde.
