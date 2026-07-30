# Depth and relationship contract

## Globálny kontrakt

Kanonický Pages request používa `depth=1`. Payload pri tejto hodnote populoval
priame vzťahy Page dokumentu a jeho layout blokov o jednu úroveň:

- `hero.media`
- `hero.links[].reference`
- `image.media`
- `gallery.items[].media`
- `cta.links[].reference`
- `mediaText.media`
- `mediaText.links[].reference`
- `meta.image`
- priame upload/link relationships v serializovanom Lexical obsahu

Populovaný polymorphic link zachováva wrapper:

```text
reference.relationTo = pages | posts
reference.value = populated document
```

Null alebo odstránený cieľ sa nesmie spätne interpretovať ako bezpečná route.

## Čo depth=1 negarantuje

Vzťahy v už populovanom Post dokumente sú o ďalšiu úroveň hlbšie. Pri
globálnom `depth=1` môžu preto zostať ako ID:

- `Post.heroImage`
- `Post.author`
- `Post.categories[]`
- `Post.meta.image`
- upload/relationship nodes v `Post.content`

To nie je chyba kontraktu. Page/Post link renderer potrebuje iba bezpečne
validované route polia (`relationTo`, `slug`, prípadne `title`) priameho cieľa.
Nesmie predpokladať, že vnorený Post autor alebo media je populovaný.

Rovnako sa nemajú renderovať layout alebo ďalšie vzťahy populovanej Page ako
samostatná vnorená stránka. Relationship target slúži na odvodenie interného
odkazu, nie na rekurzívny content render.

## Per-field vyšší depth

Ak budúci consumer skutočne potrebuje vnorené Post media, autora, kategórie
alebo ďalší vzťah cieľového dokumentu, musí nový kontrakt pomenovať:

1. presné pole,
2. potrebnú úroveň,
3. maximálny response budget,
4. cycle/recursion ochranu,
5. zodpovedajúcu fixture.

Globálny Pages kontrakt sa nesmie potichu prepnúť na `depth=2`. V2 neobsahuje
žiadne pole, ktoré by pre svoj deklarovaný render vyžadovalo viac než
`depth=1`.

## Media URL

`PublicMedia` používa verejný S3 adapter s prefixom `media` a
`generateFileURL` nad `MEDIA_CDN_URL`. V contract fixtures je výsledný tvar:

```text
https://cms-media.maky.store/media/provider-v2/<filename>
```

Fixture URL a ID sú sanitizované a deterministické; nedokumentujú bucket meno,
credentials ani zákaznícke dáta. Predmetom wire kontraktu je populovaný objekt
a URL shape, nie existencia konkrétneho fixture súboru v produkčnom buckete.
