import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getApproximateDuration,
    getLoopBars,
    INSTRUMENTS,
    parseScore,
    TRACK_ROLES,
} from './score.mjs';

const validScore = {
    tempo: 72,
    tracks: [
        {
            role: 'harmony',
            instrument: 'pad_2_warm',
            events: [
                { beat: 0, duration: 4, velocity: 72, notes: ['A3', 'C4', 'E4', 'G4'] },
                { beat: 4, duration: 4, velocity: 66, notes: ['D3', 'F3', 'A3', 'C4'] },
                { beat: 8, duration: 4, velocity: 72, notes: ['G3', 'B3', 'D4', 'F4'] },
                { beat: 12, duration: 4, velocity: 66, notes: ['C3', 'E3', 'G3', 'B3'] },
            ],
        },
        {
            role: 'bass',
            instrument: 'acoustic_bass',
            events: [
                { beat: 0, duration: 1.5, velocity: 96, notes: 'A1' },
                { beat: 2, duration: 0.75, velocity: 70, notes: 'E2' },
                { beat: 4, duration: 1.5, velocity: 90, notes: 'D2' },
            ],
        },
        {
            role: 'melody',
            instrument: 'acoustic_grand_piano',
            events: [
                { beat: 1.5, duration: 0.5, velocity: 82, notes: 'E5' },
                { beat: 2.5, duration: 0.75, velocity: 54, notes: ['C5', 'E5'] },
                { beat: 6, duration: 1, velocity: 78, notes: 'A4' },
            ],
        },
    ],
};

test('parses timed chords, rests, durations, and dynamics from a fenced JSON score', () => {
    const expected = {
        ...validScore,
        loopBeats: 16,
        tracks: validScore.tracks.map(track => ({
            ...track,
            events: track.events.map(event => ({
                ...event,
                notes: typeof event.notes === 'string' ? [event.notes] : event.notes,
            })),
        })),
    };
    assert.deepEqual(parseScore(`\`\`\`json\n${JSON.stringify(validScore)}\n\`\`\``), expected);
});

test('normalizes a single note to a one-note chord', () => {
    const parsed = parseScore(validScore);
    assert.deepEqual(parsed.tracks[1].events[0].notes, ['A1']);
    assert.deepEqual(parsed.tracks[2].events[0].notes, ['E5']);
});

test('accepts lower chord tones used by the generated harmony', () => {
    const response = structuredClone(validScore);
    response.tracks[0].events[2].notes = ['Bb2', 'D3', 'F3', 'A3', 'C4'];
    const parsed = parseScore(response);
    assert.deepEqual(parsed.tracks[0].events[2].notes, ['Bb2', 'D3', 'F3', 'A3', 'C4']);
});

test('transposes notes into the octave range for their track role', () => {
    const response = structuredClone(validScore);
    response.tracks[1].events[0].notes = 'Bb3';
    response.tracks[2].events[0].notes = 'A2';
    const parsed = parseScore(response);
    assert.deepEqual(parsed.tracks[1].events[0].notes, ['Bb2']);
    assert.deepEqual(parsed.tracks[2].events[0].notes, ['A3']);
});

test('supports selected loop lengths and tempo overrides', () => {
    const eightBarScore = {
        ...validScore,
        tempo: 74,
        tracks: validScore.tracks.map(track => ({
            ...track,
            events: [
                ...track.events,
                ...track.events.map(event => ({ ...event, beat: event.beat + 16 })),
            ],
        })),
    };
    const parsed = parseScore(eightBarScore, { loopBeats: 32, targetTempo: 82 });
    assert.equal(parsed.loopBeats, 32);
    assert.equal(parsed.tempo, 82);
    assert.equal(parsed.tracks[0].events.at(-1).beat, 28);
});

test('accepts events through the end of a selected 16-bar loop', () => {
    const longScore = {
        ...validScore,
        tracks: validScore.tracks.map((track, index) => index === 1
            ? {
                ...track,
                events: [{ beat: 63, duration: 1, velocity: 80, notes: 'A1' }],
            }
            : track),
    };
    const parsed = parseScore(longScore, { loopBeats: 64 });
    assert.equal(parsed.loopBeats, 64);
    assert.equal(parsed.tracks[1].events[0].beat + parsed.tracks[1].events[0].duration, 64);
});

test('accepts the 120-second preset at the highest supported tempo', () => {
    const bars = getLoopBars(120, 85);
    assert.equal(bars, 43);
    const longScore = {
        ...validScore,
        tracks: validScore.tracks.map((track, index) => index === 1
            ? {
                ...track,
                events: [{ beat: bars * 4 - 1, duration: 1, velocity: 80, notes: 'A1' }],
            }
            : track),
    };
    const parsed = parseScore(longScore, { loopBeats: bars * 4, targetTempo: 85 });
    assert.equal(parsed.loopBeats, 172);
    assert.equal(getApproximateDuration(bars, 85), 121);
});

