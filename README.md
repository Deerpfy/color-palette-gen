# Palette Generator

A tiny, offline color palette generator. Pick a base color and a harmony rule,
and the tool derives a set of related colors as swatches you can copy and
export. It is one focused tool: no accounts, no settings sprawl, no tracking.

## What it does

- Base color input: a native color picker plus an editable hex text field, kept
  in sync both ways.
- Randomize: rolls a fresh, pleasant base color.
- Harmony rules: derives swatches from the base color using HSL math.
- Swatch strip: each swatch always shows its HEX value, and its RGB and HSL
  values on demand.
- Per-swatch copy: click a swatch to copy its HEX to the clipboard, with a brief
  visual confirmation.
- Copy all: copies the whole palette as a comma-separated list of HEX values.
- Export: downloads the palette as a JSON file (an array of hex, rgb, hsl) or as
  a CSS snippet of custom properties.
- A live swatch count that updates as the base color or harmony changes.

## How to run

There is no build step and no server. Just open the file:

    Open palette-generator/index.html in any modern browser.

You can double-click the file, or drag it onto a browser window. It runs from a
local file path (file://) and makes no network requests at any time.

## Harmony rules

- Complementary - the base hue paired with its opposite (2 swatches).
- Analogous - five neighbouring hues for a calm, related blend (5 swatches).
- Triadic - three hues evenly spaced around the wheel (3 swatches).
- Tetradic - four hues forming a balanced square (4 swatches).
- Monochromatic - one hue across a range of light and dark (5 swatches).
- Shades - a single hue stepped from light to dark (6 swatches).

The light and dark ranges are clamped so that swatches stay distinct even when
the base color is almost black or almost white.

## Copying and exporting

- Click any swatch (or focus it and press Enter or Space) to copy its HEX.
- Use Copy all to copy every HEX value as a comma-separated list.
- Use JSON to download palette.json, an array of objects with hex, rgb, and hsl.
- Use CSS to download palette.css, a :root block of --color-1, --color-2, and so
  on.

Clipboard note: in a few browsers the asynchronous Clipboard API is not
available on file:// pages. The tool detects this and falls back to a
synchronous copy method, so copying still works either way.

## Offline and privacy

The tool is fully offline. There are no external scripts, fonts, styles, or
images, and no analytics. Everything runs in your browser from local files.
Exports are created in-memory using a Blob and an object URL, with no upload.

## Accessibility

- Keyboard operable throughout, with a visible focus indicator on every control.
- A skip-to-content link, semantic landmarks, and labeled controls.
- HEX values shown over a swatch use black or white text, whichever gives the
  higher contrast against that color.
- Comfortable touch targets and a responsive layout with no horizontal overflow
  on small screens.

## File layout

    palette-generator/
      index.html
      assets/
        css/
          style.css
        js/
          tool.js
      README.md

## Design notes

The visual system follows an Apple-style, refined-minimal direction: generous
whitespace, a single blue accent, hairline borders instead of shadows, and
monospaced, tabular figures for the color readouts. A system font stack is used
on purpose - the tool must run offline with no network, so no web font can be
fetched, and on Apple hardware the system stack renders as San Francisco.
