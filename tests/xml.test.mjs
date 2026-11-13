// Tests for xml.mjs: escaping text placed inside the prompts' XML-style tags.
import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml } from '../src/xml.mjs';

test('escapeXml escapes ampersands and angle brackets, ampersands first', () => {
    assert.equal(escapeXml('a & <b> &lt;'), 'a &amp; &lt;b&gt; &amp;lt;');
    assert.equal(escapeXml(42), '42');
});
