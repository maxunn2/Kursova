/* ================================================
   js/car.js — Сторінка окремого авто
   Заявка → request_type: "авто в наявності"
   → призначається Менеджер авто в наявності
   ================================================ */

let currentCar = null;

/* ── ІНІЦІАЛІЗАЦІЯ ── */
document.addEventListener('DOMContentLoaded', () => {
  renderNavUser();

  const params = new URLSearchParams(window.location.search);
  const carId  = params.get('id');

  if (!carId) { showError(); return; }

  loadCar(carId);
});

/* ── ЗАВАНТАЖЕННЯ АВТО ── */
async function loadCar(id) {
  try {
    const res = await fetch(`${API}/cars/${id}`);
    if (!res.ok) { showError(); return; }
    currentCar = await res.json();
    renderCar(currentCar);
  } catch (err) {
    showError();
  }
}

/* ── РЕНДЕР АВТО ── */
function renderCar(car) {
  document.title = `${car.make} ${car.model} — GlobalDrive Auto`;
  document.getElementById('bc-title').textContent = `${car.make} ${car.model}`;
  document.getElementById('car-title').textContent = `${car.make} ${car.model} ${car.manufacture_year || ''}`;
  // Показуємо фото
  if (car.image) {
    const galleryEl = document.querySelector('.car-gallery');
    galleryEl.style.backgroundImage = `url('${car.image}')`;
    galleryEl.style.backgroundSize = 'cover';
    galleryEl.style.backgroundPosition = 'center';
    galleryEl.innerHTML = '';
  }
  document.getElementById('car-status-badge').innerHTML = getStatusBadge(car.car_status);
  document.getElementById('car-vin').textContent = car.vin_code || 'Не вказано';

  // Ціна
  const priceEl = document.getElementById('car-price');
  priceEl.textContent = car.selling_price
    ? `$${Number(car.selling_price).toLocaleString()}`
    : 'Ціна за запитом';

// Підпис під ціною (динамічний текст залежно від статусу)
  const priceSubEl = document.querySelector('.price-box__sub');

  if (car.car_status === 'в дорозі') {
    priceSubEl.textContent = 'Вартість включає доставку та розмитнення';
    priceSubEl.style.display = 'block';
  } else if (car.car_status === 'на аукціоні') {
      priceSubEl.textContent = 'Вартість автомобіля на аукціоні';
      priceSubEl.style.display = 'block';
  } else {
      // Для авто "в наявності" або інших приховуємо підпис
      priceSubEl.style.display = 'none';
   }

  // Характеристики
  const specs = [
    { label: 'Марка',         value: car.make,             icon: '🚗' },
    { label: 'Модель',        value: car.model,            icon: '📋' },
    { label: 'Рік випуску',   value: car.manufacture_year, icon: '📅' },
    { label: 'Пробіг',        value: car.odometer ? `${Number(car.odometer).toLocaleString()} км` : null, icon: '🛣️' },
    { label: 'Тип пального',  value: car.fuel_type,        icon: '⛽' },
    { label: 'Коробка передач',       value: car.transmission,     icon: '⚙️' },
    { label: 'Колір',         value: car.color,            icon: '🎨' },
    { label: "Об'єм двигуна", value: car.engine_volume ? `${car.engine_volume} л` : null, icon: '🔧' },
    { label: 'Привід',        value: car.drivetrain,       icon: '🔄' },
  ];

  const specsEl = document.getElementById('car-specs');
  specsEl.innerHTML = '';
  specs.forEach(s => {
    if (!s.value) return;
    specsEl.innerHTML += `
      <div class="spec-item">
        <div class="spec-item__label">${s.icon} ${s.label}</div>
        <div class="spec-item__value">${s.value}</div>
      </div>
    `;
  });

  document.getElementById('page-loading').style.display = 'none';
  document.getElementById('page-content').style.display = 'block';
}

/* ── СТАТУС БЕЙДЖ ── */
function getStatusBadge(status) {
  const map = {
    'в наявності': '<span class="badge badge-success">✅ В наявності</span>',
    'в дорозі':    '<span class="badge badge-info">🚢 В дорозі</span>',
    'на аукціоні': '<span class="badge badge-warning">🔨 На аукціоні</span>',
    'продано':     '<span class="badge badge-gray">Продано</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status || '—'}</span>`;
}

/* ── МОДАЛКА ── */
function openInterestModal() {
  const client = getClient();
  if (client) {
    document.getElementById('req-name').value =
      `${client.first_name || ''} ${client.last_name || ''}`.trim();
    document.getElementById('req-phone').value = client.phone || '';
  }
  document.getElementById('interest-modal').classList.add('open');
}

function closeInterestModal() {
  document.getElementById('interest-modal').classList.remove('open');
  document.getElementById('modal-alert').style.display = 'none';
}

document.getElementById('interest-modal').addEventListener('click', function(e) {
  if (e.target === this) closeInterestModal();
});

/* ── ВІДПРАВИТИ ЗАЯВКУ ── */
async function submitInterest() {
  const name    = document.getElementById('req-name').value.trim();
  let   phone   = document.getElementById('req-phone').value.trim();
  const comment = document.getElementById('req-comment')?.value.trim() || '';
  const alertEl = document.getElementById('modal-alert');
  const btn     = document.querySelector('#interest-modal .btn-primary');

  alertEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Надсилаємо...';

  if (!name || !phone) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = "❌ Введіть ім'я та телефон!";
    alertEl.style.display = 'flex';
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.disabled = false;
    btn.textContent = 'Надіслати заявку';
    return;
  }

  phone = phone.replace(/\s/g, '').replace(/-/g, '');
  if (phone.startsWith('0')) phone = '+38' + phone;

  // ⚡ ДОДАЄМО ДИНАМІЧНУ ЛОГІКУ ТИПУ ЗАЯВКИ
  // Якщо авто реально стоїть на майданчику:
  let dynamicRequestType = 'пригін під замовлення'; 
  
  if (currentCar && currentCar.car_status === 'в наявності') {
      dynamicRequestType = 'авто в наявності';
  }
  // Тепер, якщо статус 'в дорозі' або 'на аукціоні', змінна залишиться 'пригін під замовлення'

  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:    name,
        client_phone:   phone,
        request_type:   dynamicRequestType, // ← Відправляємо розумну змінну
        car_id:         currentCar.car_id,
        search_context: comment ? { comment } : null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alertEl.className = 'alert alert-error mb-16';
      alertEl.innerHTML = `❌ ${data.error || 'Помилка'}`;
      alertEl.style.display = 'flex';
      btn.disabled = false;
      btn.textContent = 'Надіслати заявку';
      return;
    }

    alertEl.className = 'alert alert-success mb-16';
    alertEl.innerHTML = "✅ Заявку надіслано! Менеджер зв'яжеться з вами найближчим часом.";
    alertEl.style.display = 'flex';

    setTimeout(() => {
      closeInterestModal();
      document.getElementById('req-name').value  = '';
      document.getElementById('req-phone').value = '';
      if (document.getElementById('req-comment'))
        document.getElementById('req-comment').value = '';
      btn.disabled = false;
      btn.textContent = 'Надіслати заявку';
    }, 2500);

  } catch (err) {
    alertEl.className = 'alert alert-error mb-16';
    alertEl.innerHTML = '❌ Сервер недоступний!';
    alertEl.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Надіслати заявку';
  }
}

/* ── ПОМИЛКА ── */
function showError() {
  document.getElementById('page-loading').style.display = 'none';
  document.getElementById('page-error').style.display   = 'flex';
}