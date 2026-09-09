# R — US/CA bez paralelného systému

Použi existujúci Returns V2 a kanonické záznamy. Balík nič nemení v API. `data/ui.*.json` zachováva kľúče predchádzajúcich balíkov; `privacyHref` a `formExtras` sú redakčný vstup, nie pokyn rozšíriť kontrakt naslepo.

## Jediná významná odlišnosť od ES/RO

Bežný US/CA zvoz NEponúkame. `data/form-capabilities.*.json` je redakčné pravidlo, nie runtime konfigurácia. `showPickupInterest=false`: rovnomenný existujúci textový kľúč je ponechaný kvôli kompatibilite, ale nesmie sa vykresliť ako dostupná ponuka. V aktuálnom SK kontrakte je `returnMethod: merchantPickup`; **neposielaj vlastné odoslanie pod týmto označením**. R upraví existujúci proces koordinovane, alebo online podanie zostane neaktívne a text ukáže pravdivý alternatívny spôsob. Nesmie vznikať druhý Returns endpoint.

Štyri stavy v `formulare/pokyny-podla-zvozu.*.json` sú redakčné varianty, nie nové API enumy. `quote_requested_only` nesľubuje cenovú ponuku zvozu; vysvetľuje, že otázka nie je ponuka ani objednávka. `collection_offered` sa použije len po skutočnej individuálnej ponuke. Neponúka službu plošne.

Vady a osobitné zákonné zrušenie (napr. Québec) majú samostatný nákladový režim. Nič v balíku neschvaľuje refundáciu, zásielku ani živé testové podanie.

## Potvrdenie a stavy

Čas je bežná integračná kontrola potvrdenia. Žiadny nový časový model, žiadny výskum milisekúnd, žiadne kopírovanie jedného poľa do druhého. Akceptovaná správa smie tvrdiť len skutočne prijatý záznam; nejasný transport nie je potvrdené zlyhanie ani úspech. Zachovať idempotenciu a neodkazovať na neexistujúci zákaznícky portál.

E-maily sú úplné: `formulare/email-potvrdenie-odstupenia.*.txt`, `email-pre-obsluhu.*.txt`. Tokeny ostali zo zdroja. Hodnoty escapovať, kanonický obsah správy nemení UI samostatne. `pickup_interest_human_readable` môže byť „Not offered for this market“, nie automatické áno. Interný autorizačný link sa nesmie ocitnúť v zákazníckom e-maile.

Aktívna / neaktívna / výpadková próza a meta sú v `data/component-copy.*.json`; zapnúť ich koordinovane s reálnou funkciou, nie globálnym flagom pre SK. Pri výpadku nestratiť alternatívny kontakt. Bez konta a bez povinnej marketingovej alebo nepotrebnej údajovej autorizácie.
