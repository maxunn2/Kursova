/* ================================================
   js/catalog.js — Каталог авто
   Логіка заявок:
   - З каталогу → тип "пригін під замовлення" → Менеджер з пригону
   - З car.html → тип "авто в наявності" → Менеджер авто в наявності
   ================================================ */

let allCars = [];
let currentTab = 'available';

/* ── ІНІЦІАЛІЗАЦІЯ ── */
document.addEventListener('DOMContentLoaded', () => {
  renderNavUser();
  loadCars();
});

/* ── ЗАВАНТАЖЕННЯ АВТО ── */
async function loadCars() {
  showLoading();
  hideBanner();

  try {
    let url = '';
    if (currentTab === 'available') url = `${API}/cars`;
    if (currentTab === 'transit')   url = `${API}/cars/in-transit`;
    if (currentTab === 'auction')   url = `${API}/cars/auction`;

    const res = await fetch(url);
    allCars = await res.json();

    populateFilters();

    renderCars(allCars);

  } catch (err) {
    hideLoading();
    showEmpty();
  }
}

/* ── РЕНДЕР КАРТОК ── */
function renderCars(cars) {
  hideLoading();

  const grid  = document.getElementById('cars-grid');
  const empty = document.getElementById('cars-empty');
  grid.innerHTML = '';

  if (!cars.length) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    if (currentTab === 'available') showBanner();
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = 'grid';

  cars.forEach(car => {
    const price = car.selling_price
      ? `$${Number(car.selling_price).toLocaleString()}`
      : '<span style="color:var(--text-muted);font-size:1rem;">Ціна за запитом</span>';

    grid.innerHTML += `
      <div class="car-card" onclick="window.location='car.html?id=${car.car_id}'">
        <div class="car-card__img" ${car.image ? `style="background-image:url('${car.image}');background-size:cover;background-position:center;font-size:0;"` : ''}>${car.image ? '' : '🚗'}</div>
        <div class="car-card__body">
          <div class="car-card__title">${car.make} ${car.model}</div>
          <div class="car-card__meta">
            <span>📅 ${car.manufacture_year || '—'}</span>
            <span>⛽ ${car.fuel_type || '—'}</span>
            <span>⚙️ ${car.transmission || '—'}</span>
            <span>🎨 ${car.color || '—'}</span>
            
          </div>${car.odometer ? `<span>🛣️ ${Number(car.odometer).toLocaleString()} км</span>` : ''}
          <div class="car-card__price">${price}</div>
          ${getStatusBadge(car.car_status)}
        </div>
      </div>
    `;
  });

  // Банер завжди внизу для табу "в наявності"
  if (currentTab === 'available') showBanner();
}

/* ── СТАТУС БЕЙДЖ ── */
function getStatusBadge(status) {
  const map = {
    'в наявності': '<span class="badge badge-success mt-8">✅ В наявності</span>',
    'в дорозі':    '<span class="badge badge-info mt-8">🚢 В дорозі</span>',
    'на аукціоні': '<span class="badge badge-warning mt-8">🔨 На аукціоні</span>',
    'продано':     '<span class="badge badge-gray mt-8">Продано</span>',
  };
  return map[status] || `<span class="badge badge-gray mt-8">${status || '—'}</span>`;
}

/* ── перемикає між табами "В наявності / В дорозі / На аукціоні": ── */
function switchTab(tab, btnEl) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.getElementById('filters-block').style.display = 'block';
  loadCars();
}

