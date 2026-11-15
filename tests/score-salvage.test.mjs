// Tests for the salvage of a cut score reply (score-salvage.mjs through
// parseScore): whole bars or events kept, the reply refused when its melody or
// its bass and harmony fall silent before the last bar.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScore } from '../src/score.mjs';

const options = { loopBeats: 32, targetTempo: 90 };
const eightBars = note => Array.from({ length: 8 }, () => `0:${note}:4`);

function cutAt(score, marker) {
    const text = JSON.stringify(score);
    const at = text.indexOf(marker);
    assert.ok(at > 0, marker);
    return text.slice(0, at);
}

function quietly(run) {
    const original = console.warn;
    console.warn = () => {};
    try {
        return run();
    } finally {
        console.warn = original;
    }
}

test('a reply cut mid-bar in the third track keeps its whole bars', () => {
    const score = { tempo: 90, meter: '4/4', tracks: [
        { role: 'melody', instrument: 'flute', bars: eightBars('E5') },
        { role: 'bass', instrument: 'acoustic_bass', bars: eightBars('A1') },
        { role: 'harmony', instrument: 'electric_piano_1', bars: ['0:A3+C4:2', '0:A3+C4:2', '0:A3+C4:2', '0:A3+C4:2', '0:G3+B3:2 2:G3+D4:2'] },
    ] };
    const parsed = quietly(() => parseScore(cutAt(score, '+D4:2'), options));
    assert.equal(parsed.tracks.length, 3);
    assert.deepEqual(parsed.tracks[2].events.map(event => event.beat), [0, 4, 8, 12]);
});

test('a reply cut mid-event in the old form keeps the whole events of the cut track', () => {
    const score = { tempo: 90, meter: '4/4', tracks: [
        { role: 'melody', instrument: 'flute', events: [{ beat: 0, duration: 32, velocity: 80, notes: ['E5'] }] },
        { role: 'bass', instrument: 'acoustic_bass', events: [{ beat: 0, duration: 32, velocity: 80, notes: ['A1'] }] },
        { role: 'harmony', instrument: 'electric_piano_1', events: [{ beat: 0, duration: 2, velocity: 60, notes: ['A3'] }, { beat: 2, duration: 2, velocity: 60, notes: ['C4'] }] },
    ] };
    const parsed = quietly(() => parseScore(cutAt(score, '"C4"'), options));
    assert.deepEqual(parsed.tracks[2].events.map(event => event.beat), [0]);
});

test('a cut reply whose melody holds from the bar before through the last bar is kept', () => {
    const score = { tempo: 90, meter: '4/4', tracks: [
        { role: 'melody', instrument: 'flute', bars: ['0:E5:4', '', '', '', '', '', '3:G5:2'] },
        { role: 'bass', instrument: 'acoustic_bass', bars: eightBars('A1') },
        { role: 'harmony', instrument: 'electric_piano_1', bars: ['0:A3+C4:2', '0:A3+C4:2'] },
    ] };
    const parsed = quietly(() => parseScore(cutAt(score, '+C4:2"]'), options));
    assert.equal(parsed.tracks[0].events.at(-1).beat, 27);
});

test('a cut reply whose melody stops in bar 3 of 8 is refused', () => {
    const score = { tempo: 90, meter: '4/4', tracks: [
        { role: 'melody', instrument: 'flute', bars: ['0:E5:4', '0:E5:4', '0:E5:4'] },
        { role: 'bass', instrument: 'acoustic_bass', bars: eightBars('A1') },
        { role: 'harmony', instrument: 'electric_piano_1', bars: ['0:A3+C4:2', '0:A3+C4:2'] },
    ] };
    assert.throws(() => quietly(() => parseScore(cutAt(score, '+C4:2"]'), options)), /cut off/);
});

test('a cut track with no usable event yet is left out, the rest kept', () => {
    const score = { tempo: 90, meter: '4/4', tracks: [
        { role: 'melody', instrument: 'flute', bars: eightBars('E5') },
        { role: 'bass', instrument: 'acoustic_bass', bars: eightBars('A1') },
        { role: 'counter', instrument: 'clarinet', bars: ['', '2:G4:2'] },
    ] };
    const parsed = quietly(() => parseScore(cutAt(score, '2:G4'), options));
    assert.deepEqual(parsed.tracks.map(track => track.role), ['melody', 'bass']);
});

test('a salvaged reply that is no score reports the cut, not the later check', () => {
    const cut = '{"tempo":90,"meter":"4/4","tracks":[{"role":"melody","instrument":"flute","bars":["0:E5:4","0:E';
    assert.throws(() => quietly(() => parseScore(cut, options)), /cut off/);
});

test('salvage finds the score after prose naming "tracks" and past a nested object', () => {
    const score = { tempo: 90, meter: '4/4', meta: { note: 'x' }, tracks: [
        { role: 'melody', instrument: 'flute', bars: eightBars('E5') },
        { role: 'bass', instrument: 'acoustic_bass', bars: eightBars('A1') },
        { role: 'harmony', instrument: 'electric_piano_1', bars: ['0:A3+C4:2', '0:G3+B3:2 2:G3+D4:2'] },
    ] };
    const parsed = quietly(() => parseScore(`I will write the "tracks" now. ${cutAt(score, '+D4:2')}`, options));
    assert.deepEqual(parsed.tracks[2].events.map(event => event.beat), [0]);
});
