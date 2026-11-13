// Tests for status.mjs: the idle status text.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getIdleStatus } from '../src/status.mjs';

test('the idle status names a loaded theme, else asks for a character chat', () => {
    assert.match(getIdleStatus(true), /Theme ready/);
    assert.match(getIdleStatus(false), /character chat/);
});
