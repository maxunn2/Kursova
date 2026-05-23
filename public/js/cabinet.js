/* ================================================
   js/cabinet.js — Особистий кабінет клієнта
   3 таби: Профіль / Заявки / Замовлення
   ================================================ */

let currentClient = null;

/* ── ІНІЦІАЛІЗАЦІЯ ── */
document.addEventListener('DOMContentLoaded', () => {
  // Захищена сторінка — якщо не залогінений, кидаємо на логін
  if (!requireAuth()) return;

  renderNavUser();
  loadProfile();
});

/* ── ЗАВАНТАЖЕННЯ ПРОФІЛЮ ── */
async function loadProfile() {
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) {
      // Токен недійсний — виходимо
      logout();
      return;
    }

    currentClient = await res.json();
    renderProfile(currentClient);

  } catch (err) {
    console.error(err);
  }
}

/* ── РЕНДЕР ПРОФІЛЮ ── */
function renderProfile(client) {
  // Шапка кабінету
  const initials = (client.first_name?.[0] || '') + (client.last_name?.[0] || '');
  document.getElementById('cab-avatar').textContent = initials.toUpperCase();
  document.getElementById('cab-name').textContent =
    `${client.first_name} ${client.last_name}`;
  document.getElementById('cab-phone').textContent = `📱 ${client.phone}`;

  if (client.email) {
    const emailEl = document.getElementById('cab-email');
    emailEl.textContent = `✉️ ${client.email}`;
    emailEl.style.display = 'inline';
  }

  // Тип клієнта
  if (client.client_type) {
    const typeEl = document.getElementById('cab-type');
    const typeMap = {
      'фізична особа':   { icon: '👤', color: '#94a3b8' },
      'юридична особа':  { icon: '🏢', color: '#0284c7' },
      'vip':             { icon: '⭐', color: '#f59e0b' },
    };
    const t = typeMap[client.client_type] || typeMap['фізична особа'];
    typeEl.innerHTML = `<span style="color:${t.color};font-weight:600;">${t.icon} ${client.client_type.toUpperCase()}</span>`;
    typeEl.style.display = 'inline';
  }

  // Поля форми
  document.getElementById('p-first-name').value = client.first_name || '';
  document.getElementById('p-last-name').value  = client.last_name || '';
  document.getElementById('p-phone').value      = client.phone || '';
  document.getElementById('p-email').value      = client.email || '';
}

/* ── ТАБИ ── */
function switchTab(tab, btnEl) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';

  if (tab === 'requests') loadRequests();
  if (tab === 'orders')   loadOrders();
}

