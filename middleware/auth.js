const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ КРИТИЧНО: JWT_SECRET не задано в .env!');
    process.exit(1);
}

// Дістати і перевірити JWT-токен з заголовка Authorization
function verifyToken(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Будь-який залогінений працівник (адмін АБО менеджер)
function requireEmployee(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.employee_id) {
        return res.status(401).json({ error: 'Потрібна авторизація' });
    }
    req.employee = decoded;
    next();
}

// Тільки адміністратор
function requireAdmin(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.employee_id) {
        return res.status(401).json({ error: 'Потрібна авторизація' });
    }
    if (decoded.position !== 'Адміністратор') {
        return res.status(403).json({ error: 'Доступ заборонено: тільки для адміністратора' });
    }
    req.employee = decoded;
    next();
}

// Залогінений клієнт
function requireClient(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.client_id) {
        return res.status(401).json({ error: 'Потрібна авторизація клієнта' });
    }
    req.client = decoded;
    next();
}
// Будь-який залогінений (клієнт АБО працівник)
function requireAnyAuth(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded) {
        return res.status(401).json({ error: 'Потрібна авторизація' });
    }
    if (decoded.employee_id) {
        req.employee = decoded;
    } else if (decoded.client_id) {
        req.client = decoded;
    } else {
        return res.status(401).json({ error: 'Невірний токен' });
    }
    next();
}

module.exports = { requireEmployee, requireAdmin, requireClient, requireAnyAuth };
