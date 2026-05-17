const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});
const { requireEmployee } = require('../middleware/auth');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ КРИТИЧНО: JWT_SECRET не задано в .env!');
    process.exit(1);
}

// Middleware для перевірки токену клієнта
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Токен відсутній!' });
    try {
        req.client = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Невірний токен!' });
    }
};

// ── ДЛЯ КЛІЄНТА ──

// Отримати всі замовлення клієнта з відстеженням
router.get('/my', authMiddleware, (req, res) => {
    const query = `
        SELECT 
            o.order_id,
            o.order_status,
            o.payment_status,
            o.total_amount,
            o.contract_date,
            c.make, c.model, c.manufacture_year,
            c.color, c.car_status, c.image, c.selling_price,
            CONCAT(e.first_name, ' ', e.last_name) AS manager_name,
            e.phone AS manager_phone
        FROM Orders o
        JOIN Cars c ON o.car_id = c.car_id
        JOIN Employees e ON o.employee_id = e.employee_id
        WHERE o.client_id = ?
        ORDER BY o.contract_date DESC
    `;
    db.query(query, [req.client.client_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Отримати деталі відстеження конкретного замовлення (для клієнта - перевірка прав)
router.get('/:order_id', authMiddleware, (req, res) => {
    db.query(
        'SELECT client_id FROM Orders WHERE order_id = ?',
        [req.params.order_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ error: 'Замовлення не знайдено!' });
            if (results[0].client_id !== req.client.client_id) {
                return res.status(403).json({ error: 'Доступ заборонено!' });
            }

            db.query(
                `SELECT * FROM Delivery_Tracking 
                 WHERE order_id = ? 
                 ORDER BY status_date ASC`,
                [req.params.order_id],
                (err, tracking) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(tracking);
                }
            );
        }
    );
});

// ── ДЛЯ АДМІНКИ (без перевірки клієнта) ──

// Отримати всі етапи замовлення (для адмінки)
router.get('/admin/:order_id',requireEmployee, (req, res) => {
    db.query(
        `SELECT * FROM Delivery_Tracking 
         WHERE order_id = ? 
         ORDER BY status_date ASC`,
        [req.params.order_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

// Додати етап доставки (POST)
router.post('/',requireEmployee, (req, res) => {
    const { order_id, current_location, status_description, status_date, estimated_arrival } = req.body;

    if (!order_id || !current_location) {
        return res.status(400).json({ error: 'Заповніть локацію!' });
    }

    db.query(
        `INSERT INTO Delivery_Tracking 
         (order_id, current_location, status_description, status_date, estimated_arrival) 
         VALUES (?, ?, ?, ?, ?)`,
        [order_id, current_location, status_description || null, status_date || new Date(), estimated_arrival || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Етап додано!', tracking_id: result.insertId });
        }
    );
});

// Видалити етап доставки (DELETE)
router.delete('/:tracking_id',requireEmployee, (req, res) => {
    db.query(
        'DELETE FROM Delivery_Tracking WHERE tracking_id = ?',
        [req.params.tracking_id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Етап видалено!' });
        }
    );
});

module.exports = router;
