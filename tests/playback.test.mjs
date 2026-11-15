// Tests for playback.mjs: which player each track gets.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTrackPlayers } from '../src/playback.mjs';

test('the drums track gets the synthesized kit and loads no sample file', async () => {
    const loaded = [];
    const players = await loadTrackPlayers([
        { role: 'melody', instrument: 'flute' },
        { role: 'drums', instrument: 'drum_kit' },
    ], {
        loadSample: async instrument => {
            loaded.push(instrument);
            return `sample ${instrument}`;
        },
        createDrums: () => 'kit',
    });
    assert.deepEqual(loaded, ['flute']);
    assert.deepEqual(players, ['sample flute', 'kit']);
});
