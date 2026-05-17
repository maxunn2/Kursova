require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors({
    origin: ['http://192.168.64.133:3000', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// --- ІСНУЮЧІ МАРШРУТИ ---
const carsRouter = require('./routes/cars');
app.use('/api/cars', carsRouter);

const requestsRouter = require('./routes/requests');
app.use('/api/requests', requestsRouter);

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const trackingRouter = require('./routes/tracking');
app.use('/api/tracking', trackingRouter);

// --- НОВІ МАРШРУТИ ДЛЯ АДМІНКИ ТА КАБІНЕТУ ---
const employeesRouter = require('./routes/employees');
app.use('/api/employees', employeesRouter);

const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);

const clientsRouter = require('./routes/clients');
app.use('/api/clients', clientsRouter);

const adminAuthRouter = require('./routes/admin-auth');
app.use('/api/admin-auth', adminAuthRouter);

// Завантаження фото
const uploadRouter = require('./routes/upload');
app.use('/api/upload', uploadRouter);

// Підключення до MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Перевірка підключення
db.getConnection((err, connection) => {
    if (err) {
        console.error('Помилка підключення до БД:', err);
        return;
    }
    console.log('✅ Підключено до MySQL!');
    connection.release();
});

// Тестовий маршрут
app.get('/api/test', (req, res) => {
    res.json({ message: 'Сервер працює!' });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено на порту ${PORT}`);
});