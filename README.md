# Leitmotif

A browser-side SillyTavern extension that composes a leitmotif — a short instrumental theme — for the active character card, plays it with sampled instruments in the browser, and exports it as a MIDI file. Generation is two-stage: the card is first analyzed into a music brief (backdrop, action, twist, traits, and arc mapped to harmonic texture, rhythm, one harmonic surprise, timbre and energy, plus key, mode, feel, meter, tempo, and a recurring motif), then a composer call turns that brief into a score. The score uses beat-timed events with chord support, rests, duration, and velocity across three required parts (harmony, bass, melody) and up to two optional ones (counter, texture), in 3/4 or 4/4. Approximate loop duration (15 seconds to 2 minutes) and tempo (50–130 BPM) are configurable in the settings drawer; tempo and meter can also be chosen by the character analysis. Generated event times are rounded to the nearest sixteenth-note and sorted before playback/export. Harmony supports notes from octaves 2–6 so lower chord extensions remain valid; velocity affects sampled playback gain and exported MIDI notes. Errors are logged to the browser console and shown through SillyTavern's error notification.

## Install

Install this repository through SillyTavern's **Extensions → Install Extension** flow, or place the repository in:

```text
SillyTavern/public/scripts/extensions/third-party/SillyTavern-Extension-Leitmotif
```

For this Windows machine, run `.\scripts\deploy-local.ps1` from PowerShell to copy the extension files into the local SillyTavern checkout. To target a different checkout, pass its root with `-SillyTavernRoot`; use `-WhatIf` to preview the copy.

Reload SillyTavern, open an individual character chat, and use the music icon beside the chat input. The first generation uses SillyTavern's currently selected generation backend. Audio samples and the MIDI writer are loaded from pinned unpkg URLs on demand; an internet connection is needed for those libraries and samples.

Use **Generate Theme** in SillyTavern's extensions quick-access menu. It shows a spinner while generating, changes to **Stop Theme** during playback, and returns to its normal label when stopped. Each click runs two generations: an analysis call turns the character card (description, personality, scenario, first message — sent in separate XML-style sections, treated as reference material) into a music brief, and a composer call binds that brief to a score. The brief defines this character's leitmotif motif, which the score must recur and transform; anti-default rules keep the model from falling back to the same pad-and-four-chord prototype for every card. The analysis is cached per character, so re-generating pays for composition only. The settings drawer shows the latest brief under **Music brief of the last analysis**.

The theme plays in the browser with sampled instruments from a palette of 29 FluidR3 patches (a master compressor reduces clipping when chords and tracks overlap) and can be saved with **Download the generated theme as MIDI**. The length presets target 15 seconds, 30 seconds, 1 minute, 1.5 minutes, or 2 minutes; actual duration is rounded to a whole number of bars at the selected tempo and meter. **Tempo follows the character** lets the analysis pick BPM (50–130) and meter instead of the slider. **Theme variety** (Focused / Standard / Wild) samples a random style seed each generation so two clicks on the same character differ; the brief stays the character's identity and the seed only fills open decisions. In each track's instrument setting, **Let the AI choose** allows a character-suitable timbre from the available samples; a specific instrument can also be selected and pins that role.

FluidR3 samples are only 1–2 seconds long, while chords held for several beats at a slow tempo last longer than that. Playback therefore scales each note's fade-out with its length and, for sustained instruments (warm synth pad, flute), loops the sample so held notes keep sounding. Because Web Audio restarts a looped buffer without any blending, the loop points are chosen where the sample's own waveform continues smoothly into itself; if no clean loop point exists for a note, its fade-out is finished inside the sample instead. Decaying instruments (pianos, vibraphone, basses) always finish their fade-out before the sample runs out. This keeps slow-tempo themes from ending notes with an abrupt, clipped-sounding cut or a click at the loop point.

## Verify

From the extension directory, run the score and brief validation tests with:

```text
node --test score.test.mjs brief.test.mjs
```

## Runtime libraries

- [soundfont-player 0.12.0](https://www.npmjs.com/package/soundfont-player), which loads FluidR3_GM samples from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).
- [midi-writer-js 3.2.1](https://www.npmjs.com/package/midi-writer-js), used to export generated tracks.
