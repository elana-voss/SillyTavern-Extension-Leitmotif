export const INSTRUMENTS = Object.freeze({
    acoustic_bass: 32,
    acoustic_grand_piano: 0,
    electric_bass_finger: 33,
    electric_piano_1: 4,
    flute: 73,
    pad_2_warm: 89,
    vibraphone: 11,
});

export const TRACK_ROLES = Object.freeze({
    harmony: ['electric_piano_1', 'pad_2_warm', 'acoustic_grand_piano', 'vibraphone'],
    bass: ['acoustic_bass', 'electric_bass_finger'],
    melody: ['acoustic_grand_piano', 'electric_piano_1', 'vibraphone', 'flute'],
});

const NOTE_PATTERN = /^[A-G](?:#|b)?[1-6]$/;
const BEAT_GRID = 0.25;
const MAX_NOTES_PER_EVENT = 5;

export function getLoopBars(lengthSeconds, tempo) {
    if (![15, 30, 60, 90, 120].includes(lengthSeconds)) {
        throw new Error('Loop duration must be one of the available presets.');
    }
    if (!Number.isInteger(tempo) || tempo < 65 || tempo > 85) {
        throw new Error('Tempo must be a whole number from 65 to 85 BPM.');
    }
    return Math.max(4, Math.round(lengthSeconds * tempo / 240));
}

export function getApproximateDuration(bars, tempo) {
    return Math.round(bars * 4 * 60 / tempo);
}

function isOnBeatGrid(value) {
    return Math.abs(value / BEAT_GRID - Math.round(value / BEAT_GRID)) < 1e-8;
}

function quantizeToBeatGrid(value) {
    return Math.round(value / BEAT_GRID) * BEAT_GRID;
}

function normalizeNoteOctave(note, role) {
    const [, pitch, octaveText] = note.match(/^([A-G](?:#|b)?)([1-6])$/);
    const octave = Number(octaveText);
    const [minimum, maximum] = role === 'bass'
        ? [1, 2]
        : role === 'harmony'
            ? [2, 6]
            : [3, 6];
    const normalizedOctave = Math.max(minimum, Math.min(maximum, octave));
    return `${pitch}${normalizedOctave}`;
}

export function parseScore(response, {
    loopBeats = 16,
    targetTempo,
    instrumentOptions = TRACK_ROLES,
} = {}) {
    if (!Number.isInteger(loopBeats) || loopBeats < 16 || loopBeats > 176 || loopBeats % 4 !== 0) {
        throw new Error('Loop length must be a whole number of bars from 4 to 44.');
    }

    let value = response;

    if (typeof response === 'string') {
        const cleaned = response
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

    if (!Number.isFinite(value.tempo) || value.tempo < 65 || value.tempo > 85) {
        throw new Error('Score tempo must be a number from 65 to 85 BPM.');
    }

    if (targetTempo !== undefined
        && (!Number.isInteger(targetTempo) || targetTempo < 65 || targetTempo > 85)) {
        throw new Error('Target tempo must be a whole number from 65 to 85 BPM.');
    }

    if (!Array.isArray(value.tracks) || value.tracks.length !== 3) {
        throw new Error('The score must contain harmony, bass, and melody tracks.');
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

        const allowedInstruments = instrumentOptions[track.role];
        if (!Array.isArray(allowedInstruments)
            || allowedInstruments.length === 0
            || !allowedInstruments.every(instrument => TRACK_ROLES[track.role].includes(instrument))) {
            throw new Error(`Track ${index + 1} has no valid instruments configured for its role.`);
        }

        if (!allowedInstruments.includes(track.instrument)) {
            throw new Error(`Track ${index + 1} uses an instrument that does not match its role.`);
        }

        if (!Array.isArray(track.events)
            || track.events.length < 1
            || track.events.length > loopBeats * 3) {
            throw new Error(`Track ${index + 1} must contain 1 to ${loopBeats * 3} timed events.`);
        }

        let previousBeat = -1;
        const events = [...track.events]
            .sort((left, right) => {
                if (!Number.isFinite(left?.beat) || !Number.isFinite(right?.beat)) {
                    return 0;
                }
                return quantizeToBeatGrid(left.beat) - quantizeToBeatGrid(right.beat);
            })
            .map((event, eventIndex) => {
                if (!event || typeof event !== 'object' || Array.isArray(event)) {
                    throw new Error(`Track ${index + 1}, event ${eventIndex + 1} must be an object.`);
                }

                const beat = Number.isFinite(event.beat) ? quantizeToBeatGrid(event.beat) : event.beat;
                const duration = Number.isFinite(event.duration) ? quantizeToBeatGrid(event.duration) : event.duration;
                const { velocity } = event;
                if (!Number.isFinite(beat)
                    || beat < 0
                    || beat >= loopBeats
                    || !isOnBeatGrid(beat)
                    || beat < previousBeat) {
                    throw new Error(`Track ${index + 1} events must be ordered on the sixteenth-note grid within the loop.`);
                }
                previousBeat = beat;

                if (!Number.isFinite(duration)
                    || duration < BEAT_GRID
                    || !isOnBeatGrid(duration)
                    || beat + duration > loopBeats) {
                    throw new Error(`Track ${index + 1}, event ${eventIndex + 1} has an invalid duration.`);
                }

                if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127) {
                    throw new Error(`Track ${index + 1}, event ${eventIndex + 1} velocity must be an integer from 1 to 127.`);
                }

                const pitches = typeof event.notes === 'string' ? [event.notes] : event.notes;
                if (!Array.isArray(pitches)
                    || pitches.length < 1
                    || pitches.length > MAX_NOTES_PER_EVENT
                    || !pitches.every(note => typeof note === 'string' && NOTE_PATTERN.test(note))) {
                    throw new Error(`Track ${index + 1}, event ${eventIndex + 1} contains invalid notes.`);
                }

                const transposedPitches = pitches.map(note => normalizeNoteOctave(note, track.role));
                const normalizedPitches = [...new Set(transposedPitches)];
                if (transposedPitches.some((note, noteIndex) => note !== pitches[noteIndex])) {
                    console.warn(
                        `[MidiVibeComposer] Adjusted note octaves for ${track.role} track ${index + 1}, event ${eventIndex + 1}.`,
                        { original: pitches, normalized: transposedPitches },
                    );
                }

                return { beat, duration, velocity, notes: normalizedPitches };
            });

        return {
            role: track.role,
            instrument: track.instrument,
            events,
        };
    });

    if (seenRoles.size !== Object.keys(TRACK_ROLES).length) {
        throw new Error('The score must contain one harmony, one bass, and one melody track.');
    }

    return {
        tempo: targetTempo ?? value.tempo,
        loopBeats,
        tracks,
    };
}
