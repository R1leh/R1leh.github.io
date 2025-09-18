const Database = require('better-sqlite3');
const db = new Database('server/attendance.db');

// Инициализация таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT,
    status TEXT,
    details TEXT
  );
  CREATE TABLE IF NOT EXISTS schedule (
    date TEXT,
    pair_number INTEGER,
    pair_type TEXT
  );
  CREATE TABLE IF NOT EXISTS attendance (
    date TEXT,
    pair_number INTEGER,
    student_id INTEGER,
    status TEXT,
    reason TEXT,
    respectful INTEGER,
    hours INTEGER,
    comment TEXT
  );
  CREATE TABLE IF NOT EXISTS holidays (
    date TEXT PRIMARY KEY
  );
`);

// Инициализация списка студентов
const initStudents = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO students (id, name, status, details) VALUES (?, ?, ?, ?)');
    const students = [
      [1, "Акулов Геннадий Анатольевич", "academic_leave", "В а/о с 25.10.2024, пр №261-у/ч"],
      [2, "Аллахяров Сакрат Сакитович", null, null],
      [3, "Выгузова Влада Михайловна", null, null],
      [4, "Ермакова Анастасия Евгеньевна", null, null],
      [5, "Зибров Юрий Владимирович", null, null],
      [6, "Ильин Иван Петрович", null, null],
      [7, "Квасов Сергей Евгеньевич", null, null],
      [8, "Киреев Егор Сергеевич", null, null],
      [9, "Кунаева Ирина Руслановна", null, null],
      [10, "Мухаметова Ариана Руслановна", null, null],
      [11, "Попов Андрей Александрович", null, null],
      [12, "Радушин Алексей Александрович", null, null],
      [13, "Ротару Иван Георгиевич", null, null],
      [14, "Рудченко Никита Сергеевич", null, null],
      [15, "Саваль Дмитрий Иванович", null, null],
      [16, "Саяпин Илья Юрьевич", null, null],
      [17, "Склярова Ангелина Александровна", null, null],
      [18, "Сологуб Данил Сергеевич", null, null],
      [19, "Тарикулиев Сабир Агарзаевич", null, null],
      [20, "Чумакова Кристина Андреевна", null, null],
      [21, "Шашков Кирилл Дмитриевич", null, null]
    ];
    students.forEach(student => insert.run(student));
  }
};
initStudents();

module.exports = {
  getStudents: () => {
    return db.prepare('SELECT * FROM students').all();
  },
  isHoliday: (date) => {
    const row = db.prepare('SELECT date FROM holidays WHERE date = ?').get(date);
    return !!row;
  },
  setHoliday: (date, isHoliday) => {
    if (isHoliday) {
      db.prepare('INSERT OR IGNORE INTO holidays (date) VALUES (?)').run(date);
    } else {
      db.prepare('DELETE FROM holidays WHERE date = ?').run(date);
    }
  },
  getSchedule: (date) => {
    const pairs = db.prepare('SELECT pair_number, pair_type FROM schedule WHERE date = ?').all(date);
    if (pairs.length) {
      return { date, pairs: pairs.map(p => ({ number: p.pair_number, type: p.pair_type })) };
    }
    return null;
  },
  saveSchedule: (date, pairs) => {
    db.prepare('DELETE FROM schedule WHERE date = ?').run(date);
    const insert = db.prepare('INSERT INTO schedule (date, pair_number, pair_type) VALUES (?, ?, ?)');
    pairs.forEach(pair => insert.run(date, pair.number, pair.type));
  },
  getAttendance: (date) => {
    return db.prepare('SELECT * FROM attendance WHERE date = ?').all(date);
  },
  saveAttendance: (date, pair, student_id, status, reason, respectful, hours, comment) => {
    db.prepare('DELETE FROM attendance WHERE date = ? AND pair_number = ? AND student_id = ?').run(date, pair, student_id);
    if (status === 'absent') {
      const finalReason = reason || 'Неизвестно'; // Устанавливаем 'Неизвестно', если причина пустая
      db.prepare('INSERT INTO attendance (date, pair_number, student_id, status, reason, respectful, hours, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(date, pair, student_id, status, finalReason, respectful ? 1 : 0, hours, comment || '');
    }
  },
  getReport: (month) => {
    return db.prepare(`
      SELECT s.id, s.name, s.status, s.details,
        SUM(CASE WHEN a.respectful = 1 THEN a.hours ELSE 0 END) as respectful_hours,
        SUM(CASE WHEN a.respectful = 0 THEN a.hours ELSE 0 END) as non_respectful_hours,
        SUM(a.hours) as total_hours,
        GROUP_CONCAT(
          CASE WHEN a.status = 'absent' THEN 
            COALESCE(a.reason, 'Неизвестно') || ' (' || a.date || ' Пара ' || a.pair_number || 
            COALESCE((CASE WHEN a.comment != '' THEN ': ' || a.comment ELSE '' END), '') || ')'
          END, ', '
        ) as reasons
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date LIKE ?
      GROUP BY s.id, s.name, s.status, s.details
    `).all(`${month}%`);
  }
};
