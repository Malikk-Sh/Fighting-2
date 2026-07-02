# Generated game assets

The renderer expects the following WebP files in this directory:

- `fighter-ronin.webp` — 6 × 4 sprite sheet: idle, walk, attack, hit/knockout;
- `fighter-kage.webp` — 6 × 4 sprite sheet: idle, walk, attack, hit/knockout;
- `effects.webp` — 6 × 2 sprite sheet: slash and hit effects;
- `arena-moon.webp` — moonlit mountain arena;
- `arena-shrine.webp` — purple shrine/lake arena;
- `arena-bloodmoon.webp` — blood-moon wooden platform arena.

The generated renderer falls back to the original Canvas placeholders when these files are absent or fail to load.

The source images were generated for this project and post-processed to remove the checkerboard background, resize the sprite cells to consistent dimensions and optimize them for mobile browsers.
