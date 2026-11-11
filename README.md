# Leitmotif

A browser-side SillyTavern extension that composes a leitmotif — a short instrumental theme — for the active character card, plays it with sampled instruments in the browser, and exports it as a MIDI file. Its score uses beat-timed events with chord support, rests, duration, and velocity across harmony, bass, and melody parts. Approximate loop duration (15 seconds to 2 minutes) and tempo (65–85 BPM) are configurable in the settings drawer. Generated event times are rounded to the nearest sixteenth-note and sorted before playback/export. Harmony supports notes from octaves 2–6 so lower chord extensions remain valid; velocity affects sampled playback gain and exported MIDI notes. Errors are logged to the browser console and shown through SillyTavern's error notification.

## Install

Install this repository through SillyTavern's **Extensions → Install Extension** flow, or place the repository in:

```text
SillyTavern/public/scripts/extensions/third-party/SillyTavern-Extension-Leitmotif
```

For this Windows machine, run `.\scripts\deploy-local.ps1` from PowerShell to copy the extension files into the local SillyTavern checkout. To target a different checkout, pass its root with `-SillyTavernRoot`; use `-WhatIf` to preview the copy.

Reload SillyTavern, open an individual character chat, and use the music icon beside the chat input. The first generation uses SillyTavern's currently selected generation backend. Audio samples and the MIDI writer are loaded from pinned unpkg URLs on demand; an internet connection is needed for those libraries and samples.

Use **Generate Theme** in SillyTavern's extensions quick-access menu. It shows a spinner while generating, changes to **Stop Theme** during playback, and returns to its normal label when stopped. The theme plays in the browser with sampled instruments (a master compressor reduces clipping when chords and tracks overlap) and can be saved with **Download the generated theme as MIDI** in the extension settings, which produces the same downloadable MIDI as before. The length presets target 15 seconds, 30 seconds, 1 minute, 1.5 minutes, or 2 minutes; actual duration is rounded to a whole number of 4/4 bars at the selected tempo. In each track's instrument setting, **Let the AI choose** allows a character-suitable timbre from the available samples; a specific instrument can also be selected. Character description, personality, scenario, and first message are sent in separate XML-style sections.

FluidR3 samples are only 1–2 seconds long, while chords held for several beats at a slow tempo last longer than that. Playback therefore scales each note's fade-out with its length and, for sustained instruments (warm synth pad, flute), loops the steady-state portion of the sample so held notes keep sounding; those looped samples are rebuilt with a crossfade at the loop seam, because Web Audio restarts a looped buffer without any blending and that discontinuity ticks once per pass. Decaying instruments (pianos, vibraphone, basses) instead finish their fade-out before the sample runs out. This keeps slow-tempo themes from ending notes with an abrupt, clipped-sounding cut or a click at the loop point.

## Verify

From the extension directory, run the score-validation tests with:

```text
node --test score.test.mjs
```

## Runtime libraries

- [soundfont-player 0.12.0](https://www.npmjs.com/package/soundfont-player), which loads FluidR3_GM samples from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).
- [midi-writer-js 3.2.1](https://www.npmjs.com/package/midi-writer-js), used to export generated tracks.
