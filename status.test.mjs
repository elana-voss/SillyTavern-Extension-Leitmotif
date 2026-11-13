import assert from 'node:assert/strict';
import test from 'node:test';
import { getIdleStatus } from './status.mjs';

test('the idle status names a loaded theme, else asks for a character chat', () => {
    assert.match(getIdleStatus(true), /Theme ready/);
    assert.match(getIdleStatus(false), /character chat/);
});
