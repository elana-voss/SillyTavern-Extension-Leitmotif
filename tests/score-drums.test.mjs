// Tests for score.mjs: the drums track and the score's feel.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DRUM_INSTRUMENT, DRUM_NOTES, INSTRUMENTS, parseScore, SCORE_JSON_SCHEMA } from '../src/score.mjs';

const pitched = [
    { role: 'harmony', instrument: 'pad_2_warm', events: [{ beat: 0, duration: 16, velocity: 70, notes: ['A3', 'C4', 'E4'] }] },
    { role: 'bass', instrument: 'acoustic_bass', events: [{ beat: 0, duration: 4, velocity: 90, notes: ['A1'] }] },
    { role: 'melody', instrument: 'flute', events: [{ beat: 0, duration: 1, velocity: 80, notes: ['E5'] }] },
    { role: 'counter', instrument: 'clarinet', events: [{ beat: 2, duration: 1, velocity: 60, notes: ['C4'] }] },
    { role: 'texture', instrument: 'pad_7_halo', events: [{ beat: 0, duration: 16, velocity: 40, notes: ['A2'] }] },
];
const sixteenthHats = Array.from({ length: 64 }, (_, index) => ({ beat: index / 4, duration: 0.25, velocity: 60, notes: ['closed_hat'] }));

function withWarnings(run) {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        return { result: run(), warnings };
    } finally {
        console.warn = original;
    }
}

test('a six-track score with sixteenth hats and a kick parses with the drums on drum_kit', () => {
    const drums = { role: 'drums', instrument: 'drum_kit', events: [{ ...sixteenthHats[0], notes: ['kick', 'closed_hat'] }, ...sixteenthHats.slice(1)] };
    const score = parseScore({ tempo: 90, tracks: [...pitched, drums] });
    assert.equal(score.tracks.length, 6);
    const parsed = score.tracks[5];
    assert.equal(parsed.instrument, DRUM_INSTRUMENT);
    assert.equal(parsed.events.length, 64);
    assert.deepEqual(parsed.events[0].notes.sort(), ['closed_hat', 'kick']);
});

test('unknown drum names are dropped with a warning and a pitched instrument on drums becomes drum_kit', () => {
    const drums = { role: 'drums', instrument: 'flute', events: [
        { beat: 0, duration: 0.5, velocity: 100, notes: ['kick', 'cowbell'] },
        { beat: 1, duration: 0.5, velocity: 100, notes: ['C4'] },
    ] };
    const { result, warnings } = withWarnings(() => parseScore({ tempo: 90, tracks: [...pitched.slice(0, 3), drums] }));
    const parsed = result.tracks[3];
    assert.equal(parsed.instrument, DRUM_INSTRUMENT);
    assert.deepEqual(parsed.events, [{ beat: 0, duration: 0.5, velocity: 100, notes: ['kick'] }]);
    assert.ok(warnings.some(line => line.includes('cowbell')), warnings.join('\n'));
});

test('drum_kit stays out of the 128 programs, is offered in the schema and never lands on a pitched role', () => {
    assert.equal(Object.hasOwn(INSTRUMENTS, DRUM_INSTRUMENT), false);
    const track = SCORE_JSON_SCHEMA.properties.tracks.items.properties;
    assert.ok(track.role.enum.includes('drums'));
    assert.ok(track.instrument.enum.includes(DRUM_INSTRUMENT));
    assert.equal(Object.keys(DRUM_NOTES).length, 10);
    const melody = { ...pitched[2], instrument: DRUM_INSTRUMENT };
    const { result } = withWarnings(() => parseScore({ tempo: 90, tracks: [pitched[0], melody] }));
    assert.notEqual(result.tracks[1].instrument, DRUM_INSTRUMENT);
});

test('the drums track may hold four events per beat, more is an error', () => {
    const crowded = Array.from({ length: 16 * 4 + 1 }, (_, index) => ({ beat: (index % 64) / 4, duration: 0.25, velocity: 60, notes: ['ride'] }));
    assert.throws(() => parseScore({ tempo: 90, tracks: [...pitched.slice(0, 3), { role: 'drums', instrument: 'drum_kit', events: crowded }] }), /1 to 64/);
});

test('the score carries the brief feel, straight when none is given', () => {
    const tracks = pitched.slice(0, 3);
    assert.equal(parseScore({ tempo: 90, tracks }, { feel: 'swing' }).feel, 'swing');
    assert.equal(parseScore({ tempo: 90, tracks }).feel, 'straight');
    assert.equal(parseScore({ tempo: 90, tracks }, { feel: 'shuffle' }).feel, 'straight');
});
