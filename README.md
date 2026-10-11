# Pocket Operations Manual

**[Play the interactive PO-35 Speak simulator](https://udeudeude.github.io/Pocket-Operations-Manual/)**

An independent iPhone-friendly PO-35 Speak instrument emulator and interactive tutor. It uses editable, traced SVG artwork of the physical instrument and a state-driven segmented LCD. The underlying controls, sound engine, effects, sequencer, and lessons are connected.

The source of the control mapping is the [official teenage engineering PO-35 guide](https://teenage.engineering/guides/po-35/en) and its [two-page hardware manual](https://assets.teenage.engineering/_img/5a8582767d05480004ecaf30_original.pdf).

## How to play

The physical instrument is the primary interface. Its buttons and rotary controls have invisible touch targets precisely over the vector artwork.

1. Tap any numbered pad to trigger the selected sound. Slots **1–15** initially contain **synthetic practice syllables**, not recordings copied from teenage engineering. Select a slot and record or import your own audio to replace its practice sound. **Slot 16** is a synthesized single-channel Tonic-style drum voice.
2. Tap **SOUND**, then a pad, to select a sound. Tap **PATTERN**, then a pad, to select a pattern. Alternatively, use two fingers and hold the function button while pressing the pad.
3. Tap **WRITE** to edit sequencer steps; tap **PLAY** to hear the 16-step pattern.
4. Tap **FX** once to switch knob banks between *pitch/formant* and *sample start/speed*. Double-tap FX, then a numbered pad, to select a voice (1–8) or effect (9–16). Holding FX with a second finger also works, and its performance effect ends when released.
5. Drag the two knobs **vertically**. Changes to pitch and formant are applied to sounding samples as well as subsequently triggered notes.
6. Hold **BPM** and turn A/B for swing/fine tempo; hold **PATTERN** and turn A/B for transposition/scale. BPM + a pad sets volume; a held numbered pad followed by BPM/μ cycles step multiplication.
7. To chain, hold PATTERN while selecting several pads. The chain loops and can have repeated entries and up to 64 entries. You can also edit it under PLAY.
8. **WRITE + PATTERN + pad** copies the pattern. **REC + PATTERN** clears it. WRITE + knobs during playback stores parameter automation.

### Voice characters

| Pads | Voice | Approximation |
|---|---|---|
| FX+1 | Neutral | Formant-resonant sample playback |
| FX+2 | Autotune | Quantized pitch with a short delayed layer |
| FX+3 | Retro | Quantized waveform distortion and band shaping |
| FX+4 | Noise | Lo-fi distortion and bright noise layer |
| FX+5 | Robot | Ring modulation |
| FX+6 | Fifth | Added pitched layer at a perfect fifth |
| FX+7 | Vocoder | Bandpass-filtered sample plus synthetic carrier |
| FX+8 | Synth | Synth oscillator blended with processed speech |

A chosen voice character is remembered **per sound slot**. During WRITE playback, FX+1–8 additionally saves the selected voice into the pattern.

### Performance effects

| Pad | Name | Audible implementation |
|---|---|---|
| FX+9 | Stutter sweep | Repeated short grains with rising cutoff |
| FX+10 | Trance gate | Eight rhythmic amplitude gates |
| FX+11 | Half rate | Half-speed sample playback |
| FX+12 | 16 bar build up | Increasing filter cutoff and amplitude over 16 bars |
| FX+13 | 6/8 quantize | Triplet-oriented sequencing and accents |
| FX+14 | Retrigger pattern | Pattern restart |
| FX+15 | Reverse | Reversed recording/sample buffer |
| FX+16 | No effect | Disables FX; in WRITE mode clears recorded pattern effects |

Effect results are approximations rather than copies of the instrument's proprietary DSP.

### Sampling and storage

In **STUDIO**, record microphone audio or import a file using your phone's Files picker. Each sound is limited to **8 seconds**. Microphone and imported samples are saved locally in IndexedDB if the browser supports it.

Patterns, per-step sounds/notes, chains, voice and effect automation, and knob locks are saved automatically in local storage. Export/import these in JSON under STUDIO. The JSON does **not** include recorded audio, and it cannot be transmitted as a genuine PO-35 stereo backup.

### LCD

The app turns the original front-panel SVG into a functional segmented display using `lcd-engine.js`. It controls **112 visual elements**, with inactive paths at **1.8% opacity**. Under **REFERENCE → LCD segment test**, switch everything on/off or inspect individual segments.

## Fidelity and limitations

Read [the detailed fidelity audit](docs/FIDELITY.md) for the exact / approximate / unavailable feature inventory.

The audio is genuine live synthesis and sample processing, but not a reverse engineering of the PO-35 firmware. Real-world clock/alarm scheduling, the physical microphone input circuit, analog clock synchronization, hardware battery voltage, and manufacturer-compatible audio data transfer are not implemented. Sync, battery, data transfer, and alarm button combinations display informative states without simulating unsupported physical hardware.

## Project structure

- `index.html`: responsive hardware artwork, layout, and controls.
- `assets/po35-speak-panel.svg`: cropped interactive device.
- `assets/po35-speak-complete.svg`: full device, including hanger.
- `po35-app.js`: touch gestures, lessons, recording, and UI state.
- `po35-model.js`: patterns, per-sound voices, FX, locks, multipliers, and chaining.
- `po35-audio.js`: Web Audio voice synthesis, Tonic-style drums, and effects.
- `lcd-engine.js`: independently addressable LCD paths and digits.
- `sw.js`: offline caching.
- `tests/po35.test.cjs`: unit-level regression tests, run with `node tests/po35.test.cjs`.

Independent educational project, not affiliated with or endorsed by teenage engineering.
