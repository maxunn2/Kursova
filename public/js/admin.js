/* ================================================
   js/admin.js — Адмін-панель
   Логіка для адміністратора та менеджерів
   ================================================ */

let currentEmployee = null;
let allRequests = [];
let allOrders = [];
let allCars = [];
let allClients = [];
let allManagers = []; // Менеджери (без адмінів) — для селектів в таблицях
let allEmployees = [];
let currentEditId = null; // ID записа що редагуємо

/* ── ІНІЦІАЛІЗАЦІЯ ── */
document.addEventListener('DOMContentLoaded', () => {
  // Перевірка авторизації адміна
  if (!localStorage.getItem('admin_token')) {
    window.location.href = 'admin-login.html';
    return;
  }

  loadCurrentEmployee();
});
/* ── ОБГОРТКА ДЛЯ ВСІХ API-ЗАПИТІВ З ТОКЕНОМ ── */
async function apiFetch(url, options = {}) {
  const opts = { ...options };
  opts.headers = {
    ...(opts.headers || {}),
    'Authorization': `Bearer ${adminToken()}`
  };
  const res = await fetch(url, opts);
  // Якщо токен невалідний — кидаємо на логін
  if (res.status === 401) {
    adminLogout();
    return Promise.reject(new Error('Unauthorized'));
  }
  return res;
}
/* ── ДОПОМІЖНІ ── */
function adminToken() {
  return localStorage.getItem('admin_token');
}

function adminAuthHeader() {
  return { 'Authorization': `Bearer ${adminToken()}` };
}

function adminLogout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_employee');
  window.location.href = 'admin-login.html';
}

/* ── ЗАВАНТАЖИТИ ДАНІ ПОТОЧНОГО КОРИСТУВАЧА ── */
async function loadCurrentEmployee() {
  try {
    const res = await apiFetch(`${API}/admin-auth/me`, { headers: adminAuthHeader() });

    if (!res.ok) {
      adminLogout();
      return;
    }

    currentEmployee = await res.json();
    renderUser();
    applyRoleVisibility();
    await loadAllManagers(); // ← завантажуємо менеджерів один раз
    loadOverview();

  } catch (err) {
    adminLogout();
  }
}

/* ── ТОП-БАР: ім'я + аватар ── */
function renderUser() {
  const initials = (currentEmployee.first_name?.[0] || '') + (currentEmployee.last_name?.[0] || '');
  document.getElementById('user-name').textContent = `${currentEmployee.first_name} ${currentEmployee.last_name}`;
  document.getElementById('user-role').textContent = currentEmployee.position;
  document.getElementById('user-avatar').textContent = initials.toUpperCase();
}

/* ── ВИДИМІСТЬ ПУНКТІВ ЗАЛЕЖНО ВІД РОЛІ ── */
function applyRoleVisibility() {
  const isAdmin = currentEmployee.position === 'Адміністратор';
  document.body.classList.toggle('is-manager', !isAdmin);
  // Адмінські розділи (Авто, Персонал) — тільки для адміна
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  const titleEl = document.getElementById('admin-only-title');
  if (titleEl) titleEl.style.display = isAdmin ? '' : 'none';
  
  // Клієнти — переміщуємо в "Адміністрування" якщо адмін, в основне меню якщо менеджер
  // (тут нічого не робимо — обидва бачать)
  
  // Кнопка "Нова заявка" — тільки для менеджерів, не для адміна
  document.querySelectorAll('.manager-only').forEach(el => {
    el.style.display = isAdmin ? 'none' : '';
  });
}

