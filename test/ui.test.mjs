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

test('storefront renders the catalog lifecycle badge contract', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /連携印/);
  assert.match(app, /注文連携印/);
});

test('storefront renders the cart checkout handoff note contract', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /受け渡しメモ/);
});
