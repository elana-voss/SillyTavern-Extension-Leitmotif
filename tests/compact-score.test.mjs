// Tests for compact-score.mjs (per-bar strings to timed events) and for
// parseScore reading that form beside the older events form.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compactBarsToEvents } from '../src/compact-score.mjs';
import { parseScore } from '../src/score.mjs';
import { getComposerPrompt } from '../src/composer.mjs';

function withWarnings(run) {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        return { result: run(), warnings };
    } finally {
        console.warn = original;
    }
}

const read = (bars, loopBars = 4, beatsPerBar = 4) => withWarnings(() => compactBarsToEvents(bars, { beatsPerBar, loopBars, track: 1 }));

test('each token form: notes, chord, own velocity, bar velocity, default velocity', () => {
    const { result } = read(['v62 0:D4:.75 .75:F4:.25 1:A4+C5:1 2:G#4:.5:90', '3:E4:1']);
    assert.deepEqual(result, [
        { beat: 0, duration: 0.75, velocity: 62, notes: ['D4'] },
        { beat: 0.75, duration: 0.25, velocity: 62, notes: ['F4'] },
        { beat: 1, duration: 1, velocity: 62, notes: ['A4', 'C5'] },
        { beat: 2, duration: 0.5, velocity: 90, notes: ['G#4'] },
        { beat: 7, duration: 1, velocity: undefined, notes: ['E4'] },
    ]);
    const parsed = parseScore({ tempo: 90, tracks: [
        { role: 'melody', instrument: 'flute', bars: ['3:E4:1'] },
        { role: 'bass', instrument: 'acoustic_bass', bars: ['0:A1:4'] },
    ] });
    assert.equal(parsed.tracks[0].events[0].velocity, 100);
});

test('a bad token is dropped with a warning, never the bar', () => {
    const { result, warnings } = read(['0:D4:1 x:E4:1 1:F4 2::1 4:G4:1 v70 3:A4:1:loud 3:A4:.5']);
    assert.deepEqual(result.map(event => event.beat), [0, 3]);
    assert.equal(warnings.length, 6, warnings.join('\n'));
});

test('=n repeats an earlier bar; chains resolve; forward and self references are silent with a warning', () => {
    const { result, warnings } = read(['v70 0:D4:1', '=1', '=2', '=5', '=5'], 6);
    assert.deepEqual(result.map(event => [event.beat, event.velocity]), [[0, 70], [4, 70], [8, 70]]);
    assert.equal(warnings.length, 2, warnings.join('\n'));
});

test('a short bars array leaves the rest silent; a long one drops the extra bars with a warning', () => {
    const short = read(['0:D4:1', ''], 4);
    assert.deepEqual(short.result.map(event => event.beat), [0]);
    assert.equal(short.warnings.length, 0);
    const long = read(['0:D4:1', '0:E4:1', '0:F4:1', '0:G4:1', '0:A4:1'], 4);
    assert.deepEqual(long.result.map(event => event.beat), [0, 4, 8, 12]);
    assert.equal(long.warnings.length, 1);
});

test('a note rings past the bar line, clipped only at the loop end; drums use their names', () => {
    const parsed = parseScore({ tempo: 90, tracks: [
        { role: 'melody', instrument: 'flute', bars: ['2:E4:6', '', '', '3:A4:4'] },
        { role: 'bass', instrument: 'acoustic_bass', bars: ['0:A1:4'] },
        { role: 'drums', instrument: 'drum_kit', bars: ['0:kick+closed_hat:.5 1:snare:.5'] },
    ] }, { loopBeats: 16 });
    assert.deepEqual(parsed.tracks[0].events.map(({ beat, duration }) => [beat, duration]), [[2, 6], [15, 1]]);
    assert.deepEqual(parsed.tracks[2].events[0].notes, ['kick', 'closed_hat']);
});

test('the old events form and the new bars form parse to the same events', () => {
    const events = [{ beat: 0, duration: 1, velocity: 80, notes: ['E5'] }, { beat: 5, duration: 2, velocity: 80, notes: ['G5'] }];
    const bass = { role: 'bass', instrument: 'acoustic_bass', events: [{ beat: 0, duration: 4, velocity: 90, notes: ['A1'] }] };
    const old = parseScore({ tempo: 90, tracks: [{ role: 'melody', instrument: 'flute', events }, bass] });
    const compact = parseScore({ tempo: 90, tracks: [{ role: 'melody', instrument: 'flute', bars: ['v80 0:E5:1', '1:G5:2:80'] }, bass] });
    assert.deepEqual(compact, old);
});

test('the composer example round-trips through parseScore', () => {
    for (const [meter, beatsPerBar] of [['4/4', 4], ['3/4', 3]]) {
        const prompt = getComposerPrompt({ name: 'A', profileFields: '' }, { brief: null, bars: 4, loopBeats: 4 * beatsPerBar, tempo: 92, meter, varietySeed: null });
        const example = prompt.match(/^\{"tempo".*\}$/m)?.[0];
        assert.ok(example, 'example line');
        const value = JSON.parse(example);
        assert.ok(value.tracks.every(track => Array.isArray(track.bars) && !track.events));
        const { result, warnings } = withWarnings(() => parseScore(example, { loopBeats: 4 * beatsPerBar, meter }));
        assert.equal(warnings.length, 0, warnings.join('\n'));
        assert.equal(result.tracks.length, value.tracks.length);
        assert.ok(result.tracks.every(track => track.events.length > 0));
    }
});