/* ── ФІЛЬТРИ ── */
function populateFilters() {
  const makes = [...new Set(allCars.map(c => c.make).filter(Boolean))].sort();
  const makeEl = document.getElementById('f-make');
  makeEl.innerHTML = '<option value="">Всі марки</option>';
  makes.forEach(m => makeEl.innerHTML += `<option value="${m}">${m}</option>`);

  // Моделі — заповнюємо порожнім списком; підтягнуться при виборі марки
  populateModels();

  const years = [...new Set(allCars.map(c => c.manufacture_year).filter(Boolean))].sort();
  const fromEl = document.getElementById('f-year-from');
  const toEl   = document.getElementById('f-year-to');
  fromEl.innerHTML = '<option value="">Будь-який</option>';
  toEl.innerHTML   = '<option value="">Будь-який</option>';
  years.forEach(y => {
    fromEl.innerHTML += `<option value="${y}">${y}</option>`;
    toEl.innerHTML   += `<option value="${y}">${y}</option>`;
  });
}
// Заповнює список моделей залежно від вибраної марки
function populateModels() {
  const selectedMake = document.getElementById('f-make').value;
  const modelEl = document.getElementById('f-model');

  let models;
  if (selectedMake) {
    // Тільки моделі цієї марки
    models = [...new Set(allCars.filter(c => c.make === selectedMake).map(c => c.model).filter(Boolean))].sort();
  } else {
    // Всі моделі всіх марок
    models = [...new Set(allCars.map(c => c.model).filter(Boolean))].sort();
  }

  modelEl.innerHTML = '<option value="">Всі моделі</option>';
  models.forEach(m => modelEl.innerHTML += `<option value="${m}">${m}</option>`);
}

// При зміні марки — оновлюємо список моделей і фільтруємо
function onMakeChange() {
  populateModels();
  applyFilters();
}



function applyFilters() {
  const make      = document.getElementById('f-make').value;
  const fuel      = document.getElementById('f-fuel').value;
  const trans     = document.getElementById('f-trans').value;
  const yearFrom  = document.getElementById('f-year-from').value;
  const yearTo    = document.getElementById('f-year-to').value;
  const priceFrom = parseFloat(document.getElementById('f-price-from')?.value) || 0;
  const priceTo   = parseFloat(document.getElementById('f-price-to')?.value)   || Infinity;
  const odoFrom   = parseFloat(document.getElementById('f-odo-from')?.value)   || 0;
  const odoTo     = parseFloat(document.getElementById('f-odo-to')?.value)     || Infinity;
  const sort      = document.getElementById('f-sort')?.value || '';

  const model = document.getElementById('f-model')?.value || '';

  let filtered = allCars;
  if (make)     filtered = filtered.filter(c => c.make === make);
  if (model)    filtered = filtered.filter(c => c.model === model);
  if (fuel)     filtered = filtered.filter(c => c.fuel_type === fuel);
  if (trans)    filtered = filtered.filter(c => c.transmission === trans);
  if (yearFrom) filtered = filtered.filter(c => c.manufacture_year >= parseInt(yearFrom));
  if (yearTo)   filtered = filtered.filter(c => c.manufacture_year <= parseInt(yearTo));

  // Ціна
  filtered = filtered.filter(c => {
    const price = Number(c.selling_price) || 0;
    return price >= priceFrom && price <= priceTo;
  });

  // Пробіг
  filtered = filtered.filter(c => {
    const odo = Number(c.odometer) || 0;
    return odo >= odoFrom && odo <= odoTo;
  });

  // Сортування
  if (sort) {
    filtered = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'price-asc':  return (Number(a.selling_price)||0) - (Number(b.selling_price)||0);
        case 'price-desc': return (Number(b.selling_price)||0) - (Number(a.selling_price)||0);
        case 'year-desc':  return (Number(b.manufacture_year)||0) - (Number(a.manufacture_year)||0);
        case 'year-asc':   return (Number(a.manufacture_year)||0) - (Number(b.manufacture_year)||0);
        case 'odo-asc':    return (Number(a.odometer)||0) - (Number(b.odometer)||0);
        case 'odo-desc':   return (Number(b.odometer)||0) - (Number(a.odometer)||0);
        default: return 0;
      }
    });
  }

  renderCars(filtered);
}
function resetFilters() {
  ['f-make','f-model','f-fuel','f-trans','f-year-from','f-year-to',
   'f-price-from','f-price-to','f-odo-from','f-odo-to','f-sort']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  populateModels(); // відновити повний список моделей
  renderCars(allCars);
}

