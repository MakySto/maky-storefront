# R — lokalizácia existujúceho Returns V2 pre IT/FR

**Žiadne nové podanie, endpoint, CMS kolekcia ani provider schema.** Posledný načítaný kontrakt je SK/sk s returnMethod merchantPickup. Jeho rozšírenie riadi R. Redakčné názvy v JSON nie sú povolenie zmeniť prísny serverový allowlist.

## Zdroje a mapovanie

`data/ui.*.json` má rovnakú množinu kľúčov ako úplný schválený PL/HU zdroj. Existujúci `WithdrawalCopy` na PL/HU SHA nemusí reprezentovať všetky formExtras ani e-maily: existujúcu štruktúru nepremenuj naslepo. Zmapuj každé použité pole na skutočný komponent alebo označ PREPARED_NOT_WIRED. `contractReference` je redakčný názov zrozumiteľného vstupu; nie nový wire kľúč. `declarationWhole/Partial` sú pripravené formulácie; serverová kanonická customerStatement musí byť deterministická, zhodná s review a uloženým noticeSnapshot. To vlastní R.

`receivedTimeLabel` ostáva dormant, kým R nemá preukázaný samostatný čas. `submitted_at_local_with_timezone` je zachovaný token šablóny, NIE dôkaz významu dnešného serverového submittedAt. R musí doložiť okamih udalosti a zdroj hodín. Nikdy neskopíruj submittedAt do vymysleného receivedAt. IT/FR potvrdenia vyžadujú obsah a dátum/čas odoslania; pred finálnym zapojením over rozdiel medzi odoslaním, prijatím a persistenciou.

## Sémantika stavov

Accepted až pri preukázanom prijatí; neúspešný e-mail neanuluje prijaté podanie. Text o opakovanom odoslaní e-mailu a tlač/sťahovanie použiť až keď to backend naozaj vie. ConfirmedNoWrite je iba pre potvrdené nezapísanie. Timeout/503/strata odpovede sú UNKNOWN, nie automaticky failure. Pri retry toho istého logického podania zachovať identifikátor, nie generovať duplicitné právne podanie. Zákazník má vždy pravdivú e-mailovú/poštovú alternatívu a nemá čakať do uplynutia lehoty.

`formExtras.invalidLink` je pripravený text existujúceho spôsobu doručenia/kópie iba ak taký kontrakt existuje. Nie zadanie vytvoriť nový verejný status portál. UnknownBody žiadny portál nesľubuje. Pri guest režime nepridávaj povinné prihlásenie. Telefón, dôvod, fotky a IBAN nesmú byť všeobecná podmienka podania.

## Potvrdenia

Zákaznícky e-mail obsahuje presnú kópiu oznámenia, identifikáciu zmluvy/rozsah, čas s časovým pásmom a skutočný dopravný stav. Tokeny v oboch jazykových e-mailoch zachovať doslova aj s výskytmi, vrátane `{{notice_verbatim}}`, `{{receipt_id}}` a `{{submitted_at_local_with_timezone}}`. Prázdne nepovinné odseky sa nemajú renderovať ako tokeny. HTML renderer musí hodnoty escapovať; notice môže zostať obsahovo presný bez spustiteľného HTML. Interný admin link musí smerovať do existujúceho autentifikovaného rozhrania, bez vkladania tajomstiev.

Súbory `pokyny-podla-zvozu.*.json` obsahujú štyri redakčné stavy: self_shipping, quote_requested_only, collection_offered, not_specified. Mapovanie na reálne uložené udalosti vlastní R s K. Záujem o cenu nie je objednávka plateného zvozu, ponuka obchodníka ani uskutočnený transport. Prijatie odstúpenia nie je rozhodnutie o refundácii. OfferedCollection mení možnosť pozdržať refundáciu: nesmie sa odvodiť len zo zaškrtnutia klienta.

## Ovládanie a vydanie

IT: Recedere dal contratto qui / Conferma recesso. FR: Renoncer au contrat ici / Confirmer la rétractation. Zdroje v právnych deltách. Bezprostredná dostupnosť počas lehoty, review pred potvrdením a trvanlivé potvrdenie nie sú iba preklady tlačidiel.

R/M musia zapojiť capability pre konkrétny market+locale do routy, VOP, navigácie a metadát. Zohľadni build-time cache. Testy iba na izolovanom prostredí so sinkom a explicitným oprávnením, bez živého právneho podania. Pred obsluhovaním reálnych nákupov over právnu dostupnosť funkcie; noindex túto úlohu nerieši.
