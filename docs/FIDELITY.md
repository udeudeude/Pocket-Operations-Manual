# PO-35 Speak fidelity review (2026-10-11)

**Sources:**
- Original user guide: https://teenage.engineering/guides/po-35/en
- Original two-page PDF: https://assets.teenage.engineering/_img/5a8582767d05480004ecaf30_original.pdf
- Secondary descriptions (not controlling sources): Sound On Sound PO-35 review, https://www.soundonsound.com/reviews/teenage-engineering-po-33-ko-po-35-speak

**Status terms:** *mapped* means the documented control gesture and state transition are implemented. *Approximation* means there is an audible or observable behavior but it is not a verified reproduction of original firmware/DSP. *Unavailable* means the browser cannot supply the physical signal or the proprietary format is not implemented.

## Control and music-function inventory

| Feature | Official guide | Current status / differences |
|---|---|---|
| Sound selection | Hold SOUND + 1–16 | Mapped with multi-touch and SOUND tap-and-pad fallback. |
| Sound memory | Record slots 1–15, maximum 8 seconds | Mapped eight-second limit; browser mic or uploaded audio; synthetic placeholders before recordings. |
| Microtonic slot 16 | Single-channel PO-32/Tonic voice | Approximation: 16 computer-generated drum tones; not genuine PO-32 Microtonic synthesis. |
| Pattern selection | Hold PATTERN + 1–16 | Mapped; one-handed latch. |
| Step edit | WRITE toggles pattern record mode; 16 steps | Mapped. Steps retain captured notes and sound selection. |
| Playback | PLAY toggles, 16-step pattern | Mapped. Web Audio schedules notes with lookahead. |
| Pattern chaining | Hold PATTERN; several keys; repeated entries, max 64 | Mapped. Also a text-based chain editor. |
| Copy | WRITE + PATTERN + destination pad | Mapped for notes, per-sound settings, FX, multipliers and locks. |
| Clear | REC + PATTERN | Mapped. |
| Live write/punch | Hold WRITE + pad during playback | Mapped to the current step (approximate quantization/phase timing). |
| Voice modes | FX + 1–8 | Mapped voice selection, with sound-slot memory; per-step voice automation when playing with WRITE on. Eight distinct audible approximations. |
| Performance FX | FX + 9–15 | Mapped. Effects are deliberately distinguishable and processed in Web Audio. Exact DSP and timing remain approximate. |
| Clear recorded FX | WRITE on, FX + 16 | Mapped to removal of saved FX locks in current pattern. |
| FX bank toggle | Tap FX | Mapped to pitch/formant vs start/speed knob pair. |
| Pitch / formant | Bank 1, knobs A/B | Approximation: real-time playback-rate pitch and two movable resonant peaks. |
| Start / speed | Bank 2, knobs A/B | Approximation: sample offset and playback speed. Start applies to new triggers; speed can affect sounding notes. |
| Swing | Hold BPM + knob A | Mapped, with adjustable odd/even step time offsets. Exact curve not verified. |
| Fine tempo | Hold BPM + knob B, 60–240 | Mapped. |
| Presets | Tap BPM for HIP HOP 80, DISCO 120, TENCHO 140 | Mapped. |
| Master volume | Hold BPM + pad 1–16 | Mapped. Default 5 for conservative headphone volume. |
| Transpose / scale | PATTERN + A/B | Mapped; eight musically useful scales provided; actual firmware scale lists may differ. |
| Parameter locks | WRITE held + turn knobs during playback | Mapped, stored at the current step. |
| Step multiplier | Pad held + μ/BPM | Approximation: cycles ×1, ×2, ×4, ×8. The exact original multiplier mapping is not verified. |
| Recording from built-in mic | REC + 1–15 until released | Mapped to browser microphone recording. Permissions and latency differ from hardware. |
| Recording from line in | Cable inserted into physical jack | Approximation: import audio file into slot. No direct analog input circuit. |
| Data transfer | WRITE + SOUND send; REC + SOUND receive | Unavailable. Status feedback only; JSON is an app-specific data format. |
| Sync modes | REC + BPM toggles SY0–SY5 | Display/state simulation only; no actual 3.5mm sync clock. |
| Battery reading | SOUND + BPM | Status simulation only; webpage cannot sense PO-35 battery voltage. |
| Clock/alarm | Device clock, SOUND + PATTERN alarm | Status/guide only. No physical standby circuitry or alarm wake-on-battery. |
| Lock tab | Destructive hardware tab freezes sounds/patterns | Unavailable as hardware; browser storage is not protected by such a tab. |

