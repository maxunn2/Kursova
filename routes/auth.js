const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Нормалізація телефону — щоб був завжди у форматі +380XXXXXXXXX
function normalizePhone(phone) {
    if (!phone) return phone;
    phone = String(phone).replace(/\s/g, '').replace(/-/g, '');
    if (phone.startsWith('0')) phone = '+38' + phone;
    if (!phone.startsWith('+') && phone.startsWith('380')) phone = '+' + phone;
    return phone;
}
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

// Реєстрація клієнта (з підтримкою існуючих фізичних клієнтів)
router.post('/register', async (req, res) => {
    let { first_name, last_name, phone, email, password } = req.body;

    if (!first_name || !last_name || !phone || !password) {
        return res.status(400).json({ error: 'Заповніть всі обов\'язкові поля!' });
    }

    // Нормалізуємо телефон одразу
    phone = normalizePhone(phone);

    try {
        // Перевіряємо чи існує клієнт з таким телефоном
        db.query('SELECT * FROM Clients WHERE phone = ?', [phone], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const hashedPassword = await bcrypt.hash(password, 10);

            // СЦЕНАРІЙ 1: Клієнт вже є в БД (фізично прийшов раніше)
            if (results.length > 0) {
                const existingClient = results[0];

                // Якщо вже зареєстрований (має пароль) — помилка
                if (existingClient.password) {
                    return res.status(400).json({ error: 'Клієнт з таким номером вже зареєстрований!' });
                }

                // Якщо немає паролю — оновлюємо існуючий запис (додаємо пароль і email)
                db.query(
                    `UPDATE Clients 
                     SET first_name = ?, last_name = ?, email = ?, password = ?
                     WHERE client_id = ?`,
                    [first_name, last_name, email || existingClient.email, hashedPassword, existingClient.client_id],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        const token = jwt.sign(
                            { client_id: existingClient.client_id, phone },
                            JWT_SECRET,
                            { expiresIn: '7d' }
                        );

                        res.json({
                            message: 'Реєстрація успішна! Ваші попередні замовлення зв\'язані з акаунтом.',
                            token,
                            client: {
                                client_id: existingClient.client_id,
                                first_name,
                                last_name,
                                phone
                            }
                        });
                    }
                );
                return;
            }

            // СЦЕНАРІЙ 2: Новий клієнт — створюємо з нуля
            db.query(
                `INSERT INTO Clients (first_name, last_name, phone, email, password) 
                 VALUES (?, ?, ?, ?, ?)`,
                [first_name, last_name, phone, email || null, hashedPassword],
                (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const token = jwt.sign(
                        { client_id: result.insertId, phone },
                        JWT_SECRET,
                        { expiresIn: '7d' }
                    );

                    res.json({
                        message: 'Реєстрація успішна!',
                        token,
                        client: {
                            client_id: result.insertId,
                            first_name,
                            last_name,
                            phone
                        }
                    });
                }
            );
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Вхід клієнта
router.post('/login', (req, res) => {
    let { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Введіть телефон і пароль!' });
    }

    // Нормалізуємо телефон
    phone = normalizePhone(phone);

    db.query('SELECT * FROM Clients WHERE phone = ?', [phone], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ error: 'Клієнта не знайдено!' });

        const client = results[0];

        // Перевіряємо пароль
        const isMatch = await bcrypt.compare(password, client.password);
        if (!isMatch) return res.status(400).json({ error: 'Невірний пароль!' });

        // Генеруємо токен
        const token = jwt.sign(
            { client_id: client.client_id, phone: client.phone },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Вхід успішний!',
            token,
            client: {
                client_id: client.client_id,
                first_name: client.first_name,
                last_name: client.last_name,
                phone: client.phone
            }
        });
    });
});

// Отримати дані поточного клієнта (захищений маршрут)
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Токен відсутній!' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.query(
            'SELECT client_id, first_name, last_name, phone, email, client_type, created_at FROM Clients WHERE client_id = ?',
            [decoded.client_id],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                if (results.length === 0) return res.status(404).json({ error: 'Клієнта не знайдено!' });
                res.json(results[0]);
            }
        );
    } catch (err) {
        res.status(401).json({ error: 'Невірний токен!' });
    }
});

module.exports = router;
