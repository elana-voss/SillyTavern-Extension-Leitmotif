// Tests for model-response.mjs: unwrapping a model's answer and reading the JSON object in it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeResponseText, readJsonObject } from '../src/model-response.mjs';

test('normalizeResponseText unwraps known transport shapes', () => {
    assert.equal(normalizeResponseText('{"a":1}'), '{"a":1}');
    assert.equal(normalizeResponseText({ choices: [{ message: { content: '{"a":1}' } }] }), '{"a":1}');
    assert.equal(normalizeResponseText({ choices: [{ text: 'plain text' }] }), 'plain text');
    assert.equal(normalizeResponseText({ message: { content: 'inner' } }), 'inner');
    assert.equal(
        normalizeResponseText({ choices: [{ message: { content: [{ text: 'part1 ' }, { text: 'part2' }] } }] }),
        'part1 part2',
    );
    assert.equal(normalizeResponseText(null), null);
    assert.equal(normalizeResponseText(42), null);
    assert.equal(normalizeResponseText({ tempo: 72 }), null);
    assert.equal(normalizeResponseText({ choices: [{ message: { content: 5 } }] }), null);
});

test('readJsonObject reads the object from fenced or chatty text and names each failure', () => {
    assert.deepEqual(readJsonObject('```json\n{"a":1}\n```', 'score'), { a: 1 });
    assert.deepEqual(readJsonObject('Here it is: {"a":{"b":2}} enjoy', 'score'), { a: { b: 2 } });
    assert.deepEqual(readJsonObject({ tempo: 72 }, 'score'), { tempo: 72 });
    assert.throws(() => readJsonObject('no json here', 'brief'), /did not contain a JSON brief/);
    assert.throws(() => readJsonObject('{"a":', 'score'), /did not contain a JSON score/);
    assert.throws(() => readJsonObject('{"a":}', 'score'), /invalid JSON/);
    assert.throws(() => readJsonObject('[1]', 'score'), /did not contain a JSON score/);
    assert.throws(() => readJsonObject(null, 'score'), /score must be a JSON object/);
    assert.throws(() => readJsonObject({ choices: [{ message: { content: 5 } }] }, 'score'), /did not contain a JSON score/);
});
