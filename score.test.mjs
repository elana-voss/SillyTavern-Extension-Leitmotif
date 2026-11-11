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
        meter: '4/4',
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
    for (const tempo of [85, 130]) {
        const bars = getLoopBars(120, tempo);
        const expectedBars = Math.round(120 * tempo / 240);
        assert.equal(bars, expectedBars);
        const longScore = {
            ...validScore,
            tracks: validScore.tracks.map((track, index) => index === 1
                ? {
                    ...track,
                    events: [{ beat: bars * 4 - 1, duration: 1, velocity: 80, notes: 'A1' }],
                }
                : track),
        };
        const parsed = parseScore(longScore, { loopBeats: bars * 4, targetTempo: tempo });
        assert.equal(parsed.loopBeats, bars * 4);
        assert.ok(Math.abs(getApproximateDuration(bars, tempo) - 120) <= 2);
    }
});

test('maps duration presets to the nearest whole-bar loop at the selected tempo', () => {
    for (const seconds of [15, 30, 60, 90, 120]) {
        for (const tempo of [50, 74, 130]) {
            for (const meter of ['3/4', '4/4']) {
                const bars = getLoopBars(seconds, tempo, meter);
                assert.ok(bars >= 3);
                assert.ok(Math.abs(getApproximateDuration(bars, tempo, meter) - seconds) <= 3);
            }
        }
    }
    assert.throws(() => getLoopBars(45, 74), /available presets/);
    assert.throws(() => getLoopBars(30, 140), /50 to 130/);
    assert.throws(() => getLoopBars(30, 74.5), /50 to 130/);
    assert.throws(() => getLoopBars(30, 74, '5/4'), /Meter must be/);
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
        'acoustic_guitar_nylon',
        'alto_sax',
        'celesta',
        'choir_aahs',
        'clarinet',
        'contrabass',
        'electric_bass_finger',
        'electric_guitar_clean',
        'electric_piano_1',
        'flute',
        'french_horn',
        'marimba',
        'music_box',
        'ocarina',
        'orchestral_harp',
        'pad_1_new_age',
        'pad_2_warm',
        'pad_4_choir',
        'pizzicato_strings',
        'recorder',
        'string_ensemble_1',
        'synth_bass_1',
        'synth_strings_1',
        'tremolo_strings',
        'vibraphone',
        'violin',
        'voice_oohs',
    ]);
    assert.deepEqual(Object.keys(TRACK_ROLES), ['harmony', 'bass', 'melody', 'counter', 'texture']);
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
    assert.throws(() => parseScore({ ...validScore, tempo: 131 }), /tempo/);
    assert.throws(() => parseScore({ ...validScore, tempo: 50 - 1 }), /tempo/);
    assert.ok(parseScore({ ...validScore, tempo: 50 }));
    assert.ok(parseScore({ ...validScore, tempo: 130 }));
    assert.throws(() => parseScore({ ...validScore, tracks: validScore.tracks.slice(0, 2) }), /harmony, bass, and melody/);
    assert.throws(() => parseScore({
        ...validScore,
        tracks: [validScore.tracks[0], validScore.tracks[1], { ...validScore.tracks[2], role: 'bass', instrument: 'acoustic_bass' }],
    }), /can only appear once/);
});

test('accepts optional counter and texture tracks in 3/4 meter', () => {
    const fiveTrackScore34 = {
        ...validScore,
        tracks: [
            { ...validScore.tracks[0], events: validScore.tracks[0].events.slice(0, 3) },
            ...validScore.tracks.slice(1),
            {
                role: 'counter',
                instrument: 'clarinet',
                events: [
                    { beat: 0.5, duration: 0.5, velocity: 60, notes: 'E5' },
                    { beat: 4.5, duration: 0.5, velocity: 54, notes: 'D5' },
                ],
            },
            {
                role: 'texture',
                instrument: 'pad_2_warm',
                events: [
                    { beat: 0, duration: 6, velocity: 44, notes: ['A3', 'E4'] },
                    { beat: 6, duration: 6, velocity: 40, notes: ['C4', 'G3'] },
                ],
            },
        ],
    };
    const parsed = parseScore(fiveTrackScore34, { meter: '3/4', loopBeats: 12 });
    assert.equal(parsed.meter, '3/4');
    assert.equal(parsed.tracks.length, 5);
    assert.deepEqual(parsed.tracks.map(track => track.role), ['harmony', 'bass', 'melody', 'counter', 'texture']);
    assert.deepEqual(parsed.tracks[4].events[0].notes, ['A3', 'E4']);
});

test('rejects duplicated optional roles and unsupported meters', () => {
    const extraTexture = {
        ...validScore,
        tracks: [
            ...validScore.tracks,
            { role: 'texture', instrument: 'pad_1_new_age', events: validScore.tracks[0].events.slice(0, 1) },
            { role: 'texture', instrument: 'choir_aahs', events: validScore.tracks[0].events.slice(0, 1) },
        ],
    };
    assert.throws(() => parseScore(extraTexture), /can only appear once/);
    assert.throws(() => parseScore(validScore, { meter: '5/4' }), /Meter must be/);
    assert.throws(() => parseScore(validScore, { meter: '4/4', loopBeats: 8 }), /whole number of bars/);
    assert.ok(parseScore(validScore, { meter: '4/4', loopBeats: 16 }));
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
