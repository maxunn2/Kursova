const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ КРИТИЧНО: JWT_SECRET не задано в .env!');
    process.exit(1);
}

// Вхід для адміністратора / менеджера (по email)
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Введіть email і пароль!' });
    }

    db.query('SELECT * FROM Employees WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ error: 'Користувача не знайдено!' });

        const employee = results[0];

        // Якщо в БД немає пароля
        if (!employee.password) {
            return res.status(400).json({ error: 'Обліковий запис не має паролю. Зверніться до адміністратора.' });
        }

        // Перевіряємо пароль
        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) return res.status(400).json({ error: 'Невірний пароль!' });

        // Генеруємо токен
        const token = jwt.sign(
            { 
                employee_id: employee.employee_id, 
                position: employee.position,
                email: employee.email 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Вхід успішний!',
            token,
            employee: {
                employee_id: employee.employee_id,
                first_name: employee.first_name,
                last_name: employee.last_name,
                email: employee.email,
                position: employee.position,
                phone: employee.phone
            }
        });
    });
});

// Отримати дані поточного співробітника по токену
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Токен відсутній!' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.query(
            'SELECT employee_id, first_name, last_name, email, phone, position, hire_date FROM Employees WHERE employee_id = ?',
            [decoded.employee_id],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                if (results.length === 0) return res.status(404).json({ error: 'Не знайдено!' });
                res.json(results[0]);
            }
        );
    } catch (err) {
        res.status(401).json({ error: 'Невірний токен!' });
    }
});

module.exports = router;
