export const INSTRUMENTS = Object.freeze({
    acoustic_bass: 32,
    acoustic_grand_piano: 0,
    acoustic_guitar_nylon: 24,
    alto_sax: 65,
    celesta: 8,
    choir_aahs: 52,
    clarinet: 71,
    contrabass: 43,
    electric_bass_finger: 33,
    electric_guitar_clean: 27,
    electric_piano_1: 4,
    flute: 73,
    french_horn: 60,
    marimba: 12,
    music_box: 10,
    ocarina: 79,
    orchestral_harp: 46,
    pad_1_new_age: 88,
    pad_2_warm: 89,
    pad_4_choir: 91,
    pizzicato_strings: 45,
    recorder: 74,
    string_ensemble_1: 48,
    synth_bass_1: 38,
    synth_strings_1: 50,
    tremolo_strings: 44,
    vibraphone: 11,
    violin: 40,
    voice_oohs: 53,
});

export const REQUIRED_ROLES = Object.freeze(['harmony', 'bass', 'melody']);
export const OPTIONAL_ROLES = Object.freeze(['counter', 'texture']);

export const TRACK_ROLES = Object.freeze({
    harmony: ['electric_piano_1', 'pad_2_warm', 'pad_1_new_age', 'pad_4_choir', 'acoustic_grand_piano', 'vibraphone', 'string_ensemble_1', 'tremolo_strings', 'synth_strings_1', 'choir_aahs'],
    bass: ['acoustic_bass', 'electric_bass_finger', 'synth_bass_1', 'contrabass'],
    melody: ['acoustic_grand_piano', 'electric_piano_1', 'vibraphone', 'marimba', 'celesta', 'music_box', 'acoustic_guitar_nylon', 'electric_guitar_clean', 'flute', 'recorder', 'ocarina', 'clarinet', 'violin', 'french_horn'],
    counter: ['flute', 'clarinet', 'violin', 'french_horn', 'alto_sax', 'voice_oohs', 'electric_guitar_clean', 'vibraphone', 'music_box'],
    texture: ['pad_1_new_age', 'pad_2_warm', 'pad_4_choir', 'string_ensemble_1', 'choir_aahs', 'tremolo_strings', 'synth_strings_1', 'voice_oohs', 'orchestral_harp', 'pizzicato_strings'],
});

export const METERS = Object.freeze({
    '3/4': 3,
    '4/4': 4,
});

export const NOTE_PATTERN = /^[A-G](?:#|b)?[1-6]$/;

// Structured output for the composition call. This is a strict-mode-compliant
// shape envelope (every key required, optionals nullable, closed objects);
// semantic bounds like tempo range or role-instrument pairing stay enforced in
// parseScore because OpenAI strict schemas cannot express numeric bounds.
export const SCORE_JSON_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['tempo', 'meter', 'tracks'],
    properties: {
        tempo: {
            type: 'number',
            description: 'Whole-number tempo from 50 to 130 BPM.',
        },
        meter: {
            type: 'string',
            enum: ['3/4', '4/4'],
        },
        tracks: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['role', 'instrument', 'events'],
                properties: {
                    role: {
                        type: 'string',
                        enum: ['harmony', 'bass', 'melody', 'counter', 'texture'],
                    },
                    instrument: {
                        type: 'string',
                        enum: Object.keys(INSTRUMENTS),
                    },
                    events: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['beat', 'duration', 'velocity', 'notes'],
                            properties: {
                                beat: {
                                    type: 'number',
                                    description: 'Start position in beats on the sixteenth-note grid, 0 to just before the loop length.',
                                },
                                duration: {
                                    type: 'number',
                                    description: 'Length in beats, on the sixteenth-note grid; beat plus duration fits inside the loop.',
                                },
                                velocity: {
                                    type: 'number',
                                    description: 'Integer from 1 to 127.',
                                },
                                notes: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'One to five simultaneous note names like C4, F#3, or Bb4.',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
});

// LLM transports differ: some backends yield a bare JSON string, others the raw
// completion object (e.g. {choices:[{message:{content}}]}). Unwrap every shape
// seen in the wild so the parsers never depend on one transport; returns null
// when the input is not text-like, i.e. an already-parsed object.
export function normalizeResponseText(response) {
    if (typeof response === 'string') {
        return response;
    }
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return null;
    }
    let content;
    if (Array.isArray(response.choices)) {
        const first = response.choices[0] ?? {};
        content = first.message?.content ?? first.text ?? null;
    } else if (response.message && typeof response.message === 'object') {
        content = response.message.content ?? null;
    }
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map(part => (typeof part?.text === 'string' ? part.text : '')).join('');
    }
    return null;
}
const BEAT_GRID = 0.25;
const MAX_NOTES_PER_EVENT = 5;
const MIN_BARS = 3;
// Two minutes at 130 BPM is 260 quarter beats; allow whole bars up to a touch more.
const MAX_LOOP_BEATS = 264;
const MIN_TEMPO = 50;
const MAX_TEMPO = 130;

