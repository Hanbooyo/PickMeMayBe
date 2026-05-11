# PickMeMaybe

PickMeMaybe is an AI-directed raffle presentation platform.

The MVP starts with an Excel roster and prepared participant face resources. It
matches participants to images, runs a fair raffle, and renders a landscape
broadcast-style winner reveal.

## MVP Direction

- Input: Excel roster with name, email, department, applied asset, and submitted time.
- Visual assets: prepared participant images, matched by name first.
- Duplicate names: resolve by email.
- Missing images: use an anonymous placeholder.
- First presentation mode: election-broadcast-inspired winner reveal.
- Output: 16:9 video first.
- Raffle principle: the result is decided fairly before the presentation is generated.

## Workspace Layout

```text
apps/
  web/
  api/
  renderer/

packages/
  shared/
  raffle-engine/
  roster-import/
  asset-matcher/
  presentation-engine/
  render-types/
```
