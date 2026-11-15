// Tests for drum-synth.mjs: the node graph each drum builds, on a fake AudioContext.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrumSynth } from '../src/drum-synth.mjs';
import { DRUM_NOTES } from '../src/score.mjs';

function fakeParam() {
    const calls = [];
    const record = name => (value, time) => calls.push([name, value, time]);
    return {
        calls,
        value: 0,
        setValueAtTime: record('set'),
        exponentialRampToValueAtTime: record('exp'),
        linearRampToValueAtTime: record('lin'),
    };
}

function createFakeContext() {
    const nodes = [];
    const node = (kind, extra) => {
        const created = { kind, connections: [], connect(target) { this.connections.push(target); return target; }, ...extra };
        nodes.push(created);
        return created;
    };
    const source = kind => node(kind, {
        started: null,
        stopped: null,
        start(time) { this.started = time; },
        stop(time) { this.stopped = time ?? 'now'; },
    });
    return {
        nodes,
        currentTime: 0,
        sampleRate: 8000,
        createBuffer: (channels, length, sampleRate) => ({ length, sampleRate, data: new Float32Array(length), getChannelData() { return this.data; } }),
        createBufferSource: () => source('noise'),
        createOscillator: () => Object.assign(source('oscillator'), { type: 'sine', frequency: fakeParam() }),
        createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: fakeParam(), Q: fakeParam() }),
        createGain: () => node('gain', { gain: fakeParam() }),
    };
}

function play(name) {
    const context = createFakeContext();
    const destination = { kind: 'destination' };
    const synth = createDrumSynth(context, { destination });
    synth.play(name, 2, { gain: 0.4 });
    return { context, synth, destination, kinds: context.nodes.map(created => created.kind).sort() };
}

const lengthOf = nodes => Math.max(...nodes.filter(created => typeof created.stopped === 'number').map(created => created.stopped)) - 2;

test('the kick and the toms are sine sweeps without noise', () => {
    const { context } = play('kick');
    const oscillator = context.nodes.find(created => created.kind === 'oscillator');
    assert.equal(oscillator.type, 'sine');
    assert.deepEqual(oscillator.frequency.calls.map(([kind, value]) => [kind, value]), [['set', 150], ['exp', 50]]);
    assert.equal(context.nodes.some(created => created.kind === 'noise'), false);
    for (const tom of ['low_tom', 'high_tom']) {
        const [first, last] = play(tom).context.nodes.find(created => created.kind === 'oscillator').frequency.calls;
        assert.ok(first[1] > last[1], `${tom} sweeps down`);
    }
});

test('snare, clap and rim are filtered noise plus a tone', () => {
    for (const name of ['snare', 'clap', 'rim']) {
        assert.deepEqual(play(name).kinds, ['filter', 'gain', 'gain', 'noise', 'oscillator'], name);
    }
});

test('hats and cymbals are high-passed noise, the closed hat shortest and the crash longest', () => {
    const lengths = {};
    for (const name of ['closed_hat', 'open_hat', 'ride', 'crash']) {
        const { context, kinds } = play(name);
        assert.deepEqual(kinds, ['filter', 'gain', 'noise'], name);
        assert.equal(context.nodes.find(created => created.kind === 'filter').type, 'highpass');
        lengths[name] = lengthOf(context.nodes);
    }
    assert.ok(lengths.closed_hat < lengths.open_hat && lengths.open_hat < lengths.ride && lengths.ride < lengths.crash, JSON.stringify(lengths));
});

test('every kit name sounds into the destination, an unknown name builds nothing, stop silences what plays', () => {
    for (const name of Object.keys(DRUM_NOTES)) {
        const { context, destination } = play(name);
        assert.ok(context.nodes.some(created => created.connections.includes(destination)), name);
        assert.ok(context.nodes.filter(created => created.started !== undefined).every(created => created.started === 2), name);
    }
    assert.equal(play('cowbell').context.nodes.filter(created => created.kind !== 'noise').length, 0);
    const { context, synth } = play('crash');
    synth.stop();
    assert.equal(context.nodes.find(created => created.kind === 'noise').stopped, 'now');
});