function getBeatsPerBar(meter) {
    const beatsPerBar = METERS[meter];
    if (!beatsPerBar) {
        throw new Error('Meter must be 3/4 or 4/4.');
    }
    return beatsPerBar;
}

export function getLoopBars(lengthSeconds, tempo, meter = '4/4') {
    if (![15, 30, 60, 90, 120].includes(lengthSeconds)) {
        throw new Error('Loop duration must be one of the available presets.');
    }
    if (!Number.isInteger(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO) {
        throw new Error(`Tempo must be a whole number from ${MIN_TEMPO} to ${MAX_TEMPO} BPM.`);
    }
    return Math.max(MIN_BARS, Math.round(lengthSeconds * tempo / 60 / getBeatsPerBar(meter)));
}

export function getApproximateDuration(bars, tempo, meter = '4/4') {
    return Math.round(bars * getBeatsPerBar(meter) * 60 / tempo);
}

function quantizeToBeatGrid(value) {
    return Math.round(value / BEAT_GRID) * BEAT_GRID;
}

// Accepts quoted numbers from sloppy model output; null when unusable.
function normalizeNumber(value) {
    const candidate = typeof value === 'string' ? value.trim() : value;
    if (candidate === null || candidate === undefined || candidate === '') {
        return null;
    }
    const number = Number(candidate);
    return Number.isFinite(number) ? number : null;
}

function normalizeNoteOctave(note, role) {
    const [, pitch, octaveText] = note.match(/^([A-G](?:#|b)?)([1-6])$/);
    const octave = Number(octaveText);
    const [minimum, maximum] = role === 'bass'
        ? [1, 2]
        : role === 'harmony' || role === 'texture'
            ? [2, 6]
            : [3, 6];
    const normalizedOctave = Math.max(minimum, Math.min(maximum, octave));
    return `${pitch}${normalizedOctave}`;
}

export function parseScore(response, {
    loopBeats = 16,
    meter = '4/4',
    targetTempo,
} = {}) {
    const beatsPerBar = getBeatsPerBar(meter);

    if (!Number.isInteger(loopBeats)
        || loopBeats < MIN_BARS * beatsPerBar
        || loopBeats > MAX_LOOP_BEATS
        || loopBeats % beatsPerBar !== 0) {
        throw new Error('Loop length must be a whole number of bars from 3 bars up to the two-minute preset.');
    }

    const text = normalizeResponseText(response);
    let value = response;

    if (text !== null) {
        const cleaned = text
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start < 0 || end < start) {
            throw new Error('The model response did not contain a JSON score.');
        }

        try {
            value = JSON.parse(cleaned.slice(start, end + 1));
        } catch (error) {
            throw new Error(`The model returned invalid JSON: ${error.message}`);
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The score must be a JSON object.');
    }
    // An API payload that never unwrapped to text is a failed extraction,
    // not a score: fail with the malformed-JSON error so the caller can retry.
    if (text === null && (Array.isArray(value.choices) || (value.message && typeof value.message === 'object'))) {
        throw new Error('The model response did not contain a JSON score.');
    }

    if (!Number.isFinite(value.tempo) || value.tempo < MIN_TEMPO || value.tempo > MAX_TEMPO) {
        throw new Error(`Score tempo must be a number from ${MIN_TEMPO} to ${MAX_TEMPO} BPM.`);
    }

    if (targetTempo !== undefined
        && (!Number.isInteger(targetTempo) || targetTempo < MIN_TEMPO || targetTempo > MAX_TEMPO)) {
        throw new Error(`Target tempo must be a whole number from ${MIN_TEMPO} to ${MAX_TEMPO} BPM.`);
    }

    if (!Array.isArray(value.tracks)
        || value.tracks.length < REQUIRED_ROLES.length
        || value.tracks.length > REQUIRED_ROLES.length + OPTIONAL_ROLES.length) {
        throw new Error('The score must contain harmony, bass, and melody tracks, optionally with counter and texture tracks.');
    }

    const seenRoles = new Set();
    const tracks = value.tracks.map((track, index) => {
        if (!track || typeof track !== 'object' || Array.isArray(track)) {
            throw new Error(`Track ${index + 1} must be an object.`);
        }

        if (!Object.hasOwn(TRACK_ROLES, track.role)) {
            throw new Error(`Track ${index + 1} uses an unsupported role.`);
        }
        if (seenRoles.has(track.role)) {
            throw new Error(`The ${track.role} role can only appear once.`);
        }
        seenRoles.add(track.role);

        // Instruments are chosen by the model per generation: any known patch
        // is valid on any role (the role only fixes the octave range). A
        // hallucinated instrument falls back to the role's first palette
        // entry so a naming slip can never fail the generation.
        let instrument = track.instrument;
        if (!Object.hasOwn(INSTRUMENTS, instrument)) {
            instrument = TRACK_ROLES[track.role][0];
            console.warn(`[Leitmotif] Track ${index + 1} named an unknown instrument; using ${instrument} instead.`);
        }

        if (!Array.isArray(track.events)
            || track.events.length < 1
            || track.events.length > loopBeats * 3) {
            throw new Error(`Track ${index + 1} must contain 1 to ${loopBeats * 3} timed events.`);
        }

        // Events are normalized fail-soft: model slips are repaired or dropped
        // with a warning (strays across the loop seam, quoted numbers, odd note
        // names) so one bad event can never kill a whole generation. Only a
        // track without any usable event left is an error.
        const adjustedEvents = [];
        const events = track.events
            .map((event, eventIndex) => {
                if (!event || typeof event !== 'object' || Array.isArray(event)) {
                    throw new Error(`Track ${index + 1}, event ${eventIndex + 1} must be an object.`);
                }

                const rawBeat = normalizeNumber(event.beat);
                if (rawBeat === null) {
                    console.warn(`[Leitmotif] Track ${index + 1}, event ${eventIndex + 1} has no usable beat; dropped the event.`);
                    return null;
                }
                // A loop's seam joins its end to its start, so a beat just past
                // either edge belongs on the other side of the seam: wrap it.
                const beat = quantizeToBeatGrid(((quantizeToBeatGrid(rawBeat) % loopBeats) + loopBeats) % loopBeats);
                const rawDuration = normalizeNumber(event.duration) ?? 1;
                const duration = Math.min(quantizeToBeatGrid(Math.max(rawDuration, BEAT_GRID)), loopBeats - beat);
                const velocity = Math.min(127, Math.max(1, Math.round(normalizeNumber(event.velocity) ?? 100)));

                const rawNotes = typeof event.notes === 'string' ? [event.notes] : event.notes;
                const usableNotes = (Array.isArray(rawNotes) ? rawNotes : [])
                    .filter(note => typeof note === 'string')
                    .map(note => note.trim().replace(/^([a-g])/, letter => letter.toUpperCase()))
                    .filter(note => NOTE_PATTERN.test(note));
                if (usableNotes.length === 0) {
                    console.warn(`[Leitmotif] Track ${index + 1}, event ${eventIndex + 1} has no usable notes; dropped the event.`);
                    return null;
                }
                if (usableNotes.length > MAX_NOTES_PER_EVENT) {
                    console.warn(`[Leitmotif] Track ${index + 1}, event ${eventIndex + 1} named ${usableNotes.length} notes; kept the first ${MAX_NOTES_PER_EVENT}.`);
                }
                const pitches = usableNotes.slice(0, MAX_NOTES_PER_EVENT);
                const transposedPitches = pitches.map(note => normalizeNoteOctave(note, track.role));
                const normalizedPitches = [...new Set(transposedPitches)];
                if (transposedPitches.some((note, noteIndex) => note !== pitches[noteIndex])) {
                    adjustedEvents.push({
                        event: eventIndex + 1,
                        original: pitches,
                        normalized: transposedPitches,
                    });
                }

                return { beat, duration, velocity, notes: normalizedPitches };
            })
            .filter(Boolean)
            .sort((left, right) => left.beat - right.beat);

        if (events.length === 0) {
            throw new Error(`Track ${index + 1} has no usable events.`);
        }

        if (adjustedEvents.length > 0) {
            console.warn(
                `[Leitmotif] Adjusted note octaves for ${track.role} track ${index + 1} on ${adjustedEvents.length} event(s) to fit the track range.`,
                adjustedEvents,
            );
        }

        return {
            role: track.role,
            instrument,
            events,
        };
    });

    if (REQUIRED_ROLES.some(role => !seenRoles.has(role))) {
        throw new Error('The score must contain harmony, bass, and melody tracks.');
    }

    return {
        tempo: targetTempo ?? value.tempo,
        loopBeats,
        meter,
        tracks,
    };
}
