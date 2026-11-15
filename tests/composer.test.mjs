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
        /accompaniment notes last at most 2 beats, pads at most 2 bars/i,
        /plucked or struck instruments re-strike at least every 2 beats/,
        /no drums track: one part acts as percussion \(off-beat strums or marimba\)/,
        /no melody note over 2 beats except at cadences/i,
        /Every bar has new onsets in at least two parts; a break lasts at most 2 bars with one part still pulsing/,
        /mode's colour tone sits in the melody and resolves/,
        /Dense themes use more than a two-chord vamp/,
        /any density above sparse has a harmony track/i,
        /counter sounds at least 40 % of the loop, plays in the peak section, answers every melody gap of 2 beats or more, uses at least two durations and quotes the motif once/,
        /No track except drums repeats a bar's rhythm more than twice running/,
        /bass approaches each chord by step and plays a fill before each section change/,
        /last bar ends off the tonic/,
        /Sustaining instruments hold, decaying ones move/,
        /Texture has at most 2 notes, an octave away from the harmony voicing/,
        /melody stays above the harmony's top note/,
        /No held note a semitone from a chord tone in the same octave/,
        /<surprise> happens once: a borrowed chord, a register drop, a tacet part or a rhythmic shift/,
        /<phrase_plan>/,
        /<groove_cells>.*varied/,
        /playback swings the eighths: write them straight/,
        /harmony 3-6; melody 3-6; counter 3-6; texture 3-6/,
    ];
    for (const rule of rules) {
        assert.match(prompt, rule);
    }
    for (const replaced of [/There are no drums/, /repeating rhythmic figure/, /1\.5 beats/, /chord outside the usual cycle/,
        /Avoid holding semitone clashes/, /change the bass or accompaniment figure every fourth bar/, /no bar repeats unchanged/, /:\.75 \.75:/]) {
        assert.doesNotMatch(prompt, replaced);
    }
    assert.doesNotMatch(prompt, /drum_kit/);
});

test('the composer adds a drums track only when the brief has drums', () => {
    const brief = parseBrief({ timbre: { drums: 'drum_kit' }, groove_cells: { bass: [0], harmony: [0.5], drums: [0, 1] } });
    const prompt = getComposerPrompt(character, { ...options, brief });
    assert.match(prompt, /"role":"drums","instrument":"drum_kit"/);
    assert.match(prompt, /Drums: play the drum cell from <groove_cells>, varied, with a fill before each phrase/);
    assert.match(prompt, /kick, snare/);
    assert.doesNotMatch(prompt, /no drums track/);
});
