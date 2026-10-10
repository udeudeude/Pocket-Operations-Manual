# Pocket Operations Manual

An independent, mobile-friendly educational PO-35 Speak simulator with interactive lessons, a sequencer, microphone recordings, editable patterns, and a vector recreation of the hardware.

**Live app:** https://udeudeude.github.io/Pocket-Operations-Manual/

## Interactive vector LCD (v0.6)

The PO-35 artwork is rendered from `assets/po35-speak-panel.svg`. On initialization, `lcd-engine.js` loads that SVG inline so its LCD paths can be individually controlled. An unmodified vector image remains visible if the enhancement cannot load.

The LCD engine currently addresses **112 independent visual elements**:

- 49 individually switched segments across seven seven-segment character cells.
- 32 step-indicator rectangles (16 above and 16 below the illustrated screen).
- 29 traced, separately controllable original illustration and indicator paths.
- Two mode annunciators (write and record).

Inactive segments are retained at **1.8% opacity**, intentionally close to invisible. The original traced readout is always kept faint; the new numeric display supplies dynamically selected segments instead.

The dynamic readout responds to sound selection, pattern selection, notes, voices, effect numbers, parameter knobs, tempo/volume, recording, and playback state. The play/stop icons, character-art layers, meter bars, step LEDs, and write/record annunciators also respond to app state.

To inspect the graphics, open **REFERENCE → LCD segment test** and use **All on**, **All off**, **Step segment**, or **Normal**. Leaving Reference automatically returns to normal.

### Source files

- `index.html`: app UI, sequencer, controls, and lesson state.
- `lcd-engine.js`: original artwork path control, dynamic digits, and LCD diagnostic mode.
- `assets/po35-speak-panel.svg`: app-ready instrument front (hanger cropped).
- `assets/po35-speak-complete.svg`: complete vector with hanger.
- `sw.js`: mobile offline support.

## Accuracy and limitations

The display is a **state-driven educational approximation**, not an electrical emulation of the physical LCD's undocumented segment mapping or Teenage Engineering's firmware. Some traced shapes contain multiple pieces of the drawing and therefore switch together. The synthetic audio engine likewise does not reproduce the original vocal-processing algorithms, and the app does not transmit hardware-compatible PO backup audio.

The goal is to make the visual and interaction behaviors progressively closer to the real instrument while keeping the artwork and segment logic independently editable.

## iPhone use

Open the live link in Safari. Tap a button to initialize audio. For an app-like experience, use **Share → Add to Home Screen**. Microphone recording requires HTTPS and browser permission.
