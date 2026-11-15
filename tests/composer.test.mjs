// Tests for composer.mjs: the score prompt built from the brief and the profile.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getComposerPrompt, getComposerRetryPrompt, getScoreResponseLength, INSTRUMENT_LABELS } from '../src/composer.mjs';
import { parseBrief, sampleVarietySeed } from '../src/brief.mjs';
import { INSTRUMENTS } from '../src/score.mjs';

const character = { name: 'Vera & <Co>', profileFields: '<description>\nFrozen harbor\n</description>' };
const options = { brief: null, bars: 8, loopBeats: 24, tempo: 92, meter: '3/4', varietySeed: null };

test('the composer prompt binds tempo, meter and loop length and carries the profile once escaped', () => {
    const prompt = getComposerPrompt(character, options);
    assert.ok(prompt.includes('Set the tempo to exactly 92 BPM and the meter to exactly "3/4"'));
    assert.ok(prompt.includes('Compose a 8-bar 3/4 loop lasting exactly 24 beats'));
    assert.ok(prompt.includes('{"tempo":92,"meter":"3/4"'));
    assert.ok(prompt.includes('<name>Vera &amp; &lt;Co&gt;</name>'));
    assert.ok(prompt.includes('<description>\nFrozen harbor\n</description>'));
    assert.match(prompt, /<music_brief>none/);
    assert.match(prompt, /Invent one short, memorable motif/);
    assert.doesNotMatch(prompt, /<variation_seed>/);
});

