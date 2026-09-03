# BTown Hub — editorial cover redesign

## Source
- Reference: https://www.anthropic.com/claude-fable-and-mythos-5-1
- Captured: 2026-09-03; live browser inspection, Firecrawl branding/images and full-page screenshot.
- Target: static HTML, CSS and vanilla JavaScript in `btownbrief/hub`.

## Reference screenshot
![Claude launch-page reference](design/claude-reference.png)

## Design summary
Reproduce the reference's composition closely using BTown's own photographs,
identity, copy and destinations. A quiet paper header precedes an immersive
full-viewport photographic cover, centered serif title and book-like numbered
contents. Small sky controls sit at the bottom left; photographic credit sits
at the bottom right. Below, use a restrained editorial publication rather than
the previous rounded, colorful dashboard. Do not reuse Anthropic marks, text,
proprietary fonts or artwork.

## Design tokens
- Observed reference: paper `#FAF9F5`, ink `#141413`, serif display / sans body,
  no prominent shadows, minimal corner rounding, hairline dividers.
- BTown implementation: the same paper/ink roles, muted stone `#6B6A63`, line
  `#DCDAD2`, warm subtle panel `#F0EEE7`; existing orange reserved for small accents.
- Type: Lora for display and editorial headings; Archivo normal width and
  regular/medium weights for UI. Reference uses proprietary Anthropic faces;
  Lora is a deliberate open-font approximation, not an exact match.
- Cover display: 58–72px desktop, 39–48px mobile; approximately 1.08 line height.
- Body: 16–18px, 1.6–1.75 line height. Labels 11–13px with restrained tracking.
- Header: 68px desktop / 64px mobile. Cover fills remaining small viewport height.
- Editorial container: 1040px maximum, reading copy 650px; section separation
  88–112px desktop / 56–72px mobile. Values are practical approximations.

## Components
- Header: monochrome wordmark, four quiet destinations, black split CTA/menu.
- Cover: existing `assets/img/hero.jpg`; no fade into page, no promo paragraph,
  five numbered dotted-leader anchor links, three accessible sky swatches.
- Contents rail: section anchors with active section indicated during reading.
- Live facts: editorial ruled grid, large serif values, one featured photograph.
- Questions: restrained tab-like choices and an open response with text links.
- Favorites: landscape photography, serif names, no rounded containers.
- Catalog: two-column ruled directory and book-like shelf filters, all existing
  data-backed entries and search behavior preserved.
- Signup: spacious paper section with a large serif heading and existing embed.

## Page patterns
Cover → introduction / right now → questions → favorites → complete catalog →
newsletter → footer. On mobile: compact header, accessible disclosure menu,
same cover hierarchy, single-column directory. Never hide the complete catalog
or remove destinations merely to make the screenshot cleaner.

## Motion and content
Retain existing sky / birds; add manual day, night and golden-hour preview.
Respect reduced motion and avoid scroll hijacking. BTown's existing first-person
voice stays. The cover's contents replace the explanatory lede and scroll pill.

## Agent build instructions
Keep feeds, IDs and event hooks intact. Implement presentation in `editorial.css`
after the base stylesheet. Validate header menu, sky buttons, section anchors,
question panels, search, filters, live data and narrow-screen overflow. Leave
the independent `start-here.html` and other repositories untouched.

## Rerun inputs
workflow: firecrawl-website-design-clone
source_url: https://www.anthropic.com/claude-fable-and-mythos-5-1
target_stack: static HTML / CSS / vanilla JavaScript
output: DESIGN.md
