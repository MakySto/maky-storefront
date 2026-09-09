# R — hotový obsah ES/RO pre existujúci Returns V2

Použi `data/ui.es-ES.json`, `data/ui.ro-RO.json`, komponentové varianty a `formulare/`. Redakčný JSON nie je request Payloadu. Číslo podania, kanonické vyhlásenie a potvrdenie nech zostanú v existujúcom kontrakte. Nevytváraj nový systém, časový model alebo klientske hodiny.

## Minimum pri zapojení

Mapuj trh/jazyk správne: ES/es a RO/ro podľa skutočného provider kontraktu; nikdy neposielaj cudzí trh ako SK/sk. Kým provider trh neprijíma, žiadny funkčný submit na danej route; telá/metadáta použijú dodaný preview variant. Funkciu sprístupni bez nutného účtu, s kontrolou údajov pred záväzným odoslaním.

`WithdrawalCopy` nemusí obsahovať privacyHref/formExtras. Použi existujúci kompatibilný typ/mapu; dodatočné texty neprepisuj na API polia. Pripravené časové labely nemusíš vôbec vykresliť. Pri obvyklej kontrole potvrdenia skontroluj jeho obsah a dátum/čas — toto je jedna akceptačná kontrola, nie samostatný výskum.

## Správny význam stavov

Prijaté: provider prijal podanie, nie „refundácia hotová“. Chyba e-mailu: záznam existuje, ďalší pokus len na doručenie. Potvrdené neprijatie: až po dôkaze, že zápis nenastal. Neistý výsledok: ponechaj údaje a stabilné submissionId; žiadne presmerovanie na neexistujúci verejný stav prípadu. Rate limit/výpadok: dostupné alternatívy, zachované údaje; nie falošný úspech.

Štyri prepravné varianty vyberaj podľa skutočných uložených udalostí s K. `quote_requested_only` nie je `collection_offered`. Zákonná lehota sa nezastaví len preto, že zákazník čaká na cenovú ponuku. Skutočná ponuka zvozu má iný dopad na zadržanie refundácie. Žiadne automatické zrážky, zmena príjemcu peňazí či objednanie dopravy z verejného formulára.

Zákaznícky e-mail má rovnakých 11 výskytov tokenov ako vzor; interný 8. `notice_verbatim` je kanonický záznam toho, čo zákazník potvrdil, nie preklad dodatočne vygenerovaný obsluhou. Osobné údaje pri HTML renderovaní bezpečne escapovať. Stavové polia nie sú pokyn vytvoriť novú verejnú URL.

Testy v jazykovom vlákne sú offline a lokálne, bez skutočného právneho podania. R koordinuje backendové skúšky oddelene. Modelový formulár s tlačou/stiahnutím funguje nezávisle od online funkcie.
