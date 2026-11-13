// MIDI export: the score written as a type-1 MIDI file with MidiWriter (one
// track per role, 128 ticks per beat) and offered as a download.
import { INSTRUMENTS } from './score.mjs';

const TICKS_PER_BEAT = 128;

export function getMidiFileName(characterName) {
    const safeName = characterName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'character';
    return `${safeName}-theme.mid`;
}

function buildTracks(MidiWriter, score) {
    return score.tracks.map((composition, index) => {
        const track = new MidiWriter.Track();
        const channel = index + 1;
        track.addTrackName(composition.role);
        track.setTempo(score.tempo);
        track.addEvent(new MidiWriter.ProgramChangeEvent({
            instrument: INSTRUMENTS[composition.instrument],
            channel,
        }));
        for (const event of composition.events) {
            track.addEvent(new MidiWriter.NoteEvent({
                pitch: event.notes,
                startTick: Math.round(event.beat * TICKS_PER_BEAT),
                duration: `T${Math.round(event.duration * TICKS_PER_BEAT)}`,
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
