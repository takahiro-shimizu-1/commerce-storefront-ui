import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

test('storefront preview keeps UI files in the app repo', () => {
  assert.equal(existsSync(new URL('../public/index.html', import.meta.url)), true);
  assert.equal(existsSync(new URL('../server.mjs', import.meta.url)), true);
});

test('storefront renders the cart checkout readiness contract', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /会計準備/);
});