/* ── ПЕРЕМИКАННЯ СЕКЦІЙ ── */
function showSection(section, btnEl) {
  document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${section}`).style.display = 'block';

  if (section === 'overview')  loadOverview();
  if (section === 'requests')  loadRequests();
  if (section === 'orders')    loadOrders();
  if (section === 'cars')      loadCars();
  if (section === 'clients')   loadClients();
  if (section === 'employees') loadEmployees();
}
/* ── ЗАВАНТАЖИТИ МЕНЕДЖЕРІВ (один раз при старті) ── */
async function loadAllManagers() {
  try {
    const res = await apiFetch(`${API}/employees`);
    const all = await res.json();
    // Виключаємо адмінів — на заявки/замовлення призначаємо тільки менеджерів
    allManagers = all.filter(e => e.position !== 'Адміністратор');
  } catch (err) {
    console.error('Не вдалося завантажити менеджерів:', err);
    allManagers = [];
  }
}

/* ════════════════════════════════════════
   📊 ОГЛЯД
   ════════════════════════════════════════ */
async function loadOverview() {
  try {
    const [reqRes, ordRes, carRes, clRes] = await Promise.all([
      apiFetch(`${API}/requests`),
      apiFetch(`${API}/orders`),
      apiFetch(`${API}/cars`),
      apiFetch(`${API}/clients`),
    ]);

    const requests = await reqRes.json();
    const orders   = await ordRes.json();
    const cars     = await carRes.json();
    const clients  = await clRes.json();

    // Статистика
    const newReq    = requests.filter(r => !r.status || r.status === 'новий').length;
    const inProgOrd = orders.filter(o => o.order_status === 'новий' || o.order_status === 'в процесі').length;

    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card">
        <div class="stat-card__icon blue">📋</div>
        <div>
          <div class="stat-card__val">${requests.length}</div>
          <div class="stat-card__lbl">Всього заявок</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon amber">🆕</div>
        <div>
          <div class="stat-card__val">${newReq}</div>
          <div class="stat-card__lbl">Нових заявок</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon green">🚢</div>
        <div>
          <div class="stat-card__val">${inProgOrd}</div>
          <div class="stat-card__lbl">Замовлень в обробці</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon blue">🚗</div>
        <div>
          <div class="stat-card__val">${cars.length}</div>
          <div class="stat-card__lbl">Авто в наявності</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon green">👥</div>
        <div>
          <div class="stat-card__val">${clients.length}</div>
          <div class="stat-card__lbl">Клієнтів</div>
        </div>
      </div>
    `;

    // Останні 5 заявок
    const recent = requests.slice(0, 5);
    const recentEl = document.getElementById('recent-requests');
    if (!recent.length) {
      recentEl.innerHTML = '<div class="text-muted text-sm">Заявок ще немає</div>';
    } else {
      let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Клієнт</th><th>Тип</th><th>Дата</th><th>Статус</th></tr></thead><tbody>';
      recent.forEach(r => {
        html += `<tr>
          <td>#${r.request_id}</td>
          <td>${r.client_name}<br><span class="text-muted text-sm">${r.client_phone}</span></td>
          <td>${r.request_type}</td>
          <td>${formatDate(r.request_date)}</td>
          <td>${getReqStatusBadge(r.status)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      recentEl.innerHTML = html;
    }

  } catch (err) {
    console.error(err);
  }
}

/* ════════════════════════════════════════
   📋 ЗАЯВКИ
   ════════════════════════════════════════ */
async function loadRequests() {
  try {
    let url = `${API}/requests`;
    // Менеджер бачить тільки свої заявки
    if (currentEmployee.position !== 'Адміністратор') {
      url = `${API}/requests/manager/${currentEmployee.employee_id}`;
    }
    const res = await apiFetch(url);
    let requests = await res.json();
    
    // Для менеджера підставляємо його імя у всі заявки (API повертає без менеджера)
    if (currentEmployee.position !== 'Адміністратор') {
      requests = requests.map(r => ({
        ...r,
        manager_name: `${currentEmployee.first_name} ${currentEmployee.last_name}`
      }));
    }
    
    allRequests = requests;
    renderRequests(allRequests);
  } catch (err) { console.error(err); }
}

function renderRequests(requests) {
  const tbody = document.getElementById('requests-tbody');
  const empty = document.getElementById('requests-empty');

  if (!requests.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = requests.map(r => {
   const car = (r.make && r.model) 
      ? `<a href="car.html?id=${r.car_id}" target="_blank" style="color:var(--primary);font-weight:600;">#${r.car_id} — ${r.make} ${r.model}</a>` 
      : '<span class="text-muted">—</span>';
    let ctxHTML = '<span class="text-muted">—</span>';
    if (r.search_context) {
      try {
        const ctx = typeof r.search_context === 'string' ? JSON.parse(r.search_context) : r.search_context;
        const parts = [];
        if (ctx.make)      parts.push(`${ctx.make}`);
        if (ctx.model)     parts.push(`${ctx.model}`);
        if (ctx.fuel)      parts.push(`${ctx.fuel}`);
        if (ctx.trans)     parts.push(`${ctx.trans}`);
        if (ctx.yearFrom || ctx.yearTo) {
          parts.push(`📅 ${ctx.yearFrom || '...'}–${ctx.yearTo || '...'}`);
        }
        if (ctx.odoFrom || ctx.odoTo) {
          parts.push(`🛣️ ${ctx.odoFrom || 0}–${ctx.odoTo || '∞'} км`);
        }
        if (ctx.priceFrom || ctx.priceTo) {
          parts.push(`💰 $${ctx.priceFrom || 0}–$${ctx.priceTo || '∞'}`);
        }
        if (ctx.comment)   parts.push(`💬 "${ctx.comment}"`);
        if (parts.length) ctxHTML = `<div class="ctx-box">${parts.join(' • ')}</div>`;
      } catch(e) {}
    }

    return `<tr>
      <td>#${r.request_id}</td>
      <td><strong>${r.client_name}</strong><br><span class="text-muted text-sm">${r.client_phone}</span></td>
      <td>${r.request_type}</td>
      <td>${car}</td>
      <td>${ctxHTML}</td>
      <td>${renderManagerCell(r.employee_id, r.manager_name, 'request', r.request_id)}</td>
      <td>${getReqStatusBadge(r.status)}</td>
      <td><span class="text-sm">${formatDate(r.request_date)}</span></td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" title="Редагувати" onclick="editRequest(${r.request_id})">✏️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterRequests() {
  const search = document.getElementById('req-search').value.toLowerCase();
  const type   = document.getElementById('req-filter-type').value;
  const status = document.getElementById('req-filter-status').value;

  let f = allRequests;
  if (search) f = f.filter(r => 
    (r.client_name || '').toLowerCase().includes(search) ||
    (r.client_phone || '').toLowerCase().includes(search)
  );
  if (type)   f = f.filter(r => r.request_type === type);
  if (status) f = f.filter(r => (r.status || 'нова') === status);

  renderRequests(f);
}

function editRequest(id) {
  const r = allRequests.find(x => x.request_id === id);
  if (!r) return;
  currentEditId = id;
  document.getElementById('rm-id').textContent = id;

  let body = `
    <div class="form-row">
      <div><strong>👤 Клієнт:</strong><br>${r.client_name}</div>
      <div><strong>📱 Телефон:</strong><br>${r.client_phone}</div>
      <div><strong>📌 Тип:</strong><br>${r.request_type}</div>
      <div><strong>📅 Дата:</strong><br>${formatDate(r.request_date)}</div>
    </div>
  `;
  if (r.make && r.model) {
    body += `<div class="mt-16"><strong>🚗 Авто:</strong> ${r.make} ${r.model} ${r.manufacture_year || ''}</div>`;
  }
  if (r.search_context) {
    body += `<div class="ctx-box mt-16">${typeof r.search_context === 'string' ? r.search_context : JSON.stringify(r.search_context)}</div>`;
  }

  document.getElementById('rm-body').innerHTML = body;
  document.getElementById('rm-status').value = r.status || 'нова';
  openModal('request-modal');
}

async function saveRequestStatus() {
  const status = document.getElementById('rm-status').value;
  try {
    await apiFetch(`${API}/requests/${currentEditId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    closeModal('request-modal');
    loadRequests();
  } catch (err) { alert('Помилка'); }
}

function getReqStatusBadge(status) {
  const map = {
    'новий':      '<span class="badge badge-info">🆕 Новий</span>',
    'в обробці':  '<span class="badge badge-warning">⏳ В обробці</span>',
    'виконано':   '<span class="badge badge-success">✅ Виконано</span>',
    'скасовано':  '<span class="badge badge-danger">❌ Скасовано</span>',
  };
  return map[status] || map['новий'];
}

/* ════════════════════════════════════════
   🚢 ЗАМОВЛЕННЯ
   ════════════════════════════════════════ */
async function loadOrders() {
  try {
    const res = await apiFetch(`${API}/orders`);
    let orders = await res.json();
    
    // Менеджер бачить тільки свої замовлення
    if (currentEmployee.position !== 'Адміністратор') {
      orders = orders.filter(o => o.employee_id === currentEmployee.employee_id);
    }
    
    allOrders = orders;
    renderOrders(allOrders);
  } catch (err) { console.error(err); }
}

function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  const empty = document.getElementById('orders-empty');

  if (!orders.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

tbody.innerHTML = orders.map(o => {
    // Кнопка трекінгу тільки якщо авто НЕ "в наявності"
    const trackBtn = (o.car_status && o.car_status !== 'в наявності')
      ? `<button class="icon-btn" title="Етапи доставки" onclick="openTrackingModal(${o.order_id})">📍</button>`
      : '';
    return `
    <tr>
      <td>#${o.order_id}</td>
      <td>${o.client_first || ''} ${o.client_last || ''}<br><span class="text-muted text-sm">${o.client_phone || ''}</span></td>
      <td>#${o.car_id} — ${o.make || ''} ${o.model || ''}</td>
      <td><strong>$${Number(o.total_amount || 0).toLocaleString()}</strong></td>
      <td>${getPaymentBadge(o.payment_status)}</td>
      <td>${getOrderStatusBadge(o.order_status)}</td>
      <td>${renderManagerCell(o.employee_id, `${o.manager_first || ''} ${o.manager_last || ''}`.trim(), 'order', o.order_id)}</td>
      <td><span class="text-sm">${formatDate(o.contract_date)}</span></td>
      <td><span class="text-sm" style="color:var(--text-muted);">${formatDateTime(o.last_modified)}</span></td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" title="Редагувати" onclick="editOrder(${o.order_id})">✏️</button>
          ${trackBtn}
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

async function openOrderModal() {
  currentEditId = null;
  document.getElementById('om-title').textContent = '🚢 Нове замовлення';
  ['om-amount'].forEach(id => document.getElementById(id).value = '');
  await populateOrderSelects();
  openModal('order-modal');
}

async function editOrder(id) {
  const o = allOrders.find(x => x.order_id === id);
  if (!o) return;
  currentEditId = id;
  document.getElementById('om-title').textContent = `🚢 Замовлення #${id}`;

  await populateOrderSelects();
  document.getElementById('om-client').value   = o.client_id;
  document.getElementById('om-car').value      = o.car_id;
  document.getElementById('om-employee').value = o.employee_id;
  document.getElementById('om-amount').value   = o.total_amount;
  // Після підстановки авто — оновити ціну
  document.getElementById('om-car').dispatchEvent(new Event('change'));
  document.getElementById('om-payment').value  = o.payment_status || 'не сплачено';
  document.getElementById('om-status').value   = o.order_status || 'оформлене';
  openModal('order-modal');
}

async function populateOrderSelects() {
  // Клієнти
  const clRes = await apiFetch(`${API}/clients`);
  const clients = await clRes.json();
  const clSel = document.getElementById('om-client');
  clSel.innerHTML = clients.map(c => `<option value="${c.client_id}">#${c.client_id} — ${c.first_name} ${c.last_name} (${c.phone})</option>`).join('');

 // Авто — всі статуси (в наявності + в дорозі + на аукціоні)
  const carsRes = await apiFetch(`${API}/cars/all`);
  const cars = await carsRes.json();
  const carSel = document.getElementById('om-car');
 carSel.innerHTML = cars.map(c => {
    const vin = c.vin_code ? ` • VIN: ${c.vin_code.slice(-6)}` : '';
    return `<option value="${c.car_id}">#${c.car_id} — ${c.make} ${c.model} ${c.manufacture_year || ''}${vin}</option>`;
  }).join('');

  // Менеджери — для адміна вибір, для менеджера тільки він сам
  const empRes = await apiFetch(`${API}/employees`);
  const emps = await empRes.json();
  const empSel = document.getElementById('om-employee');

  if (currentEmployee.position === 'Адміністратор') {
    // Адмін бачить всіх менеджерів (без інших адмінів)
    const managers = emps.filter(e => e.position !== 'Адміністратор');
    empSel.innerHTML = managers.map(e => `<option value="${e.employee_id}">${e.first_name} ${e.last_name} — ${e.position}</option>`).join('');
    empSel.disabled = false;
  } else {
    // Менеджер бачить тільки себе і не може змінити
    empSel.innerHTML = `<option value="${currentEmployee.employee_id}">${currentEmployee.first_name} ${currentEmployee.last_name} — ${currentEmployee.position}</option>`;
    empSel.disabled = true;
  }
  // При виборі авто — підставляти його ціну
  carSel.addEventListener('change', () => {
    const carId = parseInt(carSel.value);
    const selectedCar = cars.find(x => x.car_id === carId);
    if (selectedCar) {
      document.getElementById('om-car-price').value = selectedCar.selling_price 
        ? `$${Number(selectedCar.selling_price).toLocaleString()}`
        : 'Не вказана';
    }
  });
  // Викликати один раз для першого авто
  carSel.dispatchEvent(new Event('change'));
}

async function saveOrder() {
  const data = {
    client_id:      parseInt(document.getElementById('om-client').value),
    car_id:         parseInt(document.getElementById('om-car').value),
    employee_id:    parseInt(document.getElementById('om-employee').value),
    total_amount:   parseFloat(document.getElementById('om-amount').value) || 0,
    payment_status: document.getElementById('om-payment').value,
    order_status:   document.getElementById('om-status').value,
  };

  try {
    const url = currentEditId ? `${API}/orders/${currentEditId}` : `${API}/orders`;
    const method = currentEditId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      showModalAlert('om-alert', '❌ Помилка збереження');
      return;
    }

    closeModal('order-modal');
    loadOrders();
  } catch (err) {
    showModalAlert('om-alert', '❌ Сервер недоступний');
  }
}

function getOrderStatusBadge(status) {
  const map = {
    'новий':     '<span class="badge badge-info">📋 Новий</span>',
    'в процесі': '<span class="badge badge-warning">⏳ В процесі</span>',
    'завершено': '<span class="badge badge-success">✅ Завершено</span>',
    'скасовано': '<span class="badge badge-danger">❌ Скасовано</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status || '—'}</span>`;
}

function getPaymentBadge(status) {
  const map = {
    'очікує оплати':     '<span class="badge badge-warning">⏳ Очікує оплати</span>',
    'частково сплачено': '<span class="badge badge-info">💵 Частково сплачено</span>',
    'оплачено':          '<span class="badge badge-success">✅ Оплачено</span>',
  };
  return map[status] || '<span class="badge badge-gray">—</span>';
}

/* ════════════════════════════════════════
   🚗 АВТО
   ════════════════════════════════════════ */
async function loadCars() {
  try {
    const res = await apiFetch(`${API}/cars/all`);
    allCars = await res.json();
    renderCars(allCars);
  } catch (err) { console.error(err); }
}

function renderCars(cars) {
  const tbody = document.getElementById('cars-tbody');
  const empty = document.getElementById('cars-empty');

  if (!cars.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = cars.map(c => `
    <tr>
      <td>#${c.car_id}</td>
      <td><strong>${c.make}</strong> ${c.model}</td>
      <td>${c.manufacture_year || '—'}</td>
      <td><span style="font-family:monospace;font-size:0.78rem;">${c.vin_code || '—'}</span></td>
      <td>${c.fuel_type || '—'}</td>
      <td>${c.odometer ? Number(c.odometer).toLocaleString() + ' км' : '—'}</td>
      <td class="admin-only-col" style="color:var(--text-muted);">${c.purchase_price ? '$' + Number(c.purchase_price).toLocaleString() : '—'}</td>
      <td><strong>${c.selling_price ? '$' + Number(c.selling_price).toLocaleString() : '—'}</strong></td>
      <td>${getCarStatusBadge(c.car_status)}</td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" title="Редагувати" onclick="editCar(${c.car_id})">✏️</button>
          <button class="icon-btn danger" title="Видалити" onclick="deleteCar(${c.car_id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}






function filterCars() {
  const search = document.getElementById('car-search').value.toLowerCase();
  const status = document.getElementById('car-filter-status').value;

  let f = allCars;
  if (search) f = f.filter(c => 
    (c.make || '').toLowerCase().includes(search) ||
    (c.model || '').toLowerCase().includes(search) ||
    (c.vin_code || '').toLowerCase().includes(search)
  );
  if (status) f = f.filter(c => c.car_status === status);

  renderCars(f);
}

function openCarModal() {
  currentEditId = null;
  document.getElementById('cm-title').textContent = '🚗 Додати авто';
  ['cm-make','cm-model','cm-year','cm-vin','cm-fuel','cm-trans','cm-color','cm-engine','cm-drive','cm-odo','cm-price']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('cm-status').value = 'в наявності';
  document.getElementById('cm-image-preview').style.display = 'none';
  document.getElementById('cm-image-file').value = '';
  document.getElementById('cm-purchase').value = '';
  // Показати поле закупки тільки для адміна
  document.getElementById('cm-purchase-group').style.display = 
    currentEmployee.position === 'Адміністратор' ? 'block' : 'none';
  openModal('car-modal');
}

function editCar(id) {
  const c = allCars.find(x => x.car_id === id);
  if (!c) return;
  currentEditId = id;
  document.getElementById('cm-title').textContent = `🚗 Редагувати авто #${id}`;
  document.getElementById('cm-make').value   = c.make || '';
  document.getElementById('cm-model').value  = c.model || '';
  document.getElementById('cm-year').value   = c.manufacture_year || '';
  document.getElementById('cm-vin').value    = c.vin_code || '';
  document.getElementById('cm-fuel').value   = c.fuel_type || '';
  document.getElementById('cm-trans').value  = c.transmission || '';
  document.getElementById('cm-color').value  = c.color || '';
  document.getElementById('cm-engine').value = c.engine_volume || '';
  document.getElementById('cm-drive').value  = c.drivetrain || '';
  document.getElementById('cm-odo').value    = c.odometer || '';
  document.getElementById('cm-price').value  = c.selling_price || '';
  document.getElementById('cm-status').value = c.car_status || 'в наявності';
  // Показати поточне фото якщо є
  const imgEl = document.getElementById('cm-image-current');
  const previewEl = document.getElementById('cm-image-preview');
  if (c.image) {
    imgEl.src = c.image;
    previewEl.style.display = 'block';
  } else {
    previewEl.style.display = 'none';
  }
  document.getElementById('cm-image-file').value = '';
  document.getElementById('cm-purchase').value = c.purchase_price || '';
  document.getElementById('cm-purchase-group').style.display = 
    currentEmployee.position === 'Адміністратор' ? 'block' : 'none';
  openModal('car-modal');
}

async function saveCar() {
  const data = {
    make:             document.getElementById('cm-make').value.trim(),
    model:            document.getElementById('cm-model').value.trim(),
    manufacture_year: parseInt(document.getElementById('cm-year').value) || null,
    vin_code:         document.getElementById('cm-vin').value.trim() || null,
    fuel_type:        document.getElementById('cm-fuel').value || null,
    transmission:     document.getElementById('cm-trans').value || null,
    color:            document.getElementById('cm-color').value.trim() || null,
    engine_volume:    parseFloat(document.getElementById('cm-engine').value) || null,
    drivetrain:       document.getElementById('cm-drive').value || null,
    odometer:         parseInt(document.getElementById('cm-odo').value) || null,
    selling_price:    parseFloat(document.getElementById('cm-price').value) || null,
    purchase_price:   parseFloat(document.getElementById('cm-purchase').value) || null,
    car_status:       document.getElementById('cm-status').value,
  };

  if (!data.make || !data.model) {
    showModalAlert('cm-alert', '❌ Введіть марку і модель!');
    return;
  }

  try {
    // 1. Зберігаємо авто в БД
    const res = await apiFetch(`${API}/cars${currentEditId ? '/' + currentEditId : ''}`, {
      method: currentEditId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      showModalAlert('cm-alert', '❌ Помилка збереження');
      return;
    }
    const result = await res.json();
    const carId = currentEditId || result.car_id;

    // 2. Якщо є фото — завантажуємо
    const fileInput = document.getElementById('cm-image-file');
    if (fileInput.files && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);

      const uploadRes = await apiFetch(`${API}/upload/cars/${carId}`, {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        // Оновлюємо поле image в БД
        await apiFetch(`${API}/cars/${carId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: uploadData.imagePath })
        });
      }
    }

    closeModal('car-modal');
    loadCars();
  } catch (err) {
    showModalAlert('cm-alert', '❌ Сервер недоступний');
  }
}

/* ── ВИДАЛЕННЯ АВТО ── */
async function deleteCar(id) {
  const car = allCars.find(x => x.car_id === id);
  const carInfo = car ? `${car.make} ${car.model} (#${id})` : `#${id}`;

  if (!confirm(`Ви впевнені, що хочете видалити авто ${carInfo}?\nЦю дію неможливо скасувати.`)) {
    return;
  }

  try {
    const res = await apiFetch(`${API}/cars/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`❌ ${err.error || 'Не вдалося видалити авто'}`);
      return;
    }

    loadCars();
  } catch (err) {
    console.error('Помилка видалення авто:', err);
    alert('❌ Сервер недоступний');
  }
}






/* ════════════════════════════════════════
   👥 КЛІЄНТИ
   ════════════════════════════════════════ */
async function loadClients() {
  try {
    const res = await apiFetch(`${API}/clients`);
    allClients = await res.json();
    renderClients(allClients);
  } catch (err) { console.error(err); }
}

function renderClients(clients) {
  const tbody = document.getElementById('clients-tbody');
  const empty = document.getElementById('clients-empty');

  if (!clients.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td>#${c.client_id}</td>
      <td><strong>${c.first_name} ${c.last_name}</strong></td>
      <td>${c.phone}</td>
      <td>${c.email || '<span class="text-muted">—</span>'}</td>
      <td>${getClientTypeBadge(c.client_type)}</td>
      <td><span class="text-sm">${formatDate(c.created_at)}</span></td>
      <td>
        <button class="icon-btn" onclick="editClient(${c.client_id})">✏️</button>
      </td>
    </tr>
  `).join('');
}

function filterClients() {
  const search = document.getElementById('client-search').value.toLowerCase();
  const type   = document.getElementById('client-filter-type').value;

  let f = allClients;
  if (search) f = f.filter(c => 
    (c.first_name || '').toLowerCase().includes(search) ||
    (c.last_name || '').toLowerCase().includes(search) ||
    (c.phone || '').toLowerCase().includes(search) ||
    (c.email || '').toLowerCase().includes(search)
  );
  if (type) f = f.filter(c => c.client_type === type);

  renderClients(f);
}

function openClientModal() {
  currentEditId = null;
  document.getElementById('clm-title').textContent = '👤 Додати клієнта';
  document.getElementById('clm-first').value = '';
  document.getElementById('clm-last').value  = '';
  document.getElementById('clm-phone').value = '';
  document.getElementById('clm-email').value = '';
  document.getElementById('clm-type').value  = 'фізична особа';
  document.getElementById('clm-phone').disabled = false;
  openModal('client-modal');
}

function editClient(id) {
  const c = allClients.find(x => x.client_id === id);
  if (!c) return;
  currentEditId = id;
  document.getElementById('clm-title').textContent = `👤 Редагувати клієнта #${id}`;
  document.getElementById('clm-first').value = c.first_name || '';
  document.getElementById('clm-last').value  = c.last_name || '';
  document.getElementById('clm-phone').value = c.phone || '';
  document.getElementById('clm-email').value = c.email || '';
  document.getElementById('clm-type').value  = c.client_type || 'фізична особа';
  document.getElementById('clm-phone').disabled = true; // при редагуванні забороняємо змінювати
  openModal('client-modal');
}

async function saveClient() {
  let phone = document.getElementById('clm-phone').value.trim();
  // Нормалізація телефону
  phone = phone.replace(/\s/g, '').replace(/-/g, '');
  if (phone.startsWith('0')) phone = '+38' + phone;

  const data = {
    first_name:  document.getElementById('clm-first').value.trim(),
    last_name:   document.getElementById('clm-last').value.trim(),
    email:       document.getElementById('clm-email').value.trim() || null,
    client_type: document.getElementById('clm-type').value,
  };

  // Для нового клієнта додаємо телефон
  if (!currentEditId) {
    data.phone = phone;
  }

  if (!data.first_name || !data.last_name || (!currentEditId && !phone)) {
    showModalAlert('clm-alert', '❌ Заповніть обов\'язкові поля!');
    return;
  }

  try {
    const url    = currentEditId ? `${API}/clients/${currentEditId}` : `${API}/clients`;
    const method = currentEditId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) {
      showModalAlert('clm-alert', `❌ ${result.error || 'Помилка'}`);
      return;
    }

    closeModal('client-modal');
    loadClients();
  } catch (err) { 
    showModalAlert('clm-alert', '❌ Сервер недоступний'); 
  }
}

function getClientTypeBadge(type) {
  const map = {
    'фізична особа':  '<span class="badge badge-gray">👤 Фіз. особа</span>',
    'юридична особа': '<span class="badge badge-info">🏢 Юр. особа</span>',
    'vip':            '<span class="badge" style="background:#fef3c7;color:#d97706;">⭐ VIP</span>',
  };
  return map[type] || '<span class="badge badge-gray">—</span>';
}

/* ════════════════════════════════════════
   👨‍💼 ПЕРСОНАЛ
   ════════════════════════════════════════ */
async function loadEmployees() {
  try {
    const res = await apiFetch(`${API}/employees`);
    allEmployees = await res.json();
    renderEmployees(allEmployees);
  } catch (err) { console.error(err); }
}

function renderEmployees(employees) {
  const tbody = document.getElementById('employees-tbody');
  tbody.innerHTML = employees.map(e => `
    <tr>
      <td>#${e.employee_id}</td>
      <td><strong>${e.first_name} ${e.last_name}</strong></td>
      <td>${e.email || '<span class="text-muted">—</span>'}</td>
      <td>${e.phone || '—'}</td>
      <td>${getPositionBadge(e.position)}</td>
      <td><span class="text-sm">${formatDate(e.hire_date)}</span></td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" onclick="editEmployee(${e.employee_id})">✏️</button>
          <button class="icon-btn danger" onclick="deleteEmployee(${e.employee_id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEmployeeModal() {
  currentEditId = null;
  document.getElementById('em-title').textContent = '👨‍💼 Додати співробітника';
  ['em-first','em-last','em-phone','em-email','em-password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('em-position').value = 'Менеджер авто в наявності';
  openModal('employee-modal');
}

function editEmployee(id) {
  const e = allEmployees.find(x => x.employee_id === id);
  if (!e) return;
  currentEditId = id;
  document.getElementById('em-title').textContent = `👨‍💼 Редагувати співробітника #${id}`;
  document.getElementById('em-first').value    = e.first_name || '';
  document.getElementById('em-last').value     = e.last_name || '';
  document.getElementById('em-phone').value    = e.phone || '';
  document.getElementById('em-email').value    = e.email || '';
  document.getElementById('em-position').value = e.position;
  document.getElementById('em-password').value = '';
  openModal('employee-modal');
}

async function saveEmployee() {
  const data = {
    first_name: document.getElementById('em-first').value.trim(),
    last_name:  document.getElementById('em-last').value.trim(),
    phone:      document.getElementById('em-phone').value.trim(),
    email:      document.getElementById('em-email').value.trim() || null,
    position:   document.getElementById('em-position').value,
  };

  const password = document.getElementById('em-password').value;
  if (password) {
    if (password.length < 6) {
      showModalAlert('em-alert', '❌ Пароль має бути мінімум 6 символів!');
      return;
    }
    // Хешуємо на бекенді — додамо в employees.js
    data.password = password;
  }

  if (!data.first_name || !data.last_name || !data.phone) {
    showModalAlert('em-alert', '❌ Заповніть обов\'язкові поля!');
    return;
  }

  try {
    const res = await apiFetch(`${API}/employees${currentEditId ? '/' + currentEditId : ''}`, {
      method: currentEditId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      showModalAlert('em-alert', `❌ ${err.error || 'Помилка'}`);
      return;
    }
    closeModal('employee-modal');
    loadEmployees();
  } catch (err) {
    showModalAlert('em-alert', '❌ Сервер недоступний');
  }
}

async function deleteEmployee(id) {
  if (!confirm(`Видалити співробітника #${id}?`)) return;
  try {
    await apiFetch(`${API}/employees/${id}`, { method: 'DELETE' });
    loadEmployees();
  } catch (err) { alert('Помилка'); }
}

function getPositionBadge(position) {
  const map = {
    'Адміністратор':           '<span class="badge" style="background:#fef3c7;color:#d97706;">⭐ Адмін</span>',
    'Менеджер авто в наявності':'<span class="badge badge-info">🚗 Менеджер наявності</span>',
    'Менеджер з пригону':      '<span class="badge badge-success">🌎 Менеджер пригону</span>',
  };
  return map[position] || `<span class="badge badge-gray">${position}</span>`;
}

/* ════════════════════════════════════════
   ХЕЛПЕРИ
   ════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  const alertEl = document.getElementById(id).querySelector('.alert');
  if (alertEl) alertEl.style.display = 'none';
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this.id);
  });
});

function showModalAlert(id, message) {
  const el = document.getElementById(id);
  el.className = 'alert alert-error mb-16';
  el.innerHTML = message;
  el.style.display = 'flex';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Рендер клітинки з менеджером — селект для адміна, текст для менеджера
function renderManagerCell(currentId, currentName, kind, recordId) {
  // Менеджеру показуємо тільки текст
  if (currentEmployee.position !== 'Адміністратор') {
    return currentName || '<span class="text-muted">—</span>';
  }
  // Адміну — селект з усіма менеджерами
  const handler = kind === 'request' ? 'changeRequestManager' : 'changeOrderManager';
  const options = allManagers.map(m => 
    `<option value="${m.employee_id}" ${m.employee_id === currentId ? 'selected' : ''}>${m.first_name} ${m.last_name}</option>`
  ).join('');
  return `
    <select class="inline-select" onchange="${handler}(${recordId}, this.value)">
      <option value="">— Не призначено —</option>
      ${options}
    </select>
  `;
}

async function changeRequestManager(requestId, employeeId) {
  try {
    const res = await apiFetch(`${API}/requests/${requestId}/manager`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId || null })
    });
    if (!res.ok) { alert('❌ Помилка зміни менеджера'); return; }
    loadRequests();
  } catch (err) { alert('❌ Сервер недоступний'); }
}

async function changeOrderManager(orderId, employeeId) {
  try {
    const res = await apiFetch(`${API}/orders/${orderId}/manager`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId || null })
    });
    if (!res.ok) { alert('❌ Помилка зміни менеджера'); return; }
    loadOrders();
  } catch (err) { alert('❌ Сервер недоступний'); }
}
/* ════════════════════════════════════════
   📍 ЕТАПИ ДОСТАВКИ
   ════════════════════════════════════════ */
let currentTrackingOrderId = null;

async function openTrackingModal(orderId) {
  currentTrackingOrderId = orderId;
  document.getElementById('tm-order-id').textContent = orderId;
  
  // Очистити форму
  document.getElementById('tm-location').value = '';
  document.getElementById('tm-desc').value = '';
  document.getElementById('tm-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tm-eta').value = '';
  
  await loadTrackingSteps(orderId);
  openModal('tracking-modal');
}

async function loadTrackingSteps(orderId) {
  try {
    const res = await apiFetch(`${API}/tracking/admin/${orderId}`);
    const steps = await res.json();
    
    const listEl = document.getElementById('tm-list');
    
    if (!steps.length) {
      listEl.innerHTML = '<div class="text-muted text-sm" style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center;">Етапів ще немає</div>';
      return;
    }
    
    listEl.innerHTML = steps.map(s => {
      const date = new Date(s.status_date).toLocaleDateString('uk-UA');
      return `
        <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.9rem;">📍 ${s.current_location}</div>
            ${s.status_description ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">${s.status_description}</div>` : ''}
            <div style="font-size:0.75rem;color:var(--text-light);margin-top:4px;">📅 ${date}</div>
            ${s.estimated_arrival ? `<div style="font-size:0.75rem;color:var(--primary);margin-top:2px;font-weight:600;">🎯Орієнтовне прибуття: ${new Date(s.estimated_arrival).toLocaleDateString('uk-UA')}</div>` : ''}
          </div>
          <button class="icon-btn danger" onclick="deleteTrackingStep(${s.tracking_id})" title="Видалити">🗑️</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function addTrackingStep() {
  const location = document.getElementById('tm-location').value.trim();
  const desc     = document.getElementById('tm-desc').value.trim();
  const date     = document.getElementById('tm-date').value;
  const eta      = document.getElementById('tm-eta').value;
  const alertEl  = document.getElementById('tm-alert');

  alertEl.style.display = 'none';

  if (!location) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Введіть локацію!';
    alertEl.style.display = 'flex';
    return;
  }

  try {
    const res = await apiFetch(`${API}/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: currentTrackingOrderId,
        current_location: location,
        status_description: desc,
        status_date: date,
        estimated_arrival: eta || null
      })
    });

    if (!res.ok) {
      alertEl.className = 'alert alert-error mb-16';
      alertEl.innerHTML = '❌ Помилка додавання';
      alertEl.style.display = 'flex';
      return;
    }

    // Очистити форму
    document.getElementById('tm-location').value = '';
    document.getElementById('tm-desc').value = '';
    document.getElementById('tm-eta').value = '';

    alertEl.className = 'alert alert-success mb-16';
    alertEl.innerHTML = '✅ Етап додано!';
    alertEl.style.display = 'flex';

    await loadTrackingSteps(currentTrackingOrderId);

    setTimeout(() => { alertEl.style.display = 'none'; }, 2000);

  } catch (err) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Сервер недоступний';
    alertEl.style.display = 'flex';
  }
}

async function deleteTrackingStep(id) {
  if (!confirm('Видалити цей етап?')) return;
  
  try {
    await apiFetch(`${API}/tracking/${id}`, { method: 'DELETE' });
    await loadTrackingSteps(currentTrackingOrderId);
  } catch (err) {
    alert('Помилка');
  }
}
function getCarStatusBadge(status) {
  const map = {
    'заброньовано': '<span class="badge" style="background:#fef3c7;color:#92400e;">🔒 Заброньовано</span>',
    'в наявності': '<span class="badge badge-success">✅ В наявності</span>',
    'в дорозі':    '<span class="badge badge-info">🚢 В дорозі</span>',
    'на аукціоні': '<span class="badge badge-warning">🔨 Аукціон</span>',
    'продано':     '<span class="badge badge-gray">Продано</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status || '—'}</span>`;
}
/* ════════════════════════════════════════
   ➕ НОВА ЗАЯВКА (від менеджера)
   ════════════════════════════════════════ */
async function openNewRequestModal() {
  // Завантажуємо клієнтів
  const clRes = await apiFetch(`${API}/clients`);
  const clients = await clRes.json();
  const clSel = document.getElementById('nrm-client');
  clSel.innerHTML = '<option value="">— Оберіть клієнта —</option>' +
    clients.map(c => `<option value="${c.client_id}" data-phone="${c.phone}" data-name="${c.first_name} ${c.last_name}">#${c.client_id} — ${c.first_name} ${c.last_name} (${c.phone})</option>`).join('');

  // Завантажуємо авто
  const carsRes = await apiFetch(`${API}/cars/all`);
  const cars = await carsRes.json();
  const carSel = document.getElementById('nrm-car');
  carSel.innerHTML = '<option value="">— Не вказувати —</option>' +
    cars.map(c => `<option value="${c.car_id}">#${c.car_id} — ${c.make} ${c.model} ${c.manufacture_year || ''}</option>`).join('');

  // Очищуємо
  document.getElementById('nrm-comment').value = '';
  document.getElementById('nrm-type').value = 'авто в наявності';

  openModal('new-request-modal');
}

async function saveNewRequest() {
  const clientSel = document.getElementById('nrm-client');
  const clientId  = clientSel.value;
  const type      = document.getElementById('nrm-type').value;
  const carId     = document.getElementById('nrm-car').value;
  const comment   = document.getElementById('nrm-comment').value.trim();
  const alertEl   = document.getElementById('nrm-alert');

  alertEl.style.display = 'none';

  if (!clientId) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Оберіть клієнта!';
    alertEl.style.display = 'flex';
    return;
  }

  // Беремо дані клієнта з вибраного option
  const opt = clientSel.options[clientSel.selectedIndex];
  const clientName  = opt.dataset.name;
  const clientPhone = opt.dataset.phone;

  try {
    const res = await apiFetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:    clientName,
        client_phone:   clientPhone,
        request_type:   type,
        car_id:         carId || null,
        search_context: comment ? { comment, source: 'Створено менеджером' } : { source: 'Створено менеджером' }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      alertEl.className = 'alert alert-error mb-16';
      alertEl.innerHTML = `❌ ${err.error || 'Помилка'}`;
      alertEl.style.display = 'flex';
      return;
    }

    closeModal('new-request-modal');
    loadRequests();

  } catch (err) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Сервер недоступний';
    alertEl.style.display = 'flex';
  }
}