/* ── ОТРИМАТИ ПОТОЧНІ ФІЛЬТРИ ── */
function getCurrentFilters() {
  return {
    make:      document.getElementById('f-make')?.value || '',
    model:     document.getElementById('f-model')?.value || '',
    fuel:      document.getElementById('f-fuel')?.value || '',
    trans:     document.getElementById('f-trans')?.value || '',
    yearFrom:  document.getElementById('f-year-from')?.value || '',
    yearTo:    document.getElementById('f-year-to')?.value || '',
    priceFrom: document.getElementById('f-price-from')?.value || '',
    priceTo:   document.getElementById('f-price-to')?.value || '',
    odoFrom:   document.getElementById('f-odo-from')?.value || '',
    odoTo:     document.getElementById('f-odo-to')?.value || '',
  };
}

/* ── БАНЕР ── */
function showBanner() { document.getElementById('order-banner').style.display = 'block'; }
function hideBanner() { document.getElementById('order-banner').style.display = 'none'; }

/* ── відкриває модальне вікно заявки: ── */
function openRequestModal() {
  const client = getClient();
  if (client) {
    // якщо клієнт залогінений — автоматично підставляє його ім'я і телефон
    document.getElementById('req-name').value =
      `${client.first_name || ''} ${client.last_name || ''}`.trim();
    document.getElementById('req-phone').value = client.phone || '';
  }


  // фільтри передаються менеджеру через search_context


  document.getElementById('request-modal').classList.add('open');
}

function closeRequestModal() {
  document.getElementById('request-modal').classList.remove('open');
  document.getElementById('modal-alert').style.display = 'none';
}

document.getElementById('request-modal').addEventListener('click', function(e) {
  if (e.target === this) closeRequestModal();
});

/* ── ВІДПРАВИТИ ЗАЯВКУ ── */
async function submitRequest() {
  const name    = document.getElementById('req-name').value.trim();
  let   phone   = document.getElementById('req-phone').value.trim();
  const alertEl = document.getElementById('modal-alert');
  const btn     = document.querySelector('#request-modal .btn-primary');
  alertEl.style.display = 'none';

  // Блокуємо кнопку щоб не відправити двічі
  btn.disabled = true;
  btn.textContent = 'Надсилаємо...';

  if (!name || !phone) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = "❌ Введіть ім'я та телефон!";
    alertEl.style.display = 'flex';
    return;
  }

  phone = phone.replace(/\s/g, '').replace(/-/g, '');
  if (phone.startsWith('0')) phone = '+38' + phone;

  // Автоматично збираємо фільтри → search_context
  const filters    = getCurrentFilters();
  const hasFilters = Object.values(filters).some(v => v !== '');

  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:    name,
        client_phone:   phone,
        request_type:   'пригін під замовлення', // ← завжди автоматично
        search_context: hasFilters ? filters : null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alertEl.className = 'alert alert-error mb-16';
      alertEl.innerHTML = `❌ ${data.error || 'Помилка'}`;
      alertEl.style.display = 'flex';
      return;
    }

    alertEl.className = 'alert alert-success mb-16';
    alertEl.innerHTML = "✅ Заявку надіслано! Менеджер зв'яжеться з вами найближчим часом.";
    alertEl.style.display = 'flex';

      setTimeout(() => {
      closeRequestModal();
      document.getElementById('req-name').value  = '';
      document.getElementById('req-phone').value = '';
      btn.disabled = false;
      btn.textContent = 'Надіслати заявку';
    }, 2500);
    
  } catch (err) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Сервер недоступний!';
    alertEl.style.display = 'flex';
  }
}

/* ── ХЕЛПЕРИ ── */
function showLoading() {
  document.getElementById('cars-loading').style.display = 'flex';
  document.getElementById('cars-grid').style.display    = 'none';
  document.getElementById('cars-empty').style.display   = 'none';
}
function hideLoading() {
  document.getElementById('cars-loading').style.display = 'none';
}
function showEmpty() {
  document.getElementById('cars-empty').style.display = 'block';
}