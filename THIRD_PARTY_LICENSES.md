# Third-Party Licenses

Leitmotif bundles third-party audio data and code unchanged, so their licenses and notices travel with the extension, as required by them.

## Instrument samples (`samples/*.js`)

### gleitz/midi-js-soundfonts

- **URL**: https://github.com/gleitz/midi-js-soundfonts
- **License**: Creative Commons Attribution 3.0, as stated for the FluidR3_GM set in its README. See https://creativecommons.org/licenses/by/3.0/
- **Used for**: every instrument sample in `samples/`, taken from the pre-rendered `FluidR3_GM` set (generated from [FluidR3_GM.sfArk](http://www.synthfont.com/SoundFonts/FluidR3_GM.sfArk)) and included here unmodified.
- **Regenerate the folder with**: `scripts/download-samples.ps1`

## Vendored libraries (`lib/*.js`)

### soundfont-player 0.12.0

- **URL**: https://github.com/danigb/soundfont-player
- **License**: MIT. Copyright (c) 2015 Daniel Gómez Blasco. See the MIT notice at the bottom of this file.
- **Used for**: sample playback in the browser.

### midi-writer-js 3.2.1

- **URL**: https://github.com/grimmdude/MidiWriterJS
- **License**: MIT. Copyright (c) 2018 Garrett Grimm. See the MIT notice at the bottom of this file.
- **Used for**: writing the exported `.mid` file.

## MIT License notice (applies to both libraries above)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
