# Clinical knowledge tables

The clinical knowledge of the app as data: signs, syndromes, the links between them and to conditions, and their texts in every language. The decision behind it is ADR-016 (`docs/adr/ADR-016-tests-signs-knowledge.md`).

The physiology stays in code. A sign definition only **reads** what the models produce, so editing these tables cannot change the model. An edit can only fail validation.

## The tables

| File | One row is | Edited by |
|---|---|---|
| `signs.json` | a sign: its definition on the observables, threshold, notes, model gap | clinicians |
| `syndromes.json` | a syndrome (its members are links) | clinicians |
| `tests.json` | the teaching side of a test: references, animation (its mechanics stay in the catalog) | clinicians |
| `presentations.json` | how signs present on particular tests: the finding a card shows, with its signs and syndrome | clinicians |
| `relations.json` | a link: `variant-of`, `part-of`, `suggests`, `localises-to`, `is-a` | clinicians |
| `texts.json` | the texts of one entity in one language | clinicians, translators |
| `observables.json` | what the models produce: id, value type, codes, normal, context dimensions | **generated, read-only** |
| `schema.json` | the shape of every row, shared with a future editing backend | developers |

Each file holds one row per line, so a change shows as a one-line diff.

## A sign

```json
{"id": "ptosis", "site": "eye",
 "definition": {"obs": "eye.lid", "path": "ptosisMm", "op": "ge", "value": 2, "ctx": {"gaze": "primary"}},
 "threshold": {"text": "lid ≥ 2 mm lower than normal", "status": "assumed"}, "status": "draft"}
```

- **`definition`** is a predicate on observables (see `observables.json` for ids, fields and codes):
  - **operators:** `eq`, `ne`, `in`, `gt`, `ge`, `lt`, `le`, `has` (a list contains a code), `hasWhere` (a list contains a matching record), and `abnormal` (outside the observable's own normal);
  - **combinations:** `all`, `any`, `not`;
  - **`side`:** `any` (the default), `one` (unilateral) or `both`;
  - **`ctx`:** the context the value must be observed in. A list means "any of these, or as the patient is", so the resting vital signs never read the standing half of the lying-and-standing test.
- **Named predicates.** A pattern a threshold cannot express is written in code (`src/vp/knowledge/predicates.ts`) and named here, for example `{"fn": "nystagmusDirectionChanging"}`. A new one needs a developer.
- **`null` definition.** The sign is taught and linked, but no observable represents it yet.
- **`threshold.status`:** `measured`, `derived`, `assumed` or `standard`, as in the evidence registry. An `assumed` threshold is waiting for a reference.
- **`modelGap`:** what the model or a view cannot show yet, for a later run.
- **`normalVariant: true`:** a normal finding worth naming (end-point nystagmus).

## A presentation

```json
{"id": "inspect-eyes-1", "tests": ["inspect.eyes"], "signs": ["anisocoria", "ptosis"], "syndrome": "horner-syndrome", "status": "draft"}
```

How signs show on particular tests, in words: its `description` ("a small pupil with a slight drooping of the same lid") and `meaning` ("Horner's syndrome: …") are in the text table. "Dull", "bronchial breathing" and "increased vocal resonance" are three presentations of consolidation.

- **`tests`:** one or more. The five lung sites share one presentation.
- **`signs`:** must be elicited by those tests, as the signs' definitions say. A sign without a definition is exempt, and the presentation is what says which test would show it.
- **`accompanying`:** signs its words mention that other tests elicit ("the eye is down and out, *with ptosis*"). They are shown and linked, not claimed for this test.
- **The conditions it points to** are the `suggests` links that name it in `via`.

A test card shows its presentations, then the further signs the test can elicit, then the normal variants. A sign card gathers the sign's presentations across tests. Both are built in `src/vp/knowledge/cards.ts`; no card is written by hand.

## Links

```json
{"from": "sign:ptosis", "rel": "part-of", "to": "syndrome:horner-syndrome", "role": "required", "status": "draft"}
{"from": "syndrome:horner-syndrome", "rel": "suggests", "to": "condition:lung-cancer", "via": ["inspect-eyes-1"], "status": "draft"}
```

- **`part-of`** takes a `role`: `required`, `supporting`, `absent` (a pertinent negative), or `associated` (often seen with the syndrome but not counted towards it: fever with sepsis). A syndrome is present when every required sign is, no absent sign is, and, without a required sign, at least two supporting signs are.
- **A condition is a cause.** A syndrome, a state (thyrotoxicosis) or a laboratory finding (hyperkalaemia) is not a `condition:`, even when a learner can commit to it: the diagnosis list (`src/vp/data/diagnoses.ts`) gives such entries a `kind`, a syndrome or state is the syndrome of the same id here, and it `suggests` its causes. The validator refuses a `condition:` link to one.
- **`suggests`** names in `via` the presentations that assert it. It may list `exceptions`: cases with that condition that do not show the sign, each with `kind` (`model` when the model cannot produce it yet, `case` when this patient rightly lacks it) and `why`.
- **`is-a`** relates conditions (`peptic-ulcer-bleed` is an `upper-gi-bleed`). A sign that suggests the broader condition also reaches the narrower one.
- **Conditions and structures** are the diagnosis and structure ids of the catalog (`src/vp/data/`).

## Texts

```json
{"entity": "test:inspect.eyes", "locale": "de", "fields": {"assesses": "…", "how.1": "…", "how.2": "…", "normal": "…"}}
```

One row per entity and language. The fields are:

- `label` for signs and syndromes;
- `description` and `meaning` for presentations;
- `assesses`, `normal`, `how.N`, `pitfall.N` and `alias.N` for tests.

Numbered lists must have the same length in every language (aliases excepted). Adding a language means adding rows.

## What is derived, never written

These are computed by `src/vp/knowledge/`:

- which tests elicit a sign;
- which cases show it;
- where the app presents it;
- everything a sign leads to (`explore`), and everything that leads to a condition (`signsForCondition`).

## Checks

`npm test` (the virtual-patient suite) does four things:

1. **Validates the tables:** schema, links, kinds, codes, fields, contexts, both languages.
2. **Checks that `observables.json` is current.**
3. **Reads every case for every sign.**
4. **Checks each `suggests` link against the cases:** the sign must show, or the link must list an exception.

After changing a property in the catalog, run `npm run knowledge:observables`. To see the coverage, run `npm run knowledge:report`; it writes `docs/knowledge-coverage.md`.
