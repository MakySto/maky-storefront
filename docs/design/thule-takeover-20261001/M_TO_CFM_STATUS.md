# M → CFM: stav storefrontu pre aktiváciu Thule

Súbor sa dopĺňa po každom míľniku, najnovší je dole. Živý dôkaz z bežiaceho procesu je vždy
`curl https://maky.store/api/fitment/status` (verejné, bez tajomstva, `Cache-Control: no-store`) —
CFM ho môže čítať samo, nikto nemusí nič prenášať.

## 1. 2026-10-01 21:30 UTC — R0+R1 nasadené, dataset `.2` načítaný bežiacim procesom

```
M_DATASET_CONFIRMED=394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9
```

|                  |                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| nasadený release | `fab2985ab1d7df8703e53a6ff05df9b965dc8701` (R0 + R1), BUILD_ID `F2fH6eFtARQRLHD7LGRR9`, postavený 2026-10-01 21:23:35 UTC            |
| dataset          | `3.0.0-full-20261001.2`, `datasetHash` **prepočítaný procesom** `394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9`   |
| bajty súboru     | 15 915 111, `transportSha256` `befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1`                                     |
| obsah            | 70 značiek, 691 modelov, 1 108 generácií, 2 566 aplikácií                                                                            |
| načítaný         | 2026-10-01 21:29:58 UTC pri štarte procesu za 537 ms, riadok `[fitment] loaded 3.0.0-full-20261001.2 394346c9… (15915111 B, 537 ms)` |
| platnosť         | `stale: false`, zastará 2026-10-31 17:48 UTC                                                                                         |
| viditeľnosť      | 0 z 9 140 skrytých sád je viditeľných anonymnému návštevníkovi (kontrola tesne pred zverejnením), 10 pilotov verejných, 71743 skrytá |
| štartovanie      | jeden proces PM2 `maky-storefront`, zahriate `/sk`, `/sk/stresne-nosice`, `/sk/konfigurator`, `/sk/categories/thule-stresne-nosice`  |

`M_DATASET_CONFIRMED` je hodnota pre `M_DATASET_CONFIRMED=… bash run_activation.sh`
(balík `activate_sk1001_807262b7`, iba `sk-eur`). Po bloku 1 (250 sád) runner zastaví.

**Čo urobí M samo po aktivácii bloku 1** (CFM nemusí nič hlásiť, M číta Saleor anonymne a vie, kedy je blok 1 verejný a kedy
runner zastavil): vyčistí cache cez `/api/revalidate`, spustí skorý test na skutočných produktoch bloku 1, prejde v prehliadači
výber auta → produkt → košík (bez objednávky a platby), overí nesprávny rok a strechu a Nordrive. Výsledok sa zapíše sem.
`EARLY_TEST_OK=1` je podmienené iba týmto výsledkom, nie ďalším potvrdením od Mareka.
