const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Налаштування multer — куди зберігати і як називати
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'public', 'uploads', 'cars');
        // Створюємо папку якщо немає
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // car_{id}_{timestamp}.jpg
        const ext = path.extname(file.originalname);
        const carId = req.params.car_id || 'new';
        const filename = `car_${carId}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

// Фільтр — тільки картинки
const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Дозволені тільки зображення (jpg, png, webp)'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

// Завантажити фото для авто
router.post('/cars/:car_id', requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не вибрано' });

    // Шлях який буде зберігатись в БД
    const imagePath = `uploads/cars/${req.file.filename}`;

    res.json({
        message: 'Фото завантажено!',
        imagePath
    });
});

module.exports = router;
