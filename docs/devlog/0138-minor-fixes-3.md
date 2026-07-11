# 0138 — Bot prefs on the account · minimap 45° · analogue button set

## 1. Bot states saved per player

The bot switches (master + per-bot) lived in device localStorage, so a
new device / evicted storage / private mode silently reset everyone to
all-on. Moved to the account-synced economy blob as an additive
`botPrefs` field (defaults all-true, `normBotPrefs` coercion, idempotent
`setBotPrefs` merge-setter). ScrapeMenu reads `getBotPrefs()` on open
and writes through the setter; a one-time migration folds any existing
localStorage prefs into the blob and deletes the legacy keys, so no
player's saved lineup resets during the transition. Prefs now follow
the account across devices under the 0016 merge guard (they are prefs,
not progress — deliberately NOT added to the progress score).

## 2. Minimap rotated 45° to match screen-relative movement

The ¾-iso camera sits 45° off the world axes, so pressing A moved the
map icon toward bottom-left. Every plotted delta (anchors, OBJ pin,
remote dots) plus the facing arrow now rotates through
`toMapX/toMapY = ((dx−dz), (dx+dz))·√½`, and the N/E/S/W compass
letters moved to their rotated positions (N upper-right etc.) so they
still point at true world directions. Wrap happens in world space
before rotation; the x/z readout stays raw. Sign derived from the field
report — flipping `MAP_ROT_R` inverts it if a camera change ever flips
the yaw.

## 3. MAIN MENU + PROTOCOLS analogue set

- Labels: pill now reads `MAIN MENU`; protocols cap is `PROTOCOLS`
  with a half-opacity `(Minigames)` banner hanging beneath.
- Layout: stair-step offsets removed on both breakpoints — the two
  buttons are one attached column (shared width/right, zero gap;
  green top / purple bottom with joined corner radii).
- Style: semi-3D worn analogue — inset bevel highlights + deep bottom
  shadow, diagonal grime scuff overlay, pressed state sinks 2px into
  an inset shadow. Appended as a cascade-winning override block so the
  older pill rules stay untouched.