## Audio implementation detail

`po35-audio.js` generates 15 placeholder synthetic speech samples (vowel/formant harmonic spectra) only when required. These are **not** original device presets. A recorded or imported sample always replaces the corresponding placeholder.

- **Neutral**: dry-ish sample with dual formant resonances.
- **Autotune**: chromatically quantized pitch multiplier and a small delayed layer.
- **Retro**: waveform quantization with formant shaping.
- **Noise**: sample distortion plus filtered noise.
- **Robot**: ring-modulated speech sample.
- **Fifth**: sample voice plus a fifth above.
- **Vocoder**: bandpass treatment plus synthetic carrier.
- **Synth**: sample blended with sawtooth oscillator.
- **9 Stutter sweep**: repeated slices with rising lowpass cutoff.
- **10 Trance gate**: fast gated gain.
- **11 Half rate**: half-speed buffer play.
- **12 16 bar build up**: filter and amplitude rise over 16 measures.
- **13 6/8 quantize**: compound-meter time/accents; not confirmed firmware groove.
- **14 Retrigger pattern**: sequencing transport position reset.
- **15 Reverse**: reverse of decoded sample data.
- **16 No effect**: clear active performance effect, and FX automation while WRITE is enabled.

Web Audio rendering uses a compressor limiter and conservative initial volume. Effects share a common chain after each voice algorithm so they remain audible regardless of chosen voice. Long sounds respond to knob changes while active, but the implementation is not a phase-vocoder: large pitch changes can also alter apparent speed.

## Browser limitations and remaining research

1. **Exact synthesis**: original DSP, actual voice formant algorithms, factory Microtonic tones, and effect transfer functions are not published in the cited guide. Independent reverse engineering would be needed for a faithful reimplementation.
2. **Sampling waveform fidelity**: the browser uses MediaRecorder or decoded audio files. Physical input preamp, automatic input detection, compression and internal resynthesis may yield noticeably different results.
3. **Timing precision**: audio notes are scheduled with Web Audio lookahead; graphic updates use browser timers. UI animations are not hardware LCD refresh cycles.
4. **Native backup data**: the official guide prescribes stereo, at least 16-bit 44 kHz transfers. Current JSON export is deliberately separate and cannot round-trip real PO-35 state through an audio cable.
5. **Device-only features**: lock tab, battery reading, clock alarm wakeup, actual analogue sync modes, and Microtonic remote data reception are outside the webpage's physical access.
6. **Real-device verification**: mapping was verified against published documentation and programmatic tests, not by direct audio capture against a user's PO-35. Exact effect timing and step multiplier combinations need empirical comparison.
7. **Legacy saves**: browser migration accepts the preceding v2 pattern grid. New v3 JSON stores additional parameters and automation. Microphone samples are held independently in IndexedDB, not in JSON.

## Regression tests

Run `node tests/po35.test.cjs`. GitHub Actions also checks module syntax and runs these tests on pushes and pull requests.

Manual mobile smoke test: open iPhone Safari → play pad 1 → SOUND+2 → FX+5 → FX+9 during playback → WRITE steps 1 and 5 → chain 1, 1, 4 → record slot 2 → drag both knobs in both banks → check microphone sample persistence after a reload.
