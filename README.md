# Leitmotif

Composes a leitmotif for the character you are chatting with: a short instrumental theme, played with sampled General MIDI instruments, right in the browser. You can download it as a MIDI file.

The character card is first read into a music brief (key, tempo, mood, motif), then a second call turns that brief into a 2 to 5 track score. That is two quick AI calls through whatever backend SillyTavern is already configured with. Playback, looping, and MIDI export happen locally after that. The extension makes no network calls of its own.

## Install

In SillyTavern, open Extensions, click Install Extension, paste this URL, and confirm:

```
https://github.com/elana-voss/SillyTavern-Extension-Leitmotif
```

Expect a large first download, about 300 MB: the instrument samples are inside the repository. Later updates are small.

Then open a character chat and choose Generate Theme in the Extensions menu (the wand icon next to the input box).

## Use

Generate Theme choice in the Extensions menu writes a theme for the current character and plays it. While it plays, the button becomes Stop Theme. Download the generated theme as MIDI saves the result.

The settings panel holds the rest: theme length (15 seconds to 2 minutes), tempo, Tempo follows the character (the analysis picks the BPM, on by default), and Theme variety (Focused / Standard / Wild). The meter (3/4 or 4/4) always comes from the analysis. It also shows the music brief of the last analysis.

## Development

Tests: `node --test score.test.mjs brief.test.mjs`. `scripts/deploy-local.ps1` copies the extension into a local SillyTavern checkout.

## Credits and Licenses

The instrument samples in `samples/` are the FluidR3_GM soundfont from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts), unmodified, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/us/). Full attribution in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

The two vendored libraries in `lib/`, soundfont-player and midi-writer-js, are MIT.

The code is LGPL-2.1-or-later, the same as SillyTavern-Extension-NPCNames. See LICENSE.
