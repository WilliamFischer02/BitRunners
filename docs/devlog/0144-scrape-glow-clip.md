# 0144 — Clip the SCRAPE press glow to its stage (P0)

The `.scrape-glow` flourish is a fixed 320×200 absolutely-positioned
sibling of the SCRAPE button, centered on `.scrape-stage`. The stage is
`position: relative` but had no overflow rule, so on narrow panels the
glow's circuit-trace grid painted straight over the section borders and
neighbouring UI.

Fix: `overflow: hidden` on the press-flourish `.scrape-stage` block
(style.css). The glow stays fully visible *inside* the stage (it is
centered and the stage is its containing block) and simply stops
bleeding past the section edge. `.panel-section` has square corners
(no border-radius), so no radius matching was needed.

Verified by inspection: `is-holding`, `is-auto` (650 ms pulse,
max scale 1.03 — still inside the clip), `is-on` press flash, and the
reduced-motion overrides are all opacity/transform-only on the same
element; clipping does not change their behaviour. The `.scrape-gain`
floating number is positioned inside the stage (top: 6px) and is
unaffected.

Owner verify: open data_scrape on a phone-width viewport, hold SCRAPE,
toggle auto — glow grid should stay within the button's section.