/* ── ЗБЕРЕГТИ ПРОФІЛЬ ── */
async function saveProfile() {
  const first_name = document.getElementById('p-first-name').value.trim();
  const last_name  = document.getElementById('p-last-name').value.trim();
  const email      = document.getElementById('p-email').value.trim();
  const alertEl    = document.getElementById('alert-profile');
  const btn        = document.getElementById('save-btn');

  alertEl.style.display = 'none';

  if (!first_name || !last_name) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = "❌ Заповніть ім'я та прізвище!";
    alertEl.style.display = 'flex';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Збереження...';

  try {
    const res = await fetch(`${API}/clients/${currentClient.client_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email: email || null })
    });

    if (!res.ok) {
      alertEl.className = 'alert alert-error mb-16';
      alertEl.innerHTML = '❌ Помилка збереження';
      alertEl.style.display = 'flex';
      btn.disabled = false;
      btn.textContent = '💾 Зберегти зміни';
      return;
    }

    // Оновлюємо локально
    currentClient.first_name = first_name;
    currentClient.last_name  = last_name;
    currentClient.email      = email;
    localStorage.setItem('client', JSON.stringify(currentClient));

    alertEl.className = 'alert alert-success mb-16';
    alertEl.innerHTML = '✅ Дані збережено!';
    alertEl.style.display = 'flex';

    renderProfile(currentClient);
    renderNavUser();

    btn.disabled = false;
    btn.textContent = '💾 Зберегти зміни';

  } catch (err) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Сервер недоступний!';
    alertEl.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = '💾 Зберегти зміни';
  }
}

/* ── ЗАВАНТАЖИТИ ЗАЯВКИ ── */
async function loadRequests() {
  if (!currentClient) return;

  const loadingEl = document.getElementById('req-loading');
  const listEl    = document.getElementById('req-list');
  const emptyEl   = document.getElementById('req-empty');

  loadingEl.style.display = 'flex';
  listEl.innerHTML = '';
  emptyEl.style.display = 'none';

  try {
    const res = await fetch(`${API}/requests/client/${encodeURIComponent(currentClient.phone)}`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
    const requests = await res.json();

    loadingEl.style.display = 'none';

    if (!requests.length) {
      emptyEl.style.display = 'block';
      return;
    }

    requests.forEach(r => {
      listEl.innerHTML += renderRequestCard(r);
    });

  } catch (err) {
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'block';
  }
}

/* ── КАРТКА ЗАЯВКИ ── */
function renderRequestCard(r) {
  const statusBadge = getRequestStatusBadge(r.status);
  const date = new Date(r.request_date).toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Авто
  let carInfo = '';
  if (r.make && r.model) {
    carInfo = `
      <div class="request-card__row">
        <span class="request-card__label">🚗 Авто:</span>
        <a href="car.html?id=${r.car_id}" class="request-card__value" style="color:var(--primary);font-weight:600;">
          ${r.make} ${r.model} ${r.manufacture_year || ''}
        </a>
      </div>
    `;
  }

let managerInfo = '';

  // Search context
  let searchInfo = '';
  if (r.search_context) {
    try {
      const ctx = typeof r.search_context === 'string'
        ? JSON.parse(r.search_context)
        : r.search_context;

      const parts = [];
      if (ctx.make)      parts.push(`Марка: ${ctx.make}`);
      if (ctx.model)     parts.push(`Модель: ${ctx.model}`);
      if (ctx.fuel)      parts.push(`Пальне: ${ctx.fuel}`);
      if (ctx.trans)     parts.push(`Коробка: ${ctx.trans}`);
      if (ctx.yearFrom || ctx.yearTo) {
        parts.push(`Рік: ${ctx.yearFrom || '...'} – ${ctx.yearTo || '...'}`);
      }
      if (ctx.odoFrom || ctx.odoTo) {
        parts.push(`Пробіг: ${ctx.odoFrom || 0} – ${ctx.odoTo || '∞'} км`);
      }
      if (ctx.priceFrom || ctx.priceTo) {
        parts.push(`Ціна: $${ctx.priceFrom || 0} – $${ctx.priceTo || '∞'}`);
      }
      if (ctx.comment)   parts.push(`Коментар: ${ctx.comment}`);

      if (parts.length) {
        searchInfo = `
          <div class="search-context-box">
            <strong>📋 Деталі:</strong> ${parts.join(' • ')}
          </div>
        `;
      }
    } catch (e) { /* ignore */ }
  }

  return `
    <div class="request-card">
      <div class="request-card__header">
        <div>
          <div class="request-card__id">Заявка #${r.request_id}</div>
          <div class="request-card__date">${date}</div>
        </div>
        ${statusBadge}
      </div>

      <div class="request-card__row">
        <span class="request-card__label">📌 Тип:</span>
        <span class="request-card__value">${r.request_type}</span>
      </div>

      ${carInfo}
      ${searchInfo}
    </div>
  `;
}

/* ── СТАТУС ЗАЯВКИ ── */
function getRequestStatusBadge(status) {
  const map = {
    'нова':       '<span class="badge badge-info">🆕 Нова</span>',
    'в обробці':  '<span class="badge badge-warning">⏳ В обробці</span>',
    'погоджена':  '<span class="badge badge-success">✅ Погоджена</span>',
    'закрита':    '<span class="badge badge-gray">📁 Закрита</span>',
    'відмінена':  '<span class="badge badge-danger">❌ Відмінена</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status || 'нова'}</span>`;
}

/* ── ЗАВАНТАЖИТИ ЗАМОВЛЕННЯ ── */
async function loadOrders() {
  const loadingEl = document.getElementById('ord-loading');
  const listEl    = document.getElementById('ord-list');
  const emptyEl   = document.getElementById('ord-empty');

  loadingEl.style.display = 'flex';
  listEl.innerHTML = '';
  emptyEl.style.display = 'none';

  try {
    const res = await fetch(`${API}/tracking/my`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    const orders = await res.json();
    loadingEl.style.display = 'none';

    if (!orders.length) {
      emptyEl.style.display = 'block';
      return;
    }

    for (const o of orders) {
      const card = await renderOrderCard(o);
      listEl.innerHTML += card;
    }

  } catch (err) {
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'block';
  }
}

/* ── КАРТКА ЗАМОВЛЕННЯ + ТРЕКЕР ── */
async function renderOrderCard(o) {
  const date = o.contract_date
    ? new Date(o.contract_date).toLocaleDateString('uk-UA')
    : '—';

  const statusBadge = getOrderStatusBadge(o.order_status);
  const paymentBadge = getPaymentBadge(o.payment_status);

// Трекер показуємо ТІЛЬКИ якщо авто не "в наявності"
  let trackingHTML = '';
  if (o.car_status !== 'в наявності') {
    try {
      const trackRes = await fetch(`${API}/tracking/${o.order_id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (trackRes.ok) {
        const tracking = await trackRes.json();
        trackingHTML = renderTrackingTimeline(tracking);
      }
    } catch (e) { /* ignore */ }
  }

  // Фото авто (якщо є) — компактне ліворуч
  const imageHTML = o.image 
    ? `<img src="${o.image}" alt="${o.make} ${o.model}" 
           style="width:200px;height:140px;object-fit:cover;border-radius:var(--radius);
                  border:1px solid var(--border);flex-shrink:0;"/>`
    : '';

  return `
    <div class="card mb-24">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
        ${imageHTML}
        <div style="flex:1;min-width:240px;">
          <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;">
            🚗 ${o.make} ${o.model} ${o.manufacture_year || ''}
          </div>
          <div style="font-size:0.82rem;color:var(--text-light);margin-top:4px;">
            Замовлення #${o.order_id} • від ${date}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${statusBadge}
          ${paymentBadge}
        </div>
      </div>
        </div>
      </div>

      <div class="form-row" style="font-size:0.9rem;">
        <div>
          <div class="text-muted text-sm">Вартість авто</div>
          <div style="font-weight:700;color:var(--text);font-size:1.1rem;">
            $${Number(o.selling_price || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div class="text-muted text-sm">Сплачено</div>
          <div style="font-weight:700;color:var(--primary);font-size:1.1rem;">
            $${Number(o.total_amount || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div class="text-muted text-sm">Колір</div>
          <div style="font-weight:600;">${o.color || '—'}</div>
        </div>
        ${o.manager_name ? `
        <div>
          <div class="text-muted text-sm">Менеджер</div>
          <div style="font-weight:600;">${o.manager_name}</div>
          ${o.manager_phone ? `<a href="tel:${o.manager_phone}" style="font-size:0.82rem;">${o.manager_phone}</a>` : ''}
        </div>` : ''}
      </div>

      ${trackingHTML}
    </div>
  `;
}

/* ── ТРЕКЕР ДОСТАВКИ ── */
function renderTrackingTimeline(tracking) {
  if (!tracking || !tracking.length) {
    return `
      <div class="alert alert-info mt-16">
        ℹ️ Етапи доставки ще не зареєстровані. Зверніться до менеджера.
      </div>
    `;
  }

  let html = `
    <div class="mt-24">
      <h4 style="font-family:var(--font-head);font-weight:700;font-size:1rem;margin-bottom:16px;">
        📍 Відстеження доставки
      </h4>
      <div class="tracking-timeline">
  `;

  tracking.forEach((step, i) => {
    const isLast = i === tracking.length - 1;
    const date = new Date(step.status_date).toLocaleDateString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    html += `
      <div class="tracking-step ${isLast ? 'current' : 'done'}">
        <div class="tracking-step__line">
          <div class="tracking-step__dot"></div>
          ${i < tracking.length - 1 ? '<div class="tracking-step__connector"></div>' : ''}
        </div>
        <div class="tracking-step__content">
          <div class="tracking-step__label">${step.current_location || 'Етап'}</div>
          <div class="tracking-step__desc">${step.status_description || ''}</div>
          <div class="tracking-step__date">${date}</div>
          ${step.estimated_arrival ? `<div style="font-size:0.75rem;color:var(--primary);margin-top:2px;font-weight:600;">🎯Орієнтовне прибуття: ${new Date(step.estimated_arrival).toLocaleDateString('uk-UA')}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/* ── СТАТУС ЗАМОВЛЕННЯ ── */
function getOrderStatusBadge(status) {
  const map = {
    'оформлене':  '<span class="badge badge-info">📋 Оформлене</span>',
    'в дорозі':   '<span class="badge badge-warning">🚢 В дорозі</span>',
    'доставлено': '<span class="badge badge-success">✅ Доставлено</span>',
    'закрите':    '<span class="badge badge-gray">📁 Закрите</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status || '—'}</span>`;
}

function getPaymentBadge(status) {
  const map = {
    'не сплачено': '<span class="badge badge-danger">💰 Не сплачено</span>',
    'передоплата': '<span class="badge badge-warning">💵 Передоплата</span>',
    'сплачено':    '<span class="badge badge-success">✅ Сплачено</span>',
  };
  return map[status] || '';
}