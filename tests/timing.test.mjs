// Tests for timing.mjs: swing and playback humanisation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRandom, humanize, swingEvent } from '../src/timing.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('swing lengthens an on-beat eighth to 2/3 and starts the off-beat eighth 1/6 late, its end unchanged', () => {
    const first = swingEvent(2, 0.5, 'swing');
    close(first.beat, 2);
    close(first.duration, 2 / 3);
    const second = swingEvent(2.5, 0.5, 'swing');
    close(second.beat, 2 + 2 / 3);
    close(second.beat + second.duration, 3);
});

test('swing leaves a sixteenth hat line straight (no two onsets closer than 1/4 beat) while the eighth pair still swings', () => {
    const onsets = [];
    for (let beat = 0; beat < 2; beat += 0.25) {
        onsets.push(swingEvent(beat, 0.25, 'swing').beat);
    }
    onsets.sort((a, b) => a - b);
    for (let index = 1; index < onsets.length; index += 1) {
        assert.ok(onsets[index] - onsets[index - 1] >= 0.25 - 1e-9, `onsets ${onsets[index - 1]} and ${onsets[index]}`);
    }
    close(swingEvent(0.5, 0.5, 'swing').beat, 2 / 3);
});

test('swing leaves a held note, a sixteenth and every straight event unchanged', () => {
    assert.deepEqual(swingEvent(0, 2, 'swing'), { beat: 0, duration: 2 });
    assert.deepEqual(swingEvent(1.25, 0.25, 'swing'), { beat: 1.25, duration: 0.25 });
    assert.deepEqual(swingEvent(0, 0.5, 'straight'), { beat: 0, duration: 0.5 });
    assert.deepEqual(swingEvent(0.5, 0.5, undefined), { beat: 0.5, duration: 0.5 });
});

test('swing moves drums by position: the short off-beat hat swings with the eighths, a sixteenth line does not flam', () => {
    const hat = swingEvent(1.5, 0.25, 'swing', { drums: true });
    close(hat.beat, 1 + 2 / 3);
    close(hat.duration, 0.25);
    assert.deepEqual(swingEvent(1, 0.25, 'swing', { drums: true }), { beat: 1, duration: 0.25 });
    const onsets = [0, 0.25, 0.5, 0.75].map(beat => swingEvent(beat, 0.25, 'swing', { drums: true }).beat);
    for (let index = 1; index < onsets.length; index += 1) {
        assert.ok(onsets[index] - onsets[index - 1] >= 1 / 6 - 1e-9, `onsets ${onsets[index - 1]} and ${onsets[index]}`);
    }
    close(onsets[3], 5 / 6);
    assert.deepEqual(swingEvent(1.5, 0.25, 'straight', { drums: true }), { beat: 1.5, duration: 0.25 });
});

test('humanize stays within 8 ms and 6 velocity steps over 1,000 draws and never moves before the loop start', () => {
    const random = createRandom(7);
    for (let draw = 0; draw < 1000; draw += 1) {
        const result = humanize({ beat: 0.25, when: 10.001, velocity: 125 }, { random, loopStart: 10 });
        assert.ok(result.when >= 10 && Math.abs(result.when - 10.001) <= 0.008 + 1e-12, `start ${result.when}`);
        assert.ok(Math.abs(result.velocity - 125) <= 6 && result.velocity <= 127 && Number.isInteger(result.velocity));
    }
});

test('humanize leaves bar one downbeat untouched', () => {
    const random = createRandom(3);
    assert.deepEqual(humanize({ beat: 0, when: 4, velocity: 90 }, { random, loopStart: 4 }), { when: 4, velocity: 90 });
});

test('the seeded random repeats its sequence for the same seed', () => {
    const left = createRandom(11);
    const right = createRandom(11);
    assert.equal(left(), right());
});
