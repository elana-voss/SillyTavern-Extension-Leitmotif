// Tests for loop-points.mjs: choosing loop points where a sample continues smoothly into itself.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findLoopPoints } from '../src/loop-points.mjs';

const SAMPLE_RATE = 8000;

function tone(seconds, frequency, shape = Math.sin) {
    const data = new Float32Array(Math.round(seconds * SAMPLE_RATE));
    for (let i = 0; i < data.length; i++) {
        data[i] = 0.5 * shape(2 * Math.PI * frequency * i / SAMPLE_RATE);
    }
    return data;
}

test('a steady tone loops from 40 % in to a frame that matches the start in value and slope', () => {
    const data = tone(2, 100);
    const points = findLoopPoints([data], SAMPLE_RATE);
    assert.ok(points);
    const startFrame = Math.round(points.start * SAMPLE_RATE);
    const endFrame = Math.round(points.end * SAMPLE_RATE);
    assert.equal(startFrame, Math.floor(2 * 0.4 * SAMPLE_RATE) + 1);
    assert.ok(endFrame - startFrame >= 0.4 * SAMPLE_RATE, 'the loop is at least the minimum period');
    assert.ok(endFrame <= (2 - 0.02) * SAMPLE_RATE, 'the loop ends before the sample tail');
    // 100 Hz at 8 kHz repeats every 80 frames: the end lands on a whole period.
    assert.equal((endFrame - startFrame) % 80, 0);
});

test('no loop for a sample too short to hold one, a silent one, or one whose wrap would step', () => {
    assert.equal(findLoopPoints([tone(0.6, 100)], SAMPLE_RATE), null);
    assert.equal(findLoopPoints([new Float32Array(2 * SAMPLE_RATE)], SAMPLE_RATE), null);
    // A slow ramp never returns to its start value: every wrap is a step.
    const ramp = new Float32Array(2 * SAMPLE_RATE).map((_, i) => i / (2 * SAMPLE_RATE));
    assert.equal(findLoopPoints([ramp], SAMPLE_RATE), null);
});
