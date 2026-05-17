/* ================================================
   js/auth.js — Авторизація (логін / реєстрація)
   Використовується: login.html, register.html
   + допоміжні функції для всіх сторінок
   ================================================ */

const API = 'http://192.168.64.133:3000/api';

/* ── ДОПОМІЖНІ ФУНКЦІЇ (використовуються на ВСІХ сторінках) ── */

// Отримати токен
function getToken() {
  return localStorage.getItem('token');
}

// Отримати дані клієнта
function getClient() {
  const raw = localStorage.getItem('client');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// Чи залогінений?
function isLoggedIn() {
  return !!getToken();
}

// Вийти з акаунту
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('client');
  window.location.href = 'login.html';
}

// Захищена сторінка — якщо не залогінений, кидає на логін
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Показати аватар у navbar (ініціали)
function renderNavUser() {
  const client = getClient();
  const actionsEl = document.querySelector('.navbar__actions');
  if (!actionsEl) return;

  if (client) {
    const initials = (client.first_name?.[0] || '') + (client.last_name?.[0] || '');
    actionsEl.innerHTML = `
      <a href="cabinet.html" class="navbar__user" style="text-decoration:none;">
        <div class="navbar__avatar">${initials.toUpperCase()}</div>
        <span>${client.first_name}</span>
      </a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Вийти</button>
    `;
  } else {
    actionsEl.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Вхід</a>
      <a href="register.html" class="btn btn-primary btn-sm">Реєстрація</a>
    `;
  }
}

// Показати/приховати алерт
function showAlert(id, message, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
  el.className = `alert alert-${type} mb-16`;
  el.innerHTML = `${icons[type] || ''} ${message}`;
   el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Стан кнопки (loading)
function setLoading(btnId, loading, text = 'Завантаження...') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._origText = btn.textContent;
    btn.textContent = text;
  } else {
    btn.textContent = btn._origText || text;
  }
}

/* ── РЕЄСТРАЦІЯ ── */
async function handleRegister() {
  hideAlert('alert-box');

  const first_name = document.getElementById('first_name')?.value.trim();
  const last_name  = document.getElementById('last_name')?.value.trim();
  let phone = document.getElementById('phone')?.value.trim();
phone = phone.replace(/\s/g, '').replace(/-/g, '');
if (phone.startsWith('0')) phone = '+38' + phone;
if (!phone.startsWith('+') && phone.startsWith('380')) phone = '+' + phone;
  const email      = document.getElementById('email')?.value.trim();
  const password   = document.getElementById('password')?.value;
  const password2  = document.getElementById('password2')?.value;

  // Валідація на фронті
  if (!first_name || !last_name) {
    return showAlert('alert-box', "Введіть ім'я та прізвище!");
  }
  if (!phone) {
    return showAlert('alert-box', 'Введіть номер телефону!');
  }
  if (!password || password.length < 6) {
    return showAlert('alert-box', 'Пароль має бути мінімум 6 символів!');
  }
  if (password !== password2) {
    return showAlert('alert-box', 'Паролі не співпадають!');
  }

  setLoading('reg-btn', true, 'Реєстрація...');

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, phone, email: email || undefined, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert('alert-box', data.error || 'Помилка реєстрації');
      return;
    }

    // Зберігаємо токен і дані
    localStorage.setItem('token', data.token);
    localStorage.setItem('client', JSON.stringify(data.client));

    showAlert('alert-box', 'Реєстрація успішна! Переходимо...', 'success');

    setTimeout(() => {
      window.location.href = 'cabinet.html';
    }, 1000);

  } catch (err) {
    showAlert('alert-box', 'Сервер недоступний. Перевірте підключення.');
  } finally {
    setLoading('reg-btn', false, 'Зареєструватись');
  }
}

/* ── ВХІД ── */
async function handleLogin() {
  hideAlert('alert-box');

  let phone = document.getElementById('phone')?.value.trim();
phone = phone.replace(/\s/g, '').replace(/-/g, '');
if (phone.startsWith('0')) phone = '+38' + phone;
if (!phone.startsWith('+') && phone.startsWith('380')) phone = '+' + phone;
  const password = document.getElementById('password')?.value;

  if (!phone || !password) {
    return showAlert('alert-box', 'Введіть телефон і пароль!');
  }

  setLoading('login-btn', true, 'Вхід...');

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert('alert-box', data.error || 'Помилка входу');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('client', JSON.stringify(data.client));

    showAlert('alert-box', 'Вхід успішний! Переходимо...', 'success');

    // Редірект — якщо є збережена сторінка, повертаємось туди
    const redirect = sessionStorage.getItem('redirect_after_login') || 'cabinet.html';
    sessionStorage.removeItem('redirect_after_login');

    setTimeout(() => {
      window.location.href = redirect;
    }, 800);

  } catch (err) {
    showAlert('alert-box', 'Сервер недоступний. Перевірте підключення.');
  } finally {
    setLoading('login-btn', false, 'Увійти');
  }
}