const express = require('express');
const router = express.Router();
const { requireEmployee } = require('../middleware/auth');
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Всі замовлення для адмінки (GET)
router.get('/', requireEmployee, (req, res) => {
    const query = `
        SELECT o.*, 
               c.first_name AS client_first, c.last_name AS client_last, c.phone AS client_phone,
               car.make, car.model, car.vin_code, car.car_status,
               emp.first_name AS manager_first, emp.last_name AS manager_last
        FROM Orders o
        LEFT JOIN Clients c ON o.client_id = c.client_id
        LEFT JOIN Cars car ON o.car_id = car.car_id
        LEFT JOIN Employees emp ON o.employee_id = emp.employee_id
        ORDER BY o.contract_date DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Створити нове замовлення (POST)
router.post('/', requireEmployee, (req, res) => {
    db.query('INSERT INTO Orders SET ?', req.body, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Замовлення успішно створено!', order_id: result.insertId });
    });
});

// Змінити статус замовлення (PATCH)
router.patch('/:id/status', requireEmployee, (req, res) => {
    const { order_status } = req.body;
    db.query('UPDATE Orders SET order_status = ? WHERE order_id = ?', [order_status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Статус замовлення оновлено!' });
    });
});
// Повне редагування замовлення (PUT)
router.put('/:id', requireEmployee, (req, res) => {
    db.query('UPDATE Orders SET ? WHERE order_id = ?', [req.body, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Замовлення оновлено!' });
    });
});
// Змінити менеджера замовлення (для адміна)
router.patch('/:id/manager', requireEmployee, (req, res) => {
    const { employee_id } = req.body;
    db.query(
        'UPDATE Orders SET employee_id = ? WHERE order_id = ?',
        [employee_id, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Менеджера замовлення оновлено!' });
        }
    );
});
module.exports = router;
