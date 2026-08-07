# Unsupported content policy

V2 preberá normatívne fail-closed pravidlo opravené vo V1:

```text
unsupported content-bearing Page block or Lexical node
  -> reject the complete candidate CMS document

inert marker explicitly supported by the contract
  -> may render
```

Consumer najprv validuje celý market-filtered candidate a až potom začne
renderovať. Nesmie vykresliť podporovaný obsah pred/za nepodporovaným obsahovým
prvkom, pretože by zákazníkovi ukázal významovo neúplný dokument.

Fixtures:

- `page-unsupported-block-between-supported.sk.json` vloží obsahový
  `futureEditorial` medzi dva podporované bloky;
- `page-unsupported-lexical-node.sk.json` vloží obsahový
  `futureDisclosure` medzi podporované Lexical odseky.

Oba fixtures očakávajú odmietnutie celého `docs[0]`, structured error a
consumerom dohodnutý durable fallback. Renderer nesmie spadnúť a
nepodporovaný obsah nesmie zapisovať celý do logov.

Normatívny allowlist je v `lexical-richtext-contract.md`. Prázdny podporovaný
štrukturálny node môže consumer bezpečne spracovať podľa svojho definovaného
významu. Neznámy node sa nesmie automaticky považovať za inertný len preto, že
nemá známe textové pole.
