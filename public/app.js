const state = {
  scenario: 'normal',
  quantity: 2,
};

const ui = {
  status: document.querySelector('#status'),
  productName: document.querySelector('#product-name'),
  productFacts: document.querySelector('#product-facts'),
  flowTitle: document.querySelector('#flow-title'),
  steps: document.querySelector('#steps'),
  summary: document.querySelector('#summary'),
  impactList: document.querySelector('#impact-list'),
  contracts: document.querySelector('#contracts'),
  quantity: document.querySelector('#quantity'),
  segments: document.querySelectorAll('.segment'),
};

for (const segment of ui.segments) {
  segment.addEventListener('click', () => {
    state.scenario = segment.dataset.scenario;
    for (const item of ui.segments) item.classList.toggle('is-active', item === segment);
    renderOrder();
  });
}

ui.quantity.addEventListener('input', () => {
  state.quantity = Number.parseInt(ui.quantity.value || '2', 10);
  renderOrder();
});

renderOrder();

async function renderOrder() {
  const query = new URLSearchParams({
    scenario: state.scenario,
    quantity: String(state.quantity),
  });
  const response = await fetch(`/api/order?${query.toString()}`);
  const order = await response.json();
  draw(order);
}

function draw(order) {
  ui.status.textContent = order.ok ? '注文OK' : '停止';
  ui.status.className = `status ${order.ok ? 'is-ok' : 'is-error'}`;
  ui.productName.textContent = order.product?.name || '商品なし';
  ui.productFacts.innerHTML = facts([
    ['商品ID', order.product?.id],
    ['カテゴリ', order.product?.category],
    ['税区分', order.product?.taxClass],
    ['在庫', order.product?.stockStatus],
    ['出荷地域', order.product?.fulfillmentRegion],
    ['価格', yen(order.product?.priceCents)],
  ]);
  ui.flowTitle.textContent = order.ok ? '最後まで通った' : '途中で止まった';
  ui.flowTitle.className = order.ok ? 'ok-text' : 'error-text';
  ui.steps.innerHTML = order.steps.map(step).join('');
  ui.summary.innerHTML = summary(order);
  ui.impactList.innerHTML = order.impact.map(impact).join('');
  ui.contracts.innerHTML = order.contracts.map(contract).join('');
}

function step(item) {
  const label = item.status === 'ok' ? '通過' : '停止';
  return `
    <section class="step ${item.status === 'ok' ? 'is-ok' : 'is-error'}">
      <span>${label}</span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.note)}</p>
    </section>
  `;
}

function summary(order) {
  return `
    <h3>注文内容</h3>
    <dl class="facts">${facts([
      ['数量', order.quantity],
      ['小計', yen(order.checkoutCart?.subtotalCents)],
      ['合計', yen(order.order?.totalCents ?? order.checkoutCart?.totalCents)],
      ['計算方式', order.order?.pricingMode ?? order.checkoutCart?.pricingMode],
      ['会計準備', order.checkoutCart?.checkoutReady ? 'OK' : undefined],
      ['状態', order.order?.status ?? '未確定'],
    ])}</dl>
  `;
}

function impact(item) {
  return `
    <section class="impact-card">
      <div class="impact-title">
        <span>${escapeHtml(item.kind)}</span>
        <strong>${escapeHtml(item.change)}</strong>
      </div>
      <code>${escapeHtml(item.contract)}</code>
      <p class="repo-line">${escapeHtml(item.from)} → ${item.to.map(escapeHtml).join(' / ')}</p>
    </section>
  `;
}

function contract(item) {
  const role = item.role === 'provider' ? '出す側' : '受ける側';
  return `<span>${escapeHtml(item.repo)} / ${escapeHtml(item.id)} v${escapeHtml(item.version)} / ${role}</span>`;
}

function facts(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<div><dt>${escapeHtml(String(label))}</dt><dd>${escapeHtml(String(value))}</dd></div>`)
    .join('');
}

function yen(value) {
  if (!Number.isFinite(value)) return '未確定';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
