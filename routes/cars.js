const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const { requireEmployee, requireAdmin } = require('../middleware/auth');
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Доступні для вибору в заявках/ордерах — з фільтрацією за роллю
router.get('/available', requireEmployee, (req, res) => {
    const position = req.employee.position;
    const includeId = req.query.include ? parseInt(req.query.include) : null;

    // Визначаємо допустимі статуси за роллю
    let allowedStatuses;
    if (position === 'Адміністратор') {
        allowedStatuses = ['в наявності', 'в дорозі', 'на аукціоні'];
    } else if (position === 'Менеджер авто в наявності') {
        allowedStatuses = ['в наявності'];
    } else if (position === 'Менеджер з пригону') {
        allowedStatuses = ['в дорозі', 'на аукціоні'];
    } else {
        allowedStatuses = [];
    }

    // Якщо для ролі немає допустимих статусів — повертаємо тільки include-авто (для редагування)
    if (allowedStatuses.length === 0) {
        if (includeId) {
            return db.query('SELECT * FROM Cars WHERE car_id = ?', [includeId], (e, r) => {
                if (e) return res.status(500).json({ error: e.message });
                res.json(r);
            });
        }
        return res.json([]);
    }

    // Допустимі статуси АБО конкретне авто (для редагування ордера)
    let query = `SELECT * FROM Cars WHERE car_status IN (?)`;
    const params = [allowedStatuses];

    if (includeId) {
        query += ` OR car_id = ?`;
        params.push(includeId);
    }
    query += ` ORDER BY car_id DESC`;

    db.query(query, params, (err, cars) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cars);
    });
});

// Отримати всі авто в наявності
router.get('/', (req, res) => {
    const { make, model, year_from, year_to, fuel_type, transmission } = req.query;
    
    let query = `SELECT * FROM Cars WHERE car_status = 'в наявності'`;
    let params = [];

    if (make) { query += ` AND make = ?`; params.push(make); }
    if (model) { query += ` AND model = ?`; params.push(model); }
    if (year_from) { query += ` AND manufacture_year >= ?`; params.push(year_from); }
    if (year_to) { query += ` AND manufacture_year <= ?`; params.push(year_to); }
    if (fuel_type) { query += ` AND fuel_type = ?`; params.push(fuel_type); }
    if (transmission) { query += ` AND transmission = ?`; params.push(transmission); }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Авто в дорозі
router.get('/in-transit', (req, res) => {
    db.query(`SELECT * FROM Cars WHERE car_status = 'в дорозі'`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Авто на аукціоні
router.get('/auction', (req, res) => {
    db.query(`SELECT * FROM Cars WHERE car_status = 'на аукціоні'`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Заброньовані авто
router.get('/reserved', requireEmployee, (req, res) => {
    db.query(`SELECT * FROM Cars WHERE car_status = 'заброньовано'`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Всі авто всіх статусів (для адмінки)
router.get('/all', requireEmployee, (req, res) => {
   db.query(`SELECT * FROM Cars ORDER BY car_id DESC`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Отримати одне авто за ID (заброньовані не віддаємо публічно)
router.get('/:id', (req, res) => {
    db.query('SELECT * FROM Cars WHERE car_id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Авто не знайдено' });
        // Заброньоване авто публічно недоступне — тільки в кабінеті власника замовлення
        if (results[0].car_status === 'заброньовано') {
            return res.status(404).json({ error: 'Авто не знайдено' });
        }
        res.json(results[0]);
    });
});

// ── НОВІ МАРШРУТИ ДЛЯ АДМІНКИ ──

// Додати нове авто (POST)
router.post('/', requireAdmin, (req, res) => {
    db.query('INSERT INTO Cars SET ?', req.body, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Авто успішно додано!', car_id: result.insertId });
    });
});

// Редагувати авто (PUT)
router.put('/:id', requireAdmin, (req, res) => {
    db.query('UPDATE Cars SET ? WHERE car_id = ?', [req.body, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Дані авто оновлено!' });
    });
});

// Видалити авто (DELETE)
router.delete('/:id', requireAdmin, (req, res) => {
    db.query('DELETE FROM Cars WHERE car_id = ?', [req.params.id], (err, result) => {
        if (err) {
            // Перевіряємо чи це помилка зовнішнього ключа
            if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
                return res.status(409).json({
                    error: 'Неможливо видалити авто: на нього є активне замовлення. Спочатку видаліть або скасуйте відповідне замовлення.'
                });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Авто видалено!' });
    });
});



module.exports = router;
