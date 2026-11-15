// Timing shared by playback and MIDI export: swing moves eighths onto a
// triplet feel (drums by position); humanisation (playback only, the MIDI
// file stays exact) nudges each note's start and velocity by a small seeded
// random amount.

const SWING_SHIFT = 1 / 6;
const HUMANIZE_SECONDS = 0.008;
const HUMANIZE_VELOCITY = 6;

// The start and length in beats of an event under the score's feel. Swing
// lengthens an on-beat eighth to 2/3 of a beat and starts an off-beat event of
// an eighth or longer 1/6 of a beat late with its end unchanged, so the pair
// meets exactly; a pitched sixteenth line stays straight, else its hits would
// flam. Drums swing by position, as a drummer does: the second half of each
// beat is squeezed into its last third (0.5 -> 2/3, 0.75 -> 5/6), so a short
// off-beat hat swings with the eighths and a sixteenth line keeps its order;
// a hit keeps its length.
export function swingEvent(beat, duration, feel, { drums = false } = {}) {
    if (feel !== 'swing') {
        return { beat, duration };
    }
    const position = beat % 1;
    if (drums) {
        return position < 0.5
            ? { beat, duration }
            : { beat: beat - position + 2 / 3 + (position - 0.5) * 2 / 3, duration };
    }
    if (position === 0 && duration === 0.5) {
        return { beat, duration: 0.5 + SWING_SHIFT };
    }
    if (position === 0.5 && duration >= 0.5) {
        return { beat: beat + SWING_SHIFT, duration: duration - SWING_SHIFT };
    }
    return { beat, duration };
}

// A seeded random from 0 to just below 1 (mulberry32), so a test can repeat it.
export function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

// One note's start (seconds) and velocity, nudged by up to 8 ms and 6 steps.
// Bar one's downbeat stays exact so the loop seam stays clean, and no note
// moves before the loop's start.
export function humanize({ beat, when, velocity }, { random, loopStart }) {
    if (beat === 0) {
        return { when, velocity };
    }
    const offset = (random() * 2 - 1) * HUMANIZE_SECONDS;
    const step = Math.round((random() * 2 - 1) * HUMANIZE_VELOCITY);
    return {
        when: Math.max(loopStart, when + offset),
        velocity: Math.min(127, Math.max(1, velocity + step)),
    };
}
