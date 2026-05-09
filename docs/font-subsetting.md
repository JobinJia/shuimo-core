# Subsetting a stamp font

Loading a 2-8 MB CJK seal font is the single biggest performance cost for stamp
generation. Subsetting it to just the characters you need typically cuts the
payload to a few KB, with no visual change.

## When to subset

- You have a fixed set of stamp captions (signatures, gallery labels, etc.) → subset to ~10-50 chars.
- You let users type free text → subset to common-CJK (~3000 chars, ~200-400 KB woff2).

## How

This repo ships two scripts under `packages/core/scripts/`:

- `audit-stamp-chars.mts` — scans the codebase for unique CJK chars. Useful as a starting set.
- `subset-font.mts` — feeds those chars (or any string) plus a source font into harfbuzz-subset (via the `subset-font` npm package), outputting a woff2.

Pre-wired pipeline (used by the playground):

```bash
pnpm --filter @jobinjia/shuimo-core run subset:demo
```

Manual one-off:

```bash
echo "落梅听风雪兰水墨" | npx tsx packages/core/scripts/subset-font.mts \
  ./input.ttf @/dev/stdin ./output.woff2
```

The script accepts any of: TTF, OTF, WOFF, or WOFF2 as input, and always emits WOFF2.

## Numbers (this repo's playground)

| Font                                    | Size    |
| --------------------------------------- | ------- |
| `yishanbeizhuanti.ttf`                  | 2.2 MB  |
| `yishanbeizhuanti.demo.woff2` (441 chars over-collected) | 135 KB |

That's ~17× smaller, with no visual change. fontkit parse time scales roughly proportionally.

## Caveats

- The included `audit-stamp-chars.mts` over-collects on purpose — it grabs every CJK char it sees in `.vue` / `.ts` / `.json` files (skipping auto-generated `*-font-metrics.ts`). That's safer than under-collecting and rendering `□` boxes for one missed character.
- If you want a tighter subset, write a custom audit that only matches `text:` props on stamp components.
- The audit regex covers CJK Unified, Extension A, Compatibility, and Extensions B-F. Add Hiragana / Bopomofo etc. if your project needs them.
