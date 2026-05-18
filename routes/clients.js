const express = require('express');
const router = express.Router();
const { requireEmployee, requireAdmin, requireAnyAuth } = require('../middleware/auth');
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Отримати всіх клієнтів (GET)
// Паролі тут ми не витягуємо заради безпеки
router.get('/', requireEmployee, (req, res) => {
    db.query('SELECT client_id, first_name, last_name, phone, email, client_type, created_at FROM Clients', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Отримати одного клієнта за ID (GET
router.get('/:id', requireEmployee, (req, res) => {
    db.query('SELECT client_id, first_name, last_name, phone, email, client_type, created_at FROM Clients WHERE client_id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Клієнта не знайдено' });
        res.json(results[0]);
    });
});
// Додати клієнта вручну (POST) — для фізичних клієнтів без паролю
router.post('/', requireEmployee, (req, res) => {
    let { first_name, last_name, phone, email, client_type } = req.body;

    if (!first_name || !last_name || !phone) {
        return res.status(400).json({ error: 'Заповніть обов\'язкові поля!' });
    }

    // Нормалізація телефону — щоб співпадав з форматом з форм клієнта
    phone = String(phone).replace(/\s/g, '').replace(/-/g, '');
    if (phone.startsWith('0')) phone = '+38' + phone;
    if (!phone.startsWith('+') && phone.startsWith('380')) phone = '+' + phone;

    // Перевірка дублікату по телефону
    db.query('SELECT client_id FROM Clients WHERE phone = ?', [phone], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) {
            return res.status(400).json({ 
                error: 'Клієнт з таким номером вже існує в базі!',
                existing_client_id: results[0].client_id
            });
        }

        // Створюємо клієнта без паролю
        db.query(
            `INSERT INTO Clients (first_name, last_name, phone, email, client_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [first_name, last_name, phone, email || null, client_type || 'фізична особа'],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ 
                    message: 'Клієнта додано!', 
                    client_id: result.insertId 
                });
            }
        );
    });
});
// Редагувати клієнта (PUT)
router.put('/:id', requireAnyAuth, (req, res) => {
    db.query('UPDATE Clients SET ? WHERE client_id = ?', [req.body, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Дані клієнта оновлено!' });
    });
});

module.exports = router;
