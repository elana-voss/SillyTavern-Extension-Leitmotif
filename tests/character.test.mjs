// Tests for character.mjs: the escaped, tagged profile both prompts read.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCharacterProfile } from '../src/character.mjs';

test('the profile tags each card field once escaped, reads data fields, and refuses an empty card', () => {
    const profile = buildCharacterProfile({ name: '', description: ' Salt & <iron> ', data: { scenario: 'Docks' } }, 'User');
    assert.equal(profile.name, 'User');
    assert.equal(profile.profileFields, '<description>\nSalt &amp; &lt;iron&gt;\n</description>\n<scenario>\nDocks\n</scenario>');
    assert.throws(() => buildCharacterProfile({ name: 'Empty', description: '  ' }), /no description/);
});
