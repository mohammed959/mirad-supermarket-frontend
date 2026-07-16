import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseBooleanFlag } from '../../src/lib/flags.ts';

describe('parseBooleanFlag', () => {
  test('enables only on the literal "true" (case-insensitive, trimmed)', () => {
    assert.equal(parseBooleanFlag('true'), true);
    assert.equal(parseBooleanFlag('True'), true);
    assert.equal(parseBooleanFlag('TRUE'), true);
    assert.equal(parseBooleanFlag('  true  '), true);
    assert.equal(parseBooleanFlag('\ttrue\n'), true);
  });

  test('rejects "false", "0", "no", and other truthy-looking strings', () => {
    // These are the exact values the spec calls out as "must NOT enable".
    assert.equal(parseBooleanFlag('false'), false);
    assert.equal(parseBooleanFlag('0'), false);
    assert.equal(parseBooleanFlag('no'), false);
    // And other typical "close but not quite" values.
    assert.equal(parseBooleanFlag('False'), false);
    assert.equal(parseBooleanFlag('yes'), false);
    assert.equal(parseBooleanFlag('1'), false);
    assert.equal(parseBooleanFlag('enabled'), false);
    assert.equal(parseBooleanFlag('on'), false);
    assert.equal(parseBooleanFlag('t'), false);
    assert.equal(parseBooleanFlag('T'), false);
  });

  test('rejects empty and undefined values', () => {
    assert.equal(parseBooleanFlag(''), false);
    assert.equal(parseBooleanFlag('   '), false);
    assert.equal(parseBooleanFlag(undefined), false);
  });

  test('never accidentally enables for arbitrary non-empty strings', () => {
    for (const v of ['random', 'abcdef', '\n\n', 'null', 'undefined']) {
      assert.equal(
        parseBooleanFlag(v),
        false,
        `expected "${v}" to be false so aggregate is not silently enabled`,
      );
    }
  });
});
