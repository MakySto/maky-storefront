# Lexical rich-text contract V2

Payload vracia serialized Lexical JSON. Storefront ho validuje ako celý strom a
renderuje priamo do React elementov, nie do HTML stringu.
`dangerouslySetInnerHTML` nie je súčasťou kontraktu.

## Normatívny allowlist nodes

```text
root
paragraph
text
linebreak
autolink
heading
list
listitem
link
quote
```

Tento zoznam platí pre `richText.content`, `faq.items[].answer` aj
`mediaText.content`. Prázdny podporovaný štrukturálny node môže consumer
spracovať podľa definovaného významu. Každý iný node je mimo V2; ak nesie alebo
môže niesť obsah, consumer odmietne celý kandidátny Page dokument.

Najmä tieto editorom technicky vytvoriteľné nodes nie sú vo V2 podporované:

```text
upload
relationship
horizontalrule
checklist
inlineBlock
block (Callout/VideoEmbed)
```

## Heading a text formáty

Povolené heading tagy sú iba `h2`, `h3` a `h4`; Page title zostáva jediný
`h1`. Povolené bity `text.format`:

| Bit | Formát |
| ---: | --- |
| `1` | bold |
| `2` | italic |
| `4` | strikethrough |
| `8` | underline |
| `16` | code |

Neznámy bit znamená contract violation kandidáta; nesmie sa potichu zahodiť.

## Linky

Externé `autolink` a custom `link` URL povoľujú iba protokoly:

```text
http:
https:
mailto:
```

Iný protokol je contract violation. Internal `link` nesie Payload relationship
v `fields.doc`. V2 povoľuje populované ciele `pages` a `posts`; route sa odvodí
z validovaného `relationTo` a `value.slug` s aktuálnym market prefixom.

`brands` je síce povolené aktuálnym Payload editorom, ale nie týmto Page V2
consumer kontraktom a taký obsahový link odmietne celý candidate. Podporovaný
Page/Post link s `null` alebo chýbajúcim relationship targetom nesmie vytvoriť
odhadovanú route; jeho label sa môže vykresliť ako neinteraktívny text. Neznáme
`relationTo` alebo malformed relationship wrapper sú contract violation.

## Úplná validácia pred renderom

Consumer musí pred prvým renderovaným elementom rekurzívne overiť node typ,
povinné polia, enumy, formát bity, URL protokol a relationship target. Fixture
`fixtures/rest/page-unsupported-lexical-node.sk.json` dokazuje negatívnu vetvu:
podporovaný obsah okolo `futureDisclosure` sa nesmie vykresliť samostatne.
