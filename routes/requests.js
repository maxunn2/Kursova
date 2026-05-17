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

// Створити нову заявку
router.post('/', (req, res) => { 
     let { client_name, client_phone, request_type, car_id, search_context } = req.body;

     // Нормалізація телефону — щоб співпадав з форматом клієнтів
     if (client_phone) {
         client_phone = String(client_phone).replace(/\s/g, '').replace(/-/g, '');
         if (client_phone.startsWith('0')) client_phone = '+38' + client_phone;
         if (!client_phone.startsWith('+') && client_phone.startsWith('380')) client_phone = '+' + client_phone;
     }

   //  визначення менеджера за типом заявки
    let position = 'Менеджер з пригону'; 
    if (request_type && request_type.includes('наявн')) {
        position = 'Менеджер авто в наявності';
    }
    if (request_type === 'консультація') {
        position = 'Адміністратор';
    }

    db.query(
        'SELECT employee_id FROM Employees WHERE position = ? LIMIT 1',
        [position],
        (err, employees) => {
            if (err) return res.status(500).json({ error: err.message });

            const employee_id = employees.length > 0 
                ? employees[0].employee_id 
                : null;

            db.query(
                `INSERT INTO Requests 
                (client_name, client_phone, request_type, car_id, search_context, employee_id) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    client_name,
                    client_phone,
                    request_type,
                    car_id || null,
                    search_context ? JSON.stringify(search_context) : null,
                    employee_id
                ], 
                (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({
                        message: 'Заявку створено!',
                        request_id: result.insertId
                    });
                }
            );
        }
    );
});

// Отримати всі заявки (для адмінки)
router.get('/', requireEmployee, (req, res) => {
    const query = `
        SELECT 
            r.*,
            c.make, c.model, c.manufacture_year, 
            c.selling_price, c.car_status,
            CONCAT(e.first_name, ' ', e.last_name) AS manager_name,
            e.position AS manager_position,
            e.phone AS manager_phone
        FROM Requests r
        LEFT JOIN Cars c ON r.car_id = c.car_id
        LEFT JOIN Employees e ON r.employee_id = e.employee_id
        ORDER BY r.request_date DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Отримати заявки конкретного менеджера
router.get('/manager/:id', requireEmployee, (req, res) => {
    const query = `
        SELECT 
            r.*,
            c.make, c.model, c.manufacture_year,
            c.selling_price, c.car_status
        FROM Requests r
        LEFT JOIN Cars c ON r.car_id = c.car_id
        WHERE r.employee_id = ?
        ORDER BY r.request_date DESC
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Змінити статус заявки
router.patch('/:id/status',requireEmployee, (req, res) => {
    const { status } = req.body;
    db.query(
        'UPDATE Requests SET status = ? WHERE request_id = ?',
        [status, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Статус оновлено!' });
        }
    );
});
 
// Заявки конкретного клієнта (по телефону)
router.get('/client/:phone',requireAnyAuth, (req, res) => {
    const query = `
        SELECT 
            r.*,
            c.make, c.model, c.manufacture_year, c.car_status,
            CONCAT(e.first_name, ' ', e.last_name) AS manager_name,
            e.phone AS manager_phone,
            e.position AS manager_position
        FROM Requests r
        LEFT JOIN Cars c ON r.car_id = c.car_id
        LEFT JOIN Employees e ON r.employee_id = e.employee_id
        WHERE r.client_phone = ?
        ORDER BY r.request_date DESC
    `;
    db.query(query, [req.params.phone], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});
// Змінити менеджера заявки (для адміна)
router.patch('/:id/manager',requireAdmin, (req, res) => {
    const { employee_id } = req.body;
    db.query(
        'UPDATE Requests SET employee_id = ? WHERE request_id = ?',
        [employee_id, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Менеджера заявки оновлено!' });
        }
    );
});


module.exports = router;
