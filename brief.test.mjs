import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BRIEF_JSON_SCHEMA,
    BRIEF_MODES,
    getBriefPrompt,
    musicBriefToPromptSection,
    parseBrief,
    sampleVarietySeed,
    varietySeedToBriefAddition,
} from './brief.mjs';

const fullBrief = {
    backdrop: 'A frozen harbor town under aurora light',
    action: 'Nightly smuggling runs between the ice floes',
    twist: 'She is the inspector hunting herself',
    traits: ['watchful', 'dry humor', 'tender'],
    arc: 'quiet tension, sudden lift, quiet again',
    genre_references: ['Nordic noir jazz', 'sparse ambient'],
    era: 'noir',
    mode: 'dorian',
    key: 'D',
    feel: 'swing',
    meter: '3/4',
    tempo: 96,
    energy_curve: ['low', 'medium', 'high', 'medium'],
    density: 'balanced',
    motif: { notes: ['A3', 'C4', 'D3'], rhythm: [0.5, 0.5, 1], character: 'rising, questioning' },
    timbre: { harmony: 'cold shimmer', bass: 'wooden and close', melody: 'breathy' },
    harmony_flavor: 'minor ninths with suspensions',
    surprise: 'bar 3 drops to the flat-II for one beat',
};

test('parses a full brief from fenced JSON', () => {
    const brief = parseBrief(`\`\`\`json\n${JSON.stringify(fullBrief)}\n\`\`\``);
    assert.equal(brief.mode, 'dorian');
    assert.equal(brief.meter, '3/4');
    assert.equal(brief.tempo, 96);
    assert.equal(brief.feel, 'swing');
    assert.deepEqual(brief.motif.notes, ['A3', 'C4', 'D3']);
    assert.deepEqual(brief.genreReferences, ['Nordic noir jazz', 'sparse ambient']);
    assert.equal(brief.timbre.harmony, 'cold shimmer');
});

test('degrades fail-soft instead of throwing', () => {
    assert.equal(parseBrief('no json here'), null);
    assert.equal(parseBrief('```json\n{bad}\n```'), null);
    assert.equal(parseBrief(null), null);
    assert.equal(parseBrief(42), null);
    assert.equal(parseBrief('[1,2,3]'), null);

    const partial = parseBrief(JSON.stringify({ backdrop: 'x', tempo: 1000, mode: 'locrian', density: 'chaos' }));
    assert.equal(partial.backdrop, 'x');
    assert.equal(partial.tempo, 130);
    assert.equal(partial.mode, null);
    assert.equal(partial.density, 'balanced');
    assert.equal(partial.meter, '4/4');
    assert.equal(partial.motif, null);

    assert.equal(parseBrief(JSON.stringify({ tempo: 12 })).tempo, 50);
    assert.equal(parseBrief(JSON.stringify({ tempo: 72.6 })).tempo, 73);
});

test('drops unusable motif notes and keeps usable ones', () => {
    const mixed = parseBrief(JSON.stringify({
        ...fullBrief,
        motif: { notes: ['A3', 'H4', 'C4'], rhythm: [0.5, 0.5, 1], character: 'x' },
    }));
    assert.deepEqual(mixed.motif.notes, ['A3', 'C4']);
    assert.deepEqual(mixed.motif.rhythm, [0.5, 0.5]);

    const badRhythm = parseBrief(JSON.stringify({
        ...fullBrief,
        motif: { notes: ['A3', 'C4'], rhythm: [0.5], character: 'x' },
    }));
    assert.equal(badRhythm.motif, null);
});

test('renders the brief as escaped XML-style sections', () => {
    const brief = parseBrief(JSON.stringify({
        ...fullBrief,
        backdrop: 'harbor & fjord <light>',
    }));
    const section = musicBriefToPromptSection(brief);
    assert.match(section, /^<music_brief>/);
    assert.match(section, /<\/music_brief>$/);
    assert.match(section, /<backdrop>harbor &amp; fjord &lt;light&gt;<\/backdrop>/);
    assert.match(section, /<motif>notes A3 C4 D3 with rhythm beats 0.5 0.5 1/);
    assert.equal(musicBriefToPromptSection(null), '');
});

test('samples variety seeds within the vocabulary per level', () => {
    const alwaysFirst = () => 0;
    const alwaysLast = () => 0.999999;

    const standard = sampleVarietySeed('standard', alwaysFirst);
    assert.equal(standard.era, 'baroque');
    assert.equal(standard.groove, 'drifting');

    const wild = sampleVarietySeed('wild', alwaysLast);
    assert.equal(wild.era, 'futuristic noir');
    assert.equal(wild.groove, 'stops and stutters');

    const focused = sampleVarietySeed('focused', alwaysLast);
    assert.equal(focused.era, 'modern minimal');
    assert.equal(focused.register, 'mid and centered');
    assert.equal(focused.groove, 'drifting');
    assert.equal(focused.harmonicMotion, 'slow, few chords');

    const rendered = varietySeedToBriefAddition(standard);
    assert.match(rendered, /era bias: baroque/);
    assert.match(rendered, /groove: drifting/);
    assert.equal(varietySeedToBriefAddition(null), '');
});

test('the analysis prompt carries the profile and the layer mapping', () => {
    const prompt = getBriefPrompt(
        { name: 'Vera & Co', profileFields: '<description>Frozen harbor</description>' },
        { tempoHint: 74 },
    );
    assert.match(prompt, /backdrop .*->/s);
    assert.match(prompt, /Vera &amp; Co/);
    assert.match(prompt, /Aim near 74 BPM/);
    assert.match(prompt, /50 to 130 BPM/);
    for (const mode of BRIEF_MODES) {
        assert.ok(prompt.includes(mode));
    }
    const noHint = getBriefPrompt({ name: 'Solo', profileFields: 'x' }, {});
    assert.match(noHint, /Choose the tempo purely from the character/);
});

// Every object level of a strict-mode schema must be closed and fully required.
function assertSchemaObjectsClosed(schema) {
    if (!schema || typeof schema !== 'object') {
        return;
    }
    if (schema.type === 'object'
        || (Array.isArray(schema.type) && schema.type.includes('object'))
        || schema.properties) {
        assert.equal(schema.additionalProperties, false);
        assert.ok(Array.isArray(schema.required));
        for (const key of Object.keys(schema.properties ?? {})) {
            assert.ok(schema.required.includes(key), `missing required key: ${key}`);
        }
    }
    for (const value of Object.values(schema.properties ?? {})) {
        assertSchemaObjectsClosed(value);
    }
    if (schema.items) {
        assertSchemaObjectsClosed(schema.items);
    }
}

test('BRIEF_JSON_SCHEMA is strict-mode compliant at every object level', () => {
    assertSchemaObjectsClosed(BRIEF_JSON_SCHEMA);
});

test('parseBrief unwraps a raw completion object', () => {
    const wrapped = parseBrief({ choices: [{ message: { content: JSON.stringify(fullBrief) } }] });
    assert.equal(wrapped.backdrop, fullBrief.backdrop);
    assert.equal(wrapped.meter, '3/4');
});

test('parseBrief fails soft on un-unwrappable payloads and garbage', () => {
    assert.equal(parseBrief({ choices: [{ message: { content: 5 } }] }), null);
    assert.equal(parseBrief('not json at all'), null);
    assert.equal(parseBrief(null), null);
});

test('parseBrief accepts an already-parsed brief object', () => {
    const parsed = parseBrief(fullBrief);
    assert.equal(parsed.tempo, 96);
    assert.deepEqual(parsed.motif.notes, ['A3', 'C4', 'D3']);
});
