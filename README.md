# MIDI Vibe Composer

A browser-side SillyTavern extension that generates an instrumental loop from the active character card, plays it with sampled instruments, and exports it as a MIDI file. Its score uses beat-timed events with chord support, rests, duration, and velocity across harmony, bass, and melody parts. Loop length (4, 8, or 16 bars) and tempo (65–85 BPM) are configurable in the settings drawer. Harmony supports notes from octaves 2–6 so lower chord extensions remain valid; velocity affects sampled playback gain and exported MIDI notes. Errors are logged to the browser console and remain visible in the settings status.

## Install

Install this repository through SillyTavern's **Extensions → Install Extension** flow, or place the repository in:

```text
SillyTavern/public/scripts/extensions/third-party/SillyTavern-Extension-Midi
```

For this Windows machine, run `.\scripts\deploy-local.ps1` from PowerShell to copy the extension files into the local SillyTavern checkout. To target a different checkout, pass its root with `-SillyTavernRoot`; use `-WhatIf` to preview the copy.

Reload SillyTavern, open an individual character chat, and use the music icon beside the chat input. The first generation uses SillyTavern's currently selected generation backend. Audio samples and the MIDI writer are loaded from pinned unpkg URLs on demand; an internet connection is needed for those libraries and samples.

The single toolbar button shows a spinner while generating, changes to a stop button during playback, and returns to the music icon when stopped. The generated theme loops until stopped. Use the MIDI Vibe Composer settings drawer to select length and tempo or download the current composition as a `.mid` file. Character description, personality, scenario, and first message are sent in separate XML-style sections.

## Verify

From the extension directory, run the score-validation tests with:

```text
node --test score.test.mjs
```

## Runtime libraries

- [soundfont-player 0.12.0](https://www.npmjs.com/package/soundfont-player), which loads FluidR3_GM samples from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).
- [midi-writer-js 3.2.1](https://www.npmjs.com/package/midi-writer-js), used to export generated tracks.
