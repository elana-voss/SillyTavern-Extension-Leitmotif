import assert from 'node:assert/strict';
import test from 'node:test';
import { getMidiFileName } from '../src/midi-export.mjs';

test('MIDI file name replaces characters a file name cannot hold, the backslash included', () => {
    assert.equal(getMidiFileName('A\\B/C:D'), 'A_B_C_D-theme.mid');
});