test('the composer prompt follows the brief motif and the variety seed', () => {
    const brief = parseBrief('{"key":"D","motif":{"notes":["A3","C4"],"rhythm":[1,1],"character":"a call"}}');
    const seed = sampleVarietySeed('standard', () => 0);
    assert.ok(brief?.motif && seed);
    const prompt = getComposerPrompt(character, { ...options, brief, varietySeed: seed });
    assert.match(prompt, /The motif in <motif> is this character's leitmotif/);
    assert.match(prompt, /<music_brief>[\s\S]*A3 C4/);
    assert.match(prompt, /<variation_seed>era bias: /);
});

test('every instrument has a label', () => {
    for (const name of Object.keys(INSTRUMENTS)) {
        assert.equal(typeof INSTRUMENT_LABELS[name], 'string', name);
    }
    assert.equal(INSTRUMENT_LABELS.acoustic_grand_piano, 'Grand piano');
    assert.equal(INSTRUMENT_LABELS.lead_8_bass__lead, 'Lead 8 Bass lead');
});

test('the score reply has room to think and to write every bar, also on the retry', () => {
    assert.equal(getScoreResponseLength(8), 10000 + 2400 * 8);
    const retry = getComposerRetryPrompt('PROMPT', 'The model returned invalid JSON: cut.');
    assert.ok(retry.startsWith('PROMPT'));
    assert.doesNotMatch(retry, /3-6 events/);
    assert.match(retry, /as active as the brief demands/);
});

test('the composer prompt holds each rule and none of the lines they replace', () => {
    const prompt = getComposerPrompt(character, options);
    const rules = [
        /accompaniment notes last at most 2 beats, pads at most 2 bars and never across a chord change/i,
        /plucked or struck instruments re-strike at least every 2 beats/,
        /no drums track: one part acts as percussion \(off-beat strums or marimba\)/,
        /no melody note over 2 beats except at cadences/i,
        /Every bar has new onsets in at least two parts; a break lasts at most 2 bars with one part still pulsing/,
        /mode's colour tone appears in the melody, as a chord tone or for at most half a beat, and resolves/,
        /Dense themes use more than a two-chord vamp/,
        /any density above sparse has a harmony track/i,
        /bass approaches each chord by step and plays a fill before each section change/,
        /Sustaining instruments hold, decaying ones move/,
        /melody stays above the harmony's top note/,
        /<phrase_plan>/,
        /Bass and harmony build on the <groove_cells> \(without them: /,
        /playback swings the eighths: write them straight/,
        // (2)
        /Keep one groove cell but change it at least every 4 bars \(walk-up, dropped beat, new inversion, fill\); the second half of the loop must use a different chord progression or bass line from the first half; no melody rhythm unchanged for more than 2 bars in a row; a drum fill at most every 4 bars and never the same fill twice\./,
        // (3)
        /End each 2-4 bar phrase with at least one beat of melody silence; the counter plays its answer in those gaps and holds or rests while the melody moves; the counter may copy the melody's rhythm for at most one bar\./,
        /counter sounds at least 40 % of the loop \(held notes count\), plays in the peak section, uses at least two durations and quotes the motif once; under the climax, contrary motion/,
        // (4)
        /Set the peak velocity from the character: quiet, shy or tired characters peak near v84; rise by at most 12 per bar\. Inside a bar, accent the strong beats and soften passing notes - no bar with one velocity on every note\. Keep the lead inside its comfortable range \(accordion, trumpet, flute below C6\)\./,
        /avoid random notes and excessive density/i,
        // (5)
        /When the chord changes, re-voice every held note and pad; outside the stated surprise, no note a semitone from a chord tone lasts longer than half a beat; chromatic approach notes in the bass are at most an eighth and not in consecutive bars\./,
        // (6)
        /Only the bass plays below C3; chord voicings sit between C3 and C5; the texture takes a register no other track uses and never the harmony's notes in the same octave\./,
        // (7)
        /<surprise> happens once\. Place the surprise in the second half of the loop, after the motif has been heard at least twice; it must contain a note outside the mode and show in at least two tracks; write the chord as its actual notes, not a Roman numeral\./,
        /last bar's bVII or tritone substitute is not a second surprise/,
        // (8)
        /The last bar leads into bar 1: end on V, bVII or a tritone substitute, never on the tonic chord, with the melody within a step of its first note; the last value of the energy plan is at most one level from the first \(end on a fall or a pickup, not full into low\)\./,
    ];
    for (const rule of rules) {
        assert.match(prompt, rule);
    }
    const replaced = [/There are no drums/, /repeating rhythmic figure/, /1\.5 beats/, /chord outside the usual cycle/,
        /Avoid holding semitone clashes/, /change the bass or accompaniment figure every fourth bar/, /no bar repeats unchanged/,
        /answers every melody gap of 2 beats or more/, /No track except drums repeats a bar's rhythm more than twice running/,
        /last bar ends off the tonic/, /an octave away from the harmony voicing/, /No held note a semitone from a chord tone in the same octave/,
        /a borrowed chord, a register drop, a tacet part or a rhythmic shift/, /<groove_cells>, varied/, /varied, not repeated/,
        /subtle variation/, /no large silent stretches/, /thirds, sixths or contrary motion/, /clusters/, /constant-volume patterns/,
        /harmony 2-6/, /texture 2-6/, /bar one still follows seamlessly/, /sits in the melody and resolves/, /:\.75 \.75:/];
    for (const line of replaced) {
        assert.doesNotMatch(prompt, line);
    }
    assert.doesNotMatch(prompt, /drum_kit/);
});

test('the composer example has per-token accents and a texture in a register no other example track uses', () => {
    const prompt = getComposerPrompt(character, options);
    const example = JSON.parse(prompt.match(/\{"tempo":.*\]\}/)[0]);
    const octaves = track => new Set(track.bars.join(' ').match(/[A-G][#b]?\d/g).map(note => note.at(-1)));
    const texture = example.tracks.find(track => track.role === 'texture');
    for (const track of example.tracks.filter(track => track !== texture)) {
        assert.ok([...octaves(texture)].every(octave => !octaves(track).has(octave)), track.role);
    }
    const melody = example.tracks.find(track => track.role === 'melody').bars[0];
    assert.ok(new Set(melody.match(/:\d+(?= |$)/g)).size >= 2, melody);
});

test('the composer adds a drums track only when the brief has drums', () => {
    const brief = parseBrief({ timbre: { drums: 'drum_kit' }, groove_cells: { bass: [0], harmony: [0.5], drums: [0, 1] } });
    const prompt = getComposerPrompt(character, { ...options, brief });
    assert.match(prompt, /"role":"drums","instrument":"drum_kit"/);
    assert.match(prompt, /Drums: play the drum cell from the <groove_cells> \(without one: /);
    assert.match(prompt, /quiet, shy or tired characters use no crash/);
    assert.match(prompt, /kick, snare/);
    assert.doesNotMatch(prompt, /no drums track/);
    assert.doesNotMatch(prompt, /a fill before each phrase/);
    const drums = JSON.parse(prompt.match(/\{"tempo":.*\]\}/)[0]).tracks.find(track => track.role === 'drums').bars[0];
    assert.ok(new Set(drums.match(/:\d+(?= |$)/g)).size >= 2, drums);
});
