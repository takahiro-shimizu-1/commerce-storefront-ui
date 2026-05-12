import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

test('storefront preview keeps UI files in the app repo', () => {
  assert.equal(existsSync(new URL('../public/index.html', import.meta.url)), true);
  assert.equal(existsSync(new URL('../server.mjs', import.meta.url)), true);
});
