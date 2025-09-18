const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Статические файлы из корневой папки
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Статические файлы из node_modules
app.use('/node_modules', express.static(path.join(__dirname, '..', 'node_modules')));

// Обработка favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Явный маршрут для index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/students', (req, res) => {
    try {
        const students = db.getStudents();
        res.json({ students });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/holidays/:date', (req, res) => {
    try {
        const isHoliday = db.isHoliday(req.params.date);
        res.json({ isHoliday });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/holidays', (req, res) => {
    try {
        const { date, isHoliday } = req.body;
        db.setHoliday(date, isHoliday);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/schedule/:date', (req, res) => {
    try {
        const schedule = db.getSchedule(req.params.date);
        res.json({ schedule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/schedule', (req, res) => {
    try {
        const { date, pairs } = req.body;
        db.saveSchedule(date, pairs);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/attendance/:date', (req, res) => {
    try {
        const attendance = db.getAttendance(req.params.date);
        res.json({ attendance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/attendance', (req, res) => {
    try {
        const { date, pair, student_id, status, reason, respectful, hours, comment } = req.body;
        db.saveAttendance(date, pair, student_id, status, reason, respectful, hours, comment);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/report/:month', (req, res) => {
    try {
        const report = db.getReport(req.params.month);
        res.json({ report });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 4000; // Порт 4000, чтобы соответствовать вашим ошибкам
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    console.error(`Failed to start server: ${err.message}`);
});