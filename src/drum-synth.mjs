// The drum kit, synthesized in Web Audio: no General MIDI drum samples ship
// with the extension, so each kit name is a small recipe of a pitch-swept tone
// and/or filtered noise with a decaying envelope. It offers the same play() and
// stop() as a soundfont-player instrument, so playback treats it like one.

// tone: oscillator sweeping from..to Hz; noise: white noise through a filter.
// length in seconds, level relative to the note's gain.
const RECIPES = Object.freeze({
    kick: { tone: { type: 'sine', from: 150, to: 50, length: 0.45, level: 1.6 } },
    snare: {
        tone: { type: 'triangle', from: 190, to: 160, length: 0.1, level: 0.6 },
        noise: { filter: 'highpass', frequency: 1500, length: 0.18, level: 0.9 },
    },
    rim: {
        tone: { type: 'triangle', from: 1700, to: 1700, length: 0.04, level: 0.5 },
        noise: { filter: 'bandpass', frequency: 3000, length: 0.03, level: 0.5 },
    },
    clap: {
        tone: { type: 'triangle', from: 900, to: 800, length: 0.03, level: 0.3 },
        noise: { filter: 'bandpass', frequency: 1200, length: 0.2, level: 1 },
    },
    closed_hat: { noise: { filter: 'highpass', frequency: 7000, length: 0.05, level: 0.5 } },
    open_hat: { noise: { filter: 'highpass', frequency: 7000, length: 0.35, level: 0.45 } },
    ride: { noise: { filter: 'highpass', frequency: 8000, length: 0.9, level: 0.35 } },
    crash: { noise: { filter: 'highpass', frequency: 5000, length: 1.4, level: 0.5 } },
    low_tom: { tone: { type: 'sine', from: 140, to: 80, length: 0.4, level: 1.2 } },
    high_tom: { tone: { type: 'sine', from: 220, to: 140, length: 0.3, level: 1.1 } },
});

const SILENCE = 0.0001;
const DEFAULT_GAIN = 0.4;

// audioContext: a Web Audio context; destination: the node the kit plays into.
export function createDrumSynth(audioContext, { destination }) {
    const sounding = new Set();
    let noiseBuffer;

    function getNoiseBuffer() {
        if (!noiseBuffer) {
            // Two seconds of white noise, longer than the longest recipe.
            const length = audioContext.sampleRate * 2;
            noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let index = 0; index < length; index += 1) {
                data[index] = Math.random() * 2 - 1;
            }
        }
        return noiseBuffer;
    }

    // An envelope that starts at peak and decays to silence over length.
    function envelope(when, peak, length) {
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(peak, when);
        gain.gain.exponentialRampToValueAtTime(SILENCE, when + length);
        gain.connect(destination);
        return gain;
    }

    function start(source, when, length) {
        sounding.add(source);
        source.onended = () => sounding.delete(source);
        source.start(when);
        source.stop(when + length);
    }

    function playTone({ type, from, to, length, level }, when, gain) {
        const oscillator = audioContext.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, when);
        oscillator.frequency.exponentialRampToValueAtTime(to, when + length);
        oscillator.connect(envelope(when, gain * level, length));
        start(oscillator, when, length);
    }

    function playNoise({ filter, frequency, length, level }, when, gain) {
        const source = audioContext.createBufferSource();
        source.buffer = getNoiseBuffer();
        const shaper = audioContext.createBiquadFilter();
        shaper.type = filter;
        shaper.frequency.value = frequency;
        source.connect(shaper);
        shaper.connect(envelope(when, gain * level, length));
        start(source, when, length);
    }

    // note: a kit name (DRUM_NOTES); options.gain as playback gives every note.
    function play(note, when, options = {}) {
        const recipe = RECIPES[note];
        if (!recipe) {
            return;
        }
        const gain = options.gain ?? DEFAULT_GAIN;
        if (recipe.tone) {
            playTone(recipe.tone, when, gain);
        }
        if (recipe.noise) {
            playNoise(recipe.noise, when, gain);
        }
    }

    function stop() {
        for (const source of sounding) {
            source.stop();
        }
        sounding.clear();
    }

    return { play, stop };
}
