const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Всі менеджери (GET) — без поля password
router.get('/', requireAdmin,  (req, res) => {
    db.query('SELECT employee_id, first_name, last_name, phone, email, position, hire_date FROM Employees', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Додати співробітника (POST)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        // Хешуємо пароль якщо є
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }
        db.query('INSERT INTO Employees SET ?', data, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Співробітника додано!', employee_id: result.insertId });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Редагувати співробітника (PUT)
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        // Якщо передали новий пароль — хешуємо
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        } else {
            delete data.password; // не оновлювати поле
        }
        db.query('UPDATE Employees SET ? WHERE employee_id = ?', [data, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Дані співробітника оновлено!' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Видалити співробітника (DELETE)
router.delete('/:id', requireAdmin, (req, res) => {
    db.query('DELETE FROM Employees WHERE employee_id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Співробітника видалено!' });
    });
});

module.exports = router;
