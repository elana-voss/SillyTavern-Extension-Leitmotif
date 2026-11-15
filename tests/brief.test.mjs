// Tests for brief.mjs: prompt, schema, parsing, the brief cache and the variety seed.
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
    createBriefCache,
} from '../src/brief.mjs';
import { TRACK_ROLES } from '../src/score.mjs';

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
    timbre: { harmony: 'vibraphone', bass: 'contrabass', melody: 'clarinet', counter: null, texture: null, drums: null },
    groove_cells: { bass: [0, 1.5, 2], harmony: [0.5, 1.5, 2.5], drums: null },
    phrase_plan: ['statement', 'answer', 'climax', 'cadence'],
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
    assert.equal(brief.timbre.harmony, 'vibraphone');
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
    // profileFields arrive escaped and tagged from buildCharacterProfile: placed as they are, never escaped twice.
    assert.ok(prompt.includes('<description>Frozen harbor</description>'));
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

test('moves motif notes in octave 0 or 7 and above into range instead of dropping them', () => {
    const brief = parseBrief(JSON.stringify({
        ...fullBrief,
        motif: { notes: ['A0', 'C7', 'E4'], rhythm: [0.5, 1, 1.5], character: 'x' },
    }));
    assert.deepEqual(brief.motif.notes, ['A1', 'C6', 'E4']);
    assert.deepEqual(brief.motif.rhythm, [0.5, 1, 1.5]);
});

test('the brief cache keeps no failed analysis', () => {
    const cache = createBriefCache();
    const character = { name: 'Mira', profileFields: 'smuggler' };
    cache.set(character, null, null);
    assert.equal(cache.has(character, null), false);
    cache.set(character, null, { tempo: 80 });
    assert.deepEqual(cache.get(character, null), { tempo: 80 });
});

test('the brief cache tells a brief made with a tempo hint from one made without', () => {
    const cache = createBriefCache();
    const character = { name: 'Mira', profileFields: 'smuggler' };
    cache.set(character, 72, { tempo: 72 });
    assert.equal(cache.has(character, null), false);
    assert.equal(cache.has(character, 90), false);
    assert.equal(cache.has(character, 72), true);
});

test('a timbre outside its role list is dropped; drums take only drum_kit', () => {
    const brief = parseBrief({
        ...fullBrief,
        timbre: { harmony: 'electric_piano_1', bass: 'cold shimmer', melody: 'contrabass', counter: null, texture: null, drums: 'drum_kit' },
    });
    assert.deepEqual(brief.timbre, { harmony: 'electric_piano_1', drums: 'drum_kit' });
    assert.equal(parseBrief({ ...fullBrief, timbre: { drums: 'bongos' } }).timbre.drums, undefined);
});

test('a 30-word surprise is cut at a word, not mid-word', () => {
    const words = Array.from({ length: 30 }, (_, index) => `borrowed${index}`);
    const surprise = parseBrief({ ...fullBrief, surprise: words.join(' ') }).surprise;
    assert.ok(surprise.length > 0 && surprise.length <= 120);
    assert.ok(words.join(' ').startsWith(surprise));
    assert.equal(words.join(' ')[surprise.length], ' ');
});

test('the brief schema has the timbre enums, groove cells and phrase plan', () => {
    const { timbre, groove_cells: grooveCells, phrase_plan: phrasePlan, surprise, energy_curve: energyCurve } = BRIEF_JSON_SCHEMA.properties;
    assert.deepEqual(timbre.properties.bass.enum, [...TRACK_ROLES.bass, null]);
    assert.deepEqual(timbre.properties.drums.enum, ['drum_kit', null]);
    assert.ok(BRIEF_JSON_SCHEMA.required.includes('groove_cells') && BRIEF_JSON_SCHEMA.required.includes('phrase_plan'));
    assert.deepEqual(grooveCells.required, ['bass', 'harmony', 'drums']);
    assert.deepEqual(phrasePlan.items.enum, ['statement', 'answer', 'sequence', 'fragment', 'climax', 'cadence']);
    assert.match(surprise.description, /At most 15 words/);
    assert.match(surprise.description, /second half of the loop.*actual notes with a note outside the mode, not a Roman numeral/);
    assert.match(timbre.properties.drums.description, /100 BPM or more, or the energy plan reaches high or full.*stillness/);
    assert.match(energyCurve.description, /at most one level from the first.*low < medium < high < full; rise, fall or break may be the last value/);
    for (const replaced of [/borrowed chord/, /register drop/, /tacet part/, /rhythmic shift/, /when the character wants drums/]) {
        assert.doesNotMatch(`${surprise.description} ${timbre.properties.drums.description}`, replaced);
    }
});

test('groove cells and the phrase plan are parsed and reach the composer section', () => {
    const brief = parseBrief({
        ...fullBrief,
        meter: '4/4',
        groove_cells: { bass: [2, 0, 0, 4, -1, 1.3], harmony: [0.5, 'x'], drums: [0, 1] },
        phrase_plan: ['statement', 'bar 3', 'sequence', 'cadence'],
    });
    assert.deepEqual(brief.grooveCells, { bass: [0, 1.25, 2], harmony: [0.5] });
    assert.deepEqual(brief.phrasePlan, ['statement', 'sequence', 'cadence']);
    const withDrums = parseBrief({ ...fullBrief, timbre: { drums: 'drum_kit' }, groove_cells: { bass: [0], harmony: [0], drums: [0, 1, 2] } });
    assert.deepEqual(withDrums.grooveCells.drums, [0, 1, 2]);
    const section = musicBriefToPromptSection(withDrums);
    assert.match(section, /<groove_cells>bass 0; harmony 0; drums 0 1 2<\/groove_cells>/);
    assert.match(section, /<phrase_plan>statement -&gt; answer -&gt; climax -&gt; cadence<\/phrase_plan>/);
    assert.match(section, /<timbre>drums: drum_kit<\/timbre>/);
});

test('the brief prompt allows drums and its example carries the new fields', () => {
    const prompt = getBriefPrompt({ name: 'Solo', profileFields: 'x' }, {});
    assert.doesNotMatch(prompt, /no drums/);
    assert.match(prompt, /"drums":"drum_kit\|null"/);
    assert.match(prompt, /"groove_cells":\{"bass":\[/);
    assert.match(prompt, /"phrase_plan":\[/);
    assert.match(prompt, /"bass":"acoustic_bass\|/);
});

test('the brief prompt asks for drums at speed or high energy and keeps the loop seam in the energy plan', () => {
    const prompt = getBriefPrompt({ name: 'Solo', profileFields: 'x' }, {});
    assert.match(prompt, /If tempo is 100 BPM or more, or the energy plan reaches high or full, include a drums track \(kit or hand percussion\) and name its groove in the brief; leave drums out only when the character calls for stillness\./);
    assert.match(prompt, /Hand percussion is drum_kit played on rim, clap and toms/);
    assert.match(prompt, /the last value of the energy plan is at most one level from the first \(end on a fall or a pickup, not full into low\)/);
    assert.match(prompt, /low < medium < high < full; rise, fall or break may be the last value/);
    assert.match(prompt, /"surprise":"at most 15 words: [^"]*second half[^"]*actual notes/);
    for (const replaced of [/drums is drum_kit only when the character calls for drums/, /borrowed chord/, /register drop/]) {
        assert.doesNotMatch(prompt, replaced);
    }
});
