# Vision projector

An interactive, isometric light show: a tape deck's bass line shakes a dish of water on an overhead projector, and the standing waves are thrown onto a screen through a turning colour wheel. A dose dial follows ayahuasca's six-hour curve, so the patterns grow from stripes to squares, hexagons and twelve-fold mandalas at the peak.

Open `index.html` in a browser. It is a single self-contained file.

- Move across the figure to change the hour, up and down to change the pitch.
- Click the water or the screen to drop a droplet.
- Space (or the ♪ button) plays the sound.

`src/` holds the build: `node src/build.mjs` regenerates the page. It expects the [anatomy](https://github.com/wheresryan22/anatomy) skill's kit at `../anatomy-main/` relative to `src/`, and writes `../vision-projector.html`.
