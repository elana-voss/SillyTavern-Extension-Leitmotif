// Tests for composer.mjs: the score prompt built from the brief and the profile.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getComposerPrompt, INSTRUMENT_LABELS } from '../src/composer.mjs';
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
