export const INSTRUMENTS = Object.freeze({
    acoustic_bass: 32,
    acoustic_grand_piano: 0,
    electric_piano_1: 4,
    pad_2_warm: 89,
});

export const TRACK_ROLES = Object.freeze({
    harmony: ['electric_piano_1', 'pad_2_warm'],
    bass: ['acoustic_bass'],
    melody: ['acoustic_grand_piano', 'electric_piano_1'],
});

const NOTE_PATTERN = /^[A-G](?:#|b)?[1-6]$/;
const LOOP_LENGTHS = [16, 32, 64];
const BEAT_GRID = 0.25;
const MAX_NOTES_PER_EVENT = 5;

function isOnBeatGrid(value) {
    return Math.abs(value / BEAT_GRID - Math.round(value / BEAT_GRID)) < 1e-8;
}

export function parseScore(response, { loopBeats = 16, targetTempo } = {}) {
    if (!LOOP_LENGTHS.includes(loopBeats)) {
        throw new Error('Loop length must be 4, 8, or 16 bars.');
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

        if (!TRACK_ROLES[track.role].includes(track.instrument)) {
            throw new Error(`Track ${index + 1} uses an instrument that does not match its role.`);
        }

        if (!Array.isArray(track.events)
            || track.events.length < 1
            || track.events.length > loopBeats * 3) {
            throw new Error(`Track ${index + 1} must contain 1 to ${loopBeats * 3} timed events.`);
        }

        let previousBeat = -1;
        const events = track.events.map((event, eventIndex) => {
            if (!event || typeof event !== 'object' || Array.isArray(event)) {
                throw new Error(`Track ${index + 1}, event ${eventIndex + 1} must be an object.`);
            }

            const { beat, duration, velocity } = event;
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

            const allowedOctaves = track.role === 'bass'
                ? /^[A-G](?:#|b)?[12]$/
                : track.role === 'harmony'
                    ? /^[A-G](?:#|b)?[2-6]$/
                    : /^[A-G](?:#|b)?[3-6]$/;
            if (!pitches.every(note => allowedOctaves.test(note))) {
                throw new Error(`Track ${index + 1}, event ${eventIndex + 1} note octave does not match its role.`);
            }

            return { beat, duration, velocity, notes: [...pitches] };
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
