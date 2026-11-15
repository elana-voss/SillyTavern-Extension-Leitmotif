// Tests for playback.mjs: which player each track gets, and one scheduled pass.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTrackPlayers, schedulePass } from '../src/playback.mjs';

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

test('one pass plays every note from its start time, a downbeat exactly on it', async () => {
    const played = [];
    const player = { play: (note, when) => played.push([note, when]) };
    const score = {
        tempo: 120,
        feel: 'straight',
        tracks: [{ role: 'melody', instrument: 'flute', events: [
            { beat: 0, duration: 1, velocity: 90, notes: ['C4', 'E4'] },
            { beat: 2, duration: 1, velocity: 90, notes: ['G4'] },
        ] }],
    };
    schedulePass(score, [player], { startTime: 10, random: () => 0.5 });
    assert.deepEqual(played, [['C4', 10], ['E4', 10], ['G4', 11]]);
});