test('maps duration presets to the nearest whole-bar loop at the selected tempo', () => {
    for (const seconds of [15, 30, 60, 90, 120]) {
        for (const tempo of [65, 74, 85]) {
            const bars = getLoopBars(seconds, tempo);
            assert.ok(bars >= 4);
            assert.ok(bars <= 44);
            assert.ok(Math.abs(getApproximateDuration(bars, tempo) - seconds) <= 2);
        }
    }
    assert.throws(() => getLoopBars(45, 74), /available presets/);
    assert.throws(() => getLoopBars(30, 100), /65 to 85/);
});

test('rejects events that exceed the selected loop length', () => {
    const tooLong = {
        ...validScore,
        tracks: validScore.tracks.map((track, index) => index === 1
            ? {
                ...track,
                events: [{ beat: 16, duration: 1, velocity: 80, notes: 'A1' }],
            }
            : track),
    };
    assert.throws(() => parseScore(tooLong, { loopBeats: 16 }), /sixteenth-note grid/);
});

test('supports the defined instruments and role-compatible patches', () => {
    assert.deepEqual(Object.keys(INSTRUMENTS), [
        'acoustic_bass',
        'acoustic_grand_piano',
        'electric_bass_finger',
        'electric_piano_1',
        'flute',
        'pad_2_warm',
        'vibraphone',
    ]);
    assert.deepEqual(Object.keys(TRACK_ROLES), ['harmony', 'bass', 'melody']);
    assert.throws(() => parseScore({
        ...validScore,
        tracks: validScore.tracks.map((track, index) =>
            index === 0 ? { ...track, instrument: 'pad_4_warm' } : track,
        ),
    }), /instrument that does not match/);
    assert.deepEqual(parseScore(validScore, {
        instrumentOptions: {
            harmony: ['pad_2_warm'],
            bass: ['acoustic_bass'],
            melody: ['acoustic_grand_piano'],
        },
    }).tracks.map(track => track.instrument), ['pad_2_warm', 'acoustic_bass', 'acoustic_grand_piano']);
});

test('rejects invalid tempo, missing role, or duplicate role', () => {
    assert.throws(() => parseScore({ ...validScore, tempo: 86 }), /tempo/);
    assert.throws(() => parseScore({ ...validScore, tracks: validScore.tracks.slice(0, 2) }), /harmony, bass, and melody/);
    assert.throws(() => parseScore({
        ...validScore,
        tracks: [validScore.tracks[0], validScore.tracks[1], { ...validScore.tracks[2], role: 'bass', instrument: 'acoustic_bass' }],
    }), /can only appear once/);
});

test('rejects invalid pitches, velocities, and chords with too many notes', () => {
    const invalidCases = [
        [1, { ...validScore.tracks[1].events[0], notes: 'H2' }],
        [1, { ...validScore.tracks[1].events[0], velocity: 0 }],
        [0, { ...validScore.tracks[0].events[0], notes: ['A3', 'C4', 'E4', 'G4', 'B4', 'D5'] }],
    ];
    for (const [roleIndex, event] of invalidCases) {
        const tracks = validScore.tracks.map((track, index) => {
            if (index !== roleIndex) return track;
            return { ...track, events: [event, ...track.events.slice(1)] };
        });
        assert.throws(() => parseScore({ ...validScore, tracks }));
    }
});

test('quantizes and orders generated events on the sixteenth-note grid', () => {
    const irregular = validScore.tracks.map((track, index) =>
        index === 2
            ? {
                ...track,
                events: [
                    { ...track.events[1], beat: 2.62, duration: 0.62 },
                    { ...track.events[0], beat: 1.63, duration: 0.62 },
                ],
            }
            : track,
    );
    const parsed = parseScore({ ...validScore, tracks: irregular });
    assert.deepEqual(
        parsed.tracks[2].events.map(({ beat, duration }) => [beat, duration]),
        [[1.75, 0.5], [2.5, 0.5]],
    );
});

test('rejects events that remain invalid after grid normalization', () => {
    const overhanging = validScore.tracks.map((track, index) =>
        index === 1
            ? { ...track, events: [{ ...track.events[0], beat: 15.75, duration: 0.5 }] }
            : track,
    );
    assert.throws(() => parseScore({ ...validScore, tracks: overhanging }), /invalid duration/);

    const outsideLoop = validScore.tracks.map((track, index) =>
        index === 1 ? { ...track, events: [{ ...track.events[0], beat: 16 }] } : track,
    );
    assert.throws(() => parseScore({ ...validScore, tracks: outsideLoop }), /sixteenth-note grid/);
});

test('orders unsorted track events by their normalized beat', () => {
    const unsorted = validScore.tracks.map((track, index) =>
        index === 1 ? { ...track, events: [...track.events].reverse() } : track,
    );
    const parsed = parseScore({ ...validScore, tracks: unsorted });
    assert.deepEqual(parsed.tracks[1].events.map(event => event.beat), [0, 2, 4]);
});

test('rejects responses with invalid JSON', () => {
    assert.throws(() => parseScore('```json\n{bad json}\n```'), /invalid JSON/);
});
