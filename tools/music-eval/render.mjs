// Turns each generated score into a reader's view: all tracks side by side per
// bar, plus counted facts (key fit, range, repetition, rhythm, clashes, motif
// recurrence, the loop seam). Usage: node render.mjs <run dir> -> <run dir>/views/*.txt
import fs from 'node:fs';
import path from 'node:path';
import { DRUMS_ROLE, METERS } from '../../src/score.mjs';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' };
function midi(note) {
    const [, name, octave] = note.match(/^([A-G][#b]?)(\d)$/);
    const sharp = FLAT[name] ?? name;
    let pitch = NAMES.indexOf(sharp) + 12 * (Number(octave) + 1);
    if (name === 'Cb') pitch -= 12;
    if (name === 'B#') pitch += 12;
    return pitch;
}
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function bestScale(pitchWeights) {
    let best = null;
    for (let root = 0; root < 12; root += 1) {
        for (const [mode, steps] of [['major', MAJOR], ['minor', MINOR]]) {
            const set = new Set(steps.map(step => (root + step) % 12));
            const inside = pitchWeights.reduce((sum, weight, pc) => sum + (set.has(pc) ? weight : 0), 0);
            if (!best || inside > best.inside) best = { name: `${NAMES[root]} ${mode}`, inside };
        }
    }
    const total = pitchWeights.reduce((a, b) => a + b, 0);
    return `${best.name} (${Math.round(100 * best.inside / total)}% of note-beats inside)`;
}

function render(record) {
    const { score, brief } = record;
    const out = [];
    const beatsPerBar = METERS[score.meter];
    const bars = score.loopBeats / beatsPerBar;
    out.push(`${record.character} | model hidden | ${score.meter}, ${score.tempo} BPM, ${bars} bars, ${score.tracks.length} tracks`);
    out.push(`tracks: ${score.tracks.map(t => `${t.role}=${t.instrument}`).join(', ')}`);
    if (brief) {
        out.push(`brief: key ${brief.key ?? '-'}, mode ${brief.mode ?? '-'}, feel ${brief.feel}, density ${brief.density}, energy ${brief.energyCurve.join('>')}`);
        out.push(`brief motif: ${brief.motif ? `${brief.motif.notes.join(' ')} / ${brief.motif.rhythm.join(' ')}` : 'none'}; surprise: ${brief.surprise ?? '-'}`);
    } else {
        out.push('brief: none (analysis failed)');
    }
    out.push('', 'FACTS');
    const weights = new Array(12).fill(0);
    // Drum names have no pitch: the drums track is left out of key, range and clashes.
    const pitched = score.tracks.filter(track => track.role !== DRUMS_ROLE);
    for (const track of pitched) {
        for (const event of track.events) for (const note of event.notes) weights[midi(note) % 12] += event.duration;
    }
    out.push(`key fit: ${bestScale(weights)}`);
    for (const track of score.tracks) {
        if (track.role === DRUMS_ROLE) {
            out.push(`drums: ${track.events.length} events, ${[...new Set(track.events.flatMap(e => e.notes))].join(' ')}`);
            continue;
        }
        const pitches = track.events.flatMap(event => event.notes.map(midi));
        const sounding = new Array(score.loopBeats * 4).fill(false);
        for (const event of track.events) {
            for (let s = event.beat * 4; s < (event.beat + event.duration) * 4 && s < sounding.length; s += 1) sounding[s] = true;
        }
        const barKeys = [];
        for (let bar = 0; bar < bars; bar += 1) {
            barKeys.push(JSON.stringify(track.events
                .filter(e => e.beat >= bar * beatsPerBar && e.beat < (bar + 1) * beatsPerBar)
                .map(e => [e.beat - bar * beatsPerBar, e.duration, e.notes])));
        }
        const durations = new Set(track.events.map(e => e.duration));
        const line = [`${track.role}: ${track.events.length} events, range ${NAMES[Math.min(...pitches) % 12]}${Math.floor(Math.min(...pitches) / 12) - 1}-${NAMES[Math.max(...pitches) % 12]}${Math.floor(Math.max(...pitches) / 12) - 1}`,
            `sounding ${Math.round(100 * sounding.filter(Boolean).length / sounding.length)}% of the loop`,
            `${new Set(barKeys).size}/${bars} distinct bars`, `${durations.size} distinct durations`];
        if (track.role === 'melody' || track.role === 'counter') {
            const top = track.events.map(e => Math.max(...e.notes.map(midi)));
            const steps = top.slice(1).map((p, i) => Math.abs(p - top[i]));
            line.push(`largest leap ${Math.max(0, ...steps)} semitones`, `${Math.round(100 * steps.filter(s => s <= 2).length / Math.max(1, steps.length))}% steps`);
            if (brief?.motif) {
                const motif = brief.motif.notes.map(midi);
                const shape = motif.slice(1).map((p, i) => p - motif[i]).join(',');
                const inverted = motif.slice(1).map((p, i) => motif[i] - p).join(',');
                let exact = 0;
                let inv = 0;
                for (let i = 0; i + motif.length <= top.length; i += 1) {
                    const window = top.slice(i, i + motif.length);
                    const ints = window.slice(1).map((p, k) => p - window[k]).join(',');
                    if (ints === shape) exact += 1;
                    if (ints === inverted) inv += 1;
                }
                line.push(`motif intervals found ${exact}x, inverted ${inv}x`);
            }
        }
        out.push(line.join('; '));
    }
    let clashes = 0;
    for (let s = 0; s < score.loopBeats * 4; s += 1) {
        const beat = s / 4;
        const ringing = pitched.flatMap(t => t.events.filter(e => e.beat <= beat && beat < e.beat + e.duration).flatMap(e => e.notes.map(n => ({ role: t.role, p: midi(n) }))));
        for (let a = 0; a < ringing.length; a += 1) {
            for (let b = a + 1; b < ringing.length; b += 1) {
                if (ringing[a].role !== ringing[b].role && [1, 11].includes(Math.abs(ringing[a].p - ringing[b].p) % 12)) clashes += 1;
            }
        }
    }
    out.push(`semitone clashes between tracks: ${clashes} sixteenth-note slots x pairs`);
    const melody = score.tracks.find(t => t.role === 'melody');
    const last = melody.events.at(-1);
    out.push(`loop seam: melody ends ${last.notes.join('+')} at beat ${last.beat}+${last.duration}, restarts ${melody.events[0].notes.join('+')} at beat ${melody.events[0].beat}`);
    out.push('', `BARS (beat-in-bar note(duration) velocity)`);
    for (let bar = 0; bar < bars; bar += 1) {
        out.push(`bar ${bar + 1}`);
        for (const track of score.tracks) {
            const events = track.events.filter(e => e.beat >= bar * beatsPerBar && e.beat < (bar + 1) * beatsPerBar);
            out.push(`  ${track.role.padEnd(8)} ${events.map(e => `${e.beat - bar * beatsPerBar}:${e.notes.join('+')}(${e.duration})v${e.velocity}`).join('  ') || '-'}`);
        }
    }
    return out.join('\n');
}

const runDir = process.argv[2];
const viewDir = path.join(runDir, 'views');
fs.mkdirSync(viewDir, { recursive: true });
const files = fs.readdirSync(runDir).filter(f => f.endsWith('.json'))
    .sort((a, b) => a.split('--')[1].localeCompare(b.split('--')[1]) || a.localeCompare(b));
const key = [];
files.forEach((file, index) => {
    const record = JSON.parse(fs.readFileSync(path.join(runDir, file), 'utf8'));
    const id = `theme-${String.fromCharCode(65 + index)}`;
    key.push(`${id} ${file}`);
    const body = record.score ? render(record) : `${record.character}: no score (${record.failure})`;
    const usage = record.calls.map(c => `${c.stage} out ${c.usage.output_tokens} tok, stop ${c.stop}`).join('; ');
    fs.writeFileSync(path.join(viewDir, `${id}.txt`), `${body}\n\ncalls: ${usage}\n`);
});
fs.writeFileSync(path.join(runDir, 'key.txt'), key.join('\n'));
console.log(`${files.length} views written`);
