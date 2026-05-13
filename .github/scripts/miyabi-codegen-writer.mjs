#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const scenario = resolveScenario();

if (scenario === 'small-cart-checkout') {
  applySmallCartCheckoutChange();
} else if (scenario === 'large-catalog-product') {
  applyLargeCatalogProductChange();
} else if (scenario === 'split-ui-copy') {
  applySplitUiCopyChange();
} else if (scenario === 'split-ui-style') {
  applySplitUiStyleChange();
} else {
  throw new Error(`Unsupported storefront Miyabi scenario: ${scenario}`);
}

function resolveScenario() {
  const text = [process.env.AUTOMATION_TASK_TITLE, process.env.AUTOMATION_TASK_ID].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('small-cart-checkout')) return 'small-cart-checkout';
  if (text.includes('large-catalog-product')) return 'large-catalog-product';
  if (text.includes('split-ui-copy')) return 'split-ui-copy';
  if (text.includes('split-ui-style')) return 'split-ui-style';
  return 'unknown';
}

function applySmallCartCheckoutChange() {
  replaceOnce(
    'public/app.js',
    "      ['計算方式', order.order?.pricingMode ?? order.checkoutCart?.pricingMode],\n",
    "      ['計算方式', order.order?.pricingMode ?? order.checkoutCart?.pricingMode],\n      ['会計準備', order.checkoutCart?.checkoutReady ? 'OK' : undefined],\n",
  );
  ensureReadFileImport();
  appendTest(
    "test('storefront renders the cart checkout readiness contract', () => {\n  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');\n  assert.match(app, /会計準備/);\n});\n",
  );
  updateContracts((entry) => {
    if (entry.id === 'CART_CHECKOUT_CONTRACT') entry.version = '7';
  });
}

function applyLargeCatalogProductChange() {
  replaceOnce(
    'public/app.js',
    "    ['出荷地域', order.product?.fulfillmentRegion],\n",
    "    ['出荷地域', order.product?.fulfillmentRegion],\n    ['連携印', order.product?.lifecycleBadge],\n",
  );
  replaceOnce(
    'public/app.js',
    "      ['状態', order.order?.status ?? '未確定'],\n",
    "      ['状態', order.order?.status ?? '未確定'],\n      ['注文連携印', order.order?.lifecycleBadges?.join(', ')],\n",
  );
  replaceOnce(
    'server.mjs',
    "      to: ['commerce-cart-service', 'commerce-checkout-service'],\n",
    "      to: ['commerce-cart-service', 'commerce-checkout-service', 'commerce-storefront-ui'],\n",
  );
  ensureReadFileImport();
  appendTest(
    "test('storefront renders the catalog lifecycle badge contract', () => {\n  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');\n  assert.match(app, /連携印/);\n  assert.match(app, /注文連携印/);\n});\n",
  );
  updateContracts((entry) => {
    if (entry.id === 'CATALOG_PRODUCT_CONTRACT') entry.version = '7';
    if (entry.id === 'CART_CHECKOUT_CONTRACT') entry.version = '8';
    if (entry.id === 'CHECKOUT_ORDER_CONTRACT') entry.version = '3';
  });
}

function applySplitUiCopyChange() {
  replaceOnce(
    'public/index.html',
    '<h1>商品、カート、会計の動き</h1>',
    '<h1>商品、カート、会計のつながり</h1>',
  );
}

function applySplitUiStyleChange() {
  replaceOnce(
    'public/styles.css',
    '.segment.is-active {\n  background: #ffffff;\n  color: #17212b;\n',
    '.segment.is-active {\n  background: #ffffff;\n  color: #17212b;\n  outline: 2px solid #9fc7b3;\n  outline-offset: 2px;\n',
  );
}

function ensureReadFileImport() {
  replaceOnce(
    'test/ui.test.mjs',
    "import { existsSync } from 'node:fs';\n",
    "import { existsSync, readFileSync } from 'node:fs';\n",
  );
}

function appendTest(source) {
  const filePath = 'test/ui.test.mjs';
  const current = readFileSync(filePath, 'utf8');
  if (current.includes(source.trim())) return;
  writeFileSync(filePath, `${current.trimEnd()}\n\n${source}`, 'utf8');
}

function updateContracts(mutator) {
  const filePath = 'config/gitnexus-contracts.json';
  const manifest = JSON.parse(readFileSync(filePath, 'utf8'));
  for (const entry of manifest.contracts) mutator(entry);
  writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function replaceOnce(filePath, search, replacement) {
  const current = readFileSync(filePath, 'utf8');
  if (current.includes(search)) {
    writeFileSync(filePath, current.replace(search, replacement), 'utf8');
    return;
  }
  if (current.includes(replacement)) {
    return;
  }
  throw new Error(`Expected text not found in ${filePath}`);
}
