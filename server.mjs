#!/usr/bin/env node
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(repoRoot, 'public');
const portfolioRoot = path.resolve(process.env.COMMERCE_PORTFOLIO_ROOT || path.join(repoRoot, '..'));
const port = Number.parseInt(process.env.PORT || '5177', 10);
const host = process.env.HOST || '127.0.0.1';

export const CATALOG_PRODUCT_CONTRACT = 'catalog-product-v1';
export const CART_CHECKOUT_CONTRACT = 'cart-checkout-v1';
export const CHECKOUT_ORDER_CONTRACT = 'checkout-order-v1';

const repos = {
  catalog: path.join(portfolioRoot, 'commerce-catalog-service'),
  cart: path.join(portfolioRoot, 'commerce-cart-service'),
  checkout: path.join(portfolioRoot, 'commerce-checkout-service'),
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === '/api/order') {
      writeJson(response, await buildOrder(url.searchParams));
      return;
    }
    if (url.pathname === '/api/portfolio') {
      writeJson(response, buildPortfolio());
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    writeJson(
      response,
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

server.listen(port, host, () => {
  console.log(`commerce-storefront-ui: http://${host}:${port}`);
  console.log(`portfolio root: ${portfolioRoot}`);
});

async function buildOrder(searchParams) {
  ensureRepos();
  const quantity = clampQuantity(searchParams.get('quantity'));
  const scenario = searchParams.get('scenario') === 'out-of-stock' ? 'out-of-stock' : 'normal';
  const catalog = await importWithFreshness(path.join(repos.catalog, 'src/catalog.mjs'));
  const cart = await importWithFreshness(path.join(repos.cart, 'src/cart.mjs'));
  const checkout = await importWithFreshness(path.join(repos.checkout, 'src/checkout.mjs'));

  const product = {
    ...catalog.getProductForCart('sku-1'),
    ...(scenario === 'out-of-stock' ? { stockStatus: 'out-of-stock' } : {}),
  };
  const steps = [];
  let cartState = null;
  let checkoutCart = null;
  let order = null;

  try {
    catalog.assertCatalogProduct(product);
    steps.push({ key: 'catalog', name: '商品', status: 'ok', note: '商品レポのデータは使える形です' });
  } catch (error) {
    steps.push({ key: 'catalog', name: '商品', status: 'error', note: messageOf(error) });
  }

  try {
    cartState = cart.addCatalogProductToCart(product, quantity);
    checkoutCart = cart.buildCheckoutCart(cartState);
    steps.push({ key: 'cart', name: 'カート', status: 'ok', note: '商品を受け取り、会計用の形にしました' });
  } catch (error) {
    steps.push({ key: 'cart', name: 'カート', status: 'error', note: messageOf(error) });
  }

  try {
    if (!checkoutCart) throw new Error('会計へ渡すデータがありません');
    order = checkout.priceOrder(checkoutCart);
    steps.push({ key: 'checkout', name: '会計', status: 'ok', note: '金額を確定しました' });
  } catch (error) {
    steps.push({ key: 'checkout', name: '会計', status: 'error', note: messageOf(error) });
  }

  return {
    ok: Boolean(order),
    scenario,
    quantity,
    product,
    cart: cartState,
    checkoutCart,
    order,
    steps,
    impact: impactExamples(),
    contracts: contractRows(),
  };
}

function buildPortfolio() {
  ensureRepos();
  return {
    name: 'commerce-storefront-ui',
    root: portfolioRoot,
    reads: [
      'commerce-catalog-service/src/catalog.mjs',
      'commerce-cart-service/src/cart.mjs',
      'commerce-checkout-service/src/checkout.mjs',
    ],
    contracts: contractRows(),
  };
}

async function importWithFreshness(filePath) {
  return import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
}

function contractRows() {
  return [
    ...contractsFor('catalog', repos.catalog),
    ...contractsFor('cart', repos.cart),
    ...contractsFor('checkout', repos.checkout),
  ];
}

function contractsFor(key, repoPath) {
  const manifestPath = path.join(repoPath, 'config/gitnexus-contracts.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return (manifest.contracts || []).map((contract) => ({
    repo: key,
    id: contract.id,
    role: contract.role,
    version: contract.version,
    links: contract.providers || contract.consumers || [],
  }));
}

function impactExamples() {
  return [
    {
      kind: '複雑',
      change: '商品情報の形を変える',
      contract: 'CATALOG_PRODUCT_CONTRACT',
      from: 'commerce-catalog-service',
      to: ['commerce-cart-service', 'commerce-checkout-service'],
    },
    {
      kind: '簡単',
      change: 'カートから会計へ渡す形を変える',
      contract: 'CART_CHECKOUT_CONTRACT',
      from: 'commerce-cart-service',
      to: ['commerce-checkout-service'],
    },
  ];
}

async function serveStatic(urlPath, response) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.normalize(path.join(publicDir, safePath));
  if (!resolved.startsWith(publicDir)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const filePath = existsSync(resolved) ? resolved : path.join(publicDir, 'index.html');
  response.writeHead(200, {
    'content-type': contentType(filePath),
    'cache-control': 'no-store',
  });
  response.end(await readFile(filePath));
}

function ensureRepos() {
  for (const repoPath of Object.values(repos)) {
    if (!existsSync(repoPath)) throw new Error(`Missing repo: ${repoPath}`);
  }
}

function clampQuantity(value) {
  const parsed = Number.parseInt(value || '2', 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(parsed, 9));
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function writeJson(response, payload, status = 200) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function contentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}
