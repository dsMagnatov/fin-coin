# Money Talks

Responsive financial education landing page built with Vite and Three.js,
with procedural 3D glass coins and an iridescent studio material.
The page contains the hero, a scrolling text section with inline coins,
the monthly budget screen, and a scratch-to-reveal newsletter screen.

## Run

Use Node.js 24.12 or later and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` produces `dist/`;
`pnpm preview` serves the production build. `pnpm test` checks the coin physics,
hero loop recycling and spacing, text reveal and inline coin activation,
scratch coverage without double-counting repeated strokes, and the reversible
coin route, docking coordinates, desktop and mobile resizing, and nearest-coin selection.

Instrument Serif and Manrope are served locally from `public/fonts/`.
Their OFL licenses are included in that directory.

The composition fills the desktop viewport. Type and controls scale together
relative to a 1920 × 1080 design canvas; additional height expands the coin area.
Navigation and the Instrument Serif wordmark are fixed at the top throughout
scrolling, and the hero is anchored to the bottom without letterboxing.

At widths of 900 pixels or less, phones and tablets use a separate responsive
layout. A 44-pixel menu button opens the navigation; selecting an item,
clicking outside, or pressing Escape closes it. The hero uses smaller coins
above the heading, the pinned paragraph fits the available height, the budget
stacks into one column, and the newsletter form stacks its controls. Coin
diameters and dock positions are measured from the rendered layout, including
after orientation changes. Vertical touch gestures over the hero and budget
coins keep page scrolling available; dragging horizontally turns the coins.

Six original bevelled coin meshes use real-time HDR studio reflections,
transmission, dispersion, and thin-film iridescence. The meshes and studio
environment are generated locally; no external models or HDR assets are needed.
Every screen uses the same HDR studio, directional lights, exposure, and
coin material. Different viewing angles reveal the same glass finish.

The hero and budget scenes share one coin diameter: approximately 601 design pixels
at 1920 × 1080.
Each camera uses the same pixel-to-world scale. The hero loop expands as
needed to keep the larger coins spaced apart.
Brush a coin with the pointer
or drag it to rotate it, with damped angular inertia after release. Each coin
stays on its predetermined path; pointer input never displaces it or its
neighbors. Coins travel from right to left through the space above the
heading, make a full turn during each pass, and loop only after fully
leaving the screen. A common loop length preserves spacing between coins.
Autonomous movement respects reduced-motion
preferences and pauses while the tab is hidden. A lightweight fallback
preserves the layout if WebGL is unavailable.

Menu items and Explore are intentional placeholders.

A large Instrument Serif paragraph sits between the hero and the budget.
It remains in view while scrolling progressively reveals its words from
dark gray to white. Two glass coins sit inside the text lines, at 84 design
pixels on desktop and scaled with the paragraph on mobile.
Each stays still until the reveal passes its own position, then makes a
smooth full turn over 1.6 seconds and continues at one turn per 48 seconds.
Reverse scrolling freezes each coin as its text position dims; returning
to that position activates it again from the frozen pose. Hidden and
offscreen coins pause, and reduced motion keeps the inline coins static.

The budget screen presents an illustrative monthly budget:
$5,000 after-tax income, $3,500 spending (70%), $1,000 savings (20%), and
$500 available. Segmented neon bars show the allocation. The selected
coin from the hero rotates in place once every 48 seconds with the same glass material.
Move the pointer over the coin or drag to turn it in place, with the same
angular inertia as the first screen. Manual rotation also works with reduced
motion enabled. The screens scale together on desktop. The mobile route lands
when the center coin enters the viewport and departs while it is still visible,
so the taller budget column does not lose the travelling coin. Scroll normally between them;
offscreen animation pauses, and the central coin respects reduced motion.

The final screen conceals a newsletter subscription form under a scratch-off layer.
Drag the arriving glass coin across the gray coating to leave narrow,
irregular scratches. The coin follows with a slight lag and tilts with the
direction of movement. Touch dragging works across the coating, with a smaller
mobile brush. Scratches are stored relative to the card and persist across
resizing and orientation changes; the revealed form permits normal scrolling.
After at least 72% of the coating is removed, releasing the coin clears the
remaining coating and focuses the email field. Enter or Space on the coin
reveals the form directly for keyboard access. Reduced motion removes the lag
and animated tilt; offscreen and hidden animation pauses.

The newsletter form validates email syntax but is a frontend prototype.
It is not connected to a mailing provider and does not send or store addresses.
Submitting a valid address shows an honest status explaining that sign-ups
are not open yet.

One hero coin travels through all four screens. At the first scroll,
the visible coin nearest the viewport center leaves the hero scene. Its actual
mesh and material move into one transparent fixed canvas, without shape changes
or duplicate coins at the destinations. Scroll controls its path, turns and size:
hero size → first inline slot → full budget size → scratch tool. Desktop slots
use 84 and 185 design pixels respectively; mobile sizes follow their smaller
rendered containers.
The second inline coin keeps its own reading-triggered animation.

Reversing scroll follows the same path. The selected coin stays still in the
text until its words light up, then makes the usual full turn and slowly rotates.
It supports pointer rotation at the budget dock and scratching after arrival
at the newsletter dock. Resizing remeasures the docks and the saved hero
position. Returning to the very top restores the coin to the hero conveyor;
its other coins hold their path positions while it is away to preserve spacing.
Reduced motion retains scroll-driven position and resizing, with autonomous
rotation and decorative flight turns disabled.
