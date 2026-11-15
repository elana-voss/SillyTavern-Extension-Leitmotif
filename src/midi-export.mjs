// MIDI export: the score written as a type-1 MIDI file with MidiWriter (one
// track per role, 128 ticks per beat) and offered as a download. Swing is
// written into the note times; humanisation is not, so the file stays exact.
// The drums track goes on General MIDI's drum channel 10 with no program.
import { DRUM_NOTES, DRUMS_ROLE, INSTRUMENTS } from './score.mjs';
import { swingEvent } from './timing.mjs';

const TICKS_PER_BEAT = 128;
const DRUM_CHANNEL = 10;

export function getMidiFileName(characterName) {
    const safeName = characterName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'character';
    return `${safeName}-theme.mid`;
}

// Pitched tracks take channels 1-9 in order; channel 10 is reserved for drums.
export function buildTracks(MidiWriter, score) {
    let nextChannel = 1;
    return score.tracks.map(composition => {
        const track = new MidiWriter.Track();
        const drums = composition.role === DRUMS_ROLE;
        const channel = drums ? DRUM_CHANNEL : nextChannel++;
        track.addTrackName(composition.role);
        track.setTempo(score.tempo);
        if (!drums) {
            track.addEvent(new MidiWriter.ProgramChangeEvent({
                instrument: INSTRUMENTS[composition.instrument],
                channel,
            }));
        }
        for (const event of composition.events) {
            const { beat, duration } = swingEvent(event.beat, event.duration, score.feel);
            // Start and end round on their own, so a note ending where the next
            // begins never spills past that note's start.
            const startTick = Math.round(beat * TICKS_PER_BEAT);
            const endTick = Math.round((beat + duration) * TICKS_PER_BEAT);
            track.addEvent(new MidiWriter.NoteEvent({
                pitch: drums ? event.notes.map(name => DRUM_NOTES[name]) : event.notes,
                startTick,
                duration: `T${Math.max(1, endTick - startTick)}`,
                velocity: Math.max(1, Math.round(event.velocity * 100 / 127)),
                channel,
            }));
        }
        return track;
    });
}

// MidiWriter: the library's global, loaded by the caller.
export function downloadScoreAsMidi(MidiWriter, score, characterName) {
    const writer = new MidiWriter.Writer(buildTracks(MidiWriter, score));
    const link = document.createElement('a');
    link.href = writer.dataUri();
    link.download = getMidiFileName(characterName);
    document.body.append(link);
    link.click();
    link.remove();
}
