import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTracks, getMidiFileName } from '../src/midi-export.mjs';

test('MIDI file name replaces characters a file name cannot hold, the backslash included', () => {
    assert.equal(getMidiFileName('A\\B/C:D'), 'A_B_C_D-theme.mid');
});

// A stand-in for the MidiWriter global that records what the export adds.
const FakeMidiWriter = {
    Track: class {
        constructor() {
            this.events = [];
        }
        addTrackName(name) {
            this.name = name;
        }
        setTempo(tempo) {
            this.tempo = tempo;
        }
        addEvent(event) {
            this.events.push(event);
        }
    },
    ProgramChangeEvent: class {
        constructor(fields) {
            Object.assign(this, fields, { kind: 'program' });
        }
    },
    NoteEvent: class {
        constructor(fields) {
            Object.assign(this, fields, { kind: 'note' });
        }
    },
};

const melody = { role: 'melody', instrument: 'flute', events: [] };

test('drums export on channel 10 with GM drum numbers and no program change', () => {
    const drums = { role: 'drums', instrument: 'drum_kit', events: [
        { beat: 0, duration: 0.25, velocity: 127, notes: ['kick', 'closed_hat'] },
        { beat: 1, duration: 0.25, velocity: 127, notes: ['snare', 'rim', 'clap', 'open_hat', 'low_tom', 'high_tom', 'crash', 'ride'] },
    ] };
    const [, track] = buildTracks(FakeMidiWriter, { tempo: 90, feel: 'straight', loopBeats: 16, tracks: [melody, drums] });
    assert.equal(track.events.some(event => event.kind === 'program'), false);
    assert.ok(track.events.every(event => event.channel === 10));
    assert.deepEqual(track.events.map(event => event.pitch), [[36, 42], [38, 37, 39, 46, 45, 50, 49, 51]]);
});

test('a swung repeated same-pitch eighth line never ends a note after the next one starts', () => {
    const events = Array.from({ length: 8 }, (_, index) => ({ beat: index / 2, duration: 0.5, velocity: 90, notes: ['C4'] }));
    const [track] = buildTracks(FakeMidiWriter, { tempo: 90, feel: 'swing', loopBeats: 16, tracks: [{ ...melody, events }] });
    const notes = track.events.filter(event => event.kind === 'note');
    assert.equal(notes[0].channel, 1);
    assert.deepEqual(notes.slice(0, 2).map(note => note.startTick), [0, 85]);
    for (let index = 0; index + 1 < notes.length; index += 1) {
        const end = notes[index].startTick + Number(notes[index].duration.slice(1));
        assert.ok(end <= notes[index + 1].startTick, `note ${index} ends at ${end} after ${notes[index + 1].startTick}`);
    }
});
