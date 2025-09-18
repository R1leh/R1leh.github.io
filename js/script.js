const reasons = [
    { name: "Справка", respectful: true },
    { name: "Приказ", respectful: true },
    { name: "Военкомат", respectful: true },
    { name: "Заявление", respectful: true },
    { name: "Индивидуальное обучение", respectful: true },
    { name: "Объяснительная", respectful: true },
    { name: "Семейные", respectful: false },
    { name: "Просто пропуск", respectful: false },
    { name: "Неизвестно", respectful: false }
];

let students = [];

// Инициализация календаря для дней (с русской локализацией)
flatpickr("#datePicker", {
    dateFormat: "Y-m-d",
    defaultDate: new Date().toISOString().split('T')[0],
    locale: "ru",
    onDayCreate: async function(dObj, dStr, fp, dayElem) {
        const date = dayElem.dateObj.toISOString().split('T')[0];
        const isWeekend = dayElem.dateObj.getDay() === 0 || dayElem.dateObj.getDay() === 6;
        try {
            const response = await fetch(`/holidays/${date}`);
            const data = await response.json();
            if (isWeekend) dayElem.classList.add('weekend');
            if (data.isHoliday) dayElem.classList.add('holiday');
        } catch (err) {
            console.error(`Ошибка проверки праздника для ${date}:`, err);
        }
    },
    onChange: function() {
        loadDay();
    }
});

async function loadStudents() {
    try {
        const response = await fetch('/students');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        students = data.students || [];
        console.log('Студенты загружены:', students);
    } catch (err) {
        console.error('Ошибка загрузки студентов:', err);
        alert('Не удалось загрузить список студентов. Проверьте сервер.');
    }
}

async function toggleHoliday() {
    const date = document.getElementById('datePicker').value;
    const isHoliday = document.getElementById('holidayCheck').checked;
    try {
        const response = await fetch('/holidays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, isHoliday })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(`Праздник для ${date} установлен: ${isHoliday}`);
        loadDay();
    } catch (err) {
        console.error('Ошибка обновления праздника:', err);
        alert('Ошибка при установке праздника: ' + err.message);
    }
}

async function toggleWorkday() {
    const date = document.getElementById('datePicker').value;
    if (!date) return;
    loadDay(); // Обновляем UI (скрыть/показать расписание и посещаемость)
}

async function saveSchedule() {
    const date = document.getElementById('datePicker').value;
    if (!date) return alert('Выберите дату');

    try {
        const holidayResponse = await fetch(`/holidays/${date}`);
        if (!holidayResponse.ok) throw new Error(`HTTP ${holidayResponse.status}`);
        const holidayData = await holidayResponse.json();
        const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
        const isWorkday = document.getElementById('workdayCheck').checked;
        const effectiveHoliday = holidayData.isHoliday && !isWorkday;
        if (effectiveHoliday || (isWeekend && !isWorkday)) {
            return alert('Нельзя добавлять расписание в выходные или праздничные дни');
        }

        const pairs = [];
        for (let i = 1; i <= 5; i++) {
            if (document.getElementById(`pair${i}`).checked) {
                pairs.push({ number: i, type: document.getElementById(`type${i}`).value });
            }
        }
        if (pairs.length > 4 || (pairs.some(p => p.number === 1) && pairs.some(p => p.number === 5))) {
            alert('Максимум 4 пары, и нельзя одновременно 1 и 5');
            return;
        }

        const response = await fetch('/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, pairs })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(`Расписание для ${date} сохранено:`, pairs);
        loadDay();
    } catch (err) {
        console.error('Ошибка сохранения расписания:', err);
        alert('Ошибка сохранения расписания: ' + err.message);
    }
}

async function loadDay() {
    const date = document.getElementById('datePicker').value;
    if (!date) return;

    try {
        const [holidayResponse, scheduleResponse, attendanceResponse] = await Promise.all([
            fetch(`/holidays/${date}`),
            fetch(`/schedule/${date}`),
            fetch(`/attendance/${date}`)
        ]);

        if (!holidayResponse.ok || !scheduleResponse.ok || !attendanceResponse.ok) {
            throw new Error('Ошибка загрузки данных дня');
        }

        const holidayData = await holidayResponse.json();
        const scheduleData = await scheduleResponse.json();
        const attendanceData = await attendanceResponse.json();

        console.log('Загружено расписание:', scheduleData);
        console.log('Загружена посещаемость:', attendanceData);

        const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
        const isWorkday = document.getElementById('workdayCheck').checked;
        const effectiveHoliday = holidayData.isHoliday && !isWorkday;
        document.getElementById('holidayCheck').checked = holidayData.isHoliday || false;

        const scheduleSection = document.getElementById('scheduleSection');
        const attendanceSection = document.getElementById('attendanceSection');
        const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');

        const isNonWorking = effectiveHoliday || (isWeekend && !isWorkday);
        scheduleSection.style.display = isNonWorking ? 'none' : 'block';
        attendanceSection.style.display = isNonWorking ? 'none' : 'block';
        saveAttendanceBtn.style.display = isNonWorking ? 'none' : 'block';

        const header = document.getElementById('tableHeader');
        const body = document.getElementById('tableBody');
        header.innerHTML = ''; // Полный сброс
        body.innerHTML = '';

        const schedule = scheduleData.schedule;
        let attendance = {};
        if (attendanceData.attendance) {
            attendanceData.attendance.forEach(a => {
                const key = `${date}_${a.pair_number}_${a.student_id}`;
                attendance[key] = {
                    status: a.status,
                    reason: a.reason || '',
                    comment: a.comment || ''
                };
            });
        }

        if (schedule && schedule.pairs && schedule.pairs.length > 0) {
            // Создаем отдельную строку для заголовков
            let headerRow = '<tr><th>Ф.И.О.</th>';
            schedule.pairs.forEach(p => {
                headerRow += `<th>Пара ${p.number} (${p.type === 'regular' ? 2 : 1} ч.)</th>`;
                console.log(`Добавлен заголовок для Пара ${p.number}: ${p.type}`);
            });
            headerRow += '</tr>';
            header.innerHTML = headerRow;

            // Формируем строки для каждого студента
            students.forEach(student => {
                if (student.status === 'academic_leave') return;
                let row = `<tr data-student-id="${student.id}">`;
                row += `<td>${student.name}</td>`; // Имя в первом столбце

                // Добавляем ячейки для каждой пары
                schedule.pairs.forEach(p => {
                    const key = `${date}_${p.number}_${student.id}`;
                    const att = attendance[key] || { status: 'present', reason: '', comment: '' };
                    const isAbsent = att.status === 'absent';
                    row += `
                        <td class="${isAbsent ? 'absent' : ''}" data-pair="${p.number}">
                            <input type="checkbox" ${!isAbsent ? 'checked' : ''} onchange="toggleReason(this, ${student.id}, ${p.number})">
                            <select style="display: ${isAbsent ? 'inline-block' : 'none'}" onchange="updateAttendance(${student.id}, ${p.number})">
                                <option value="">Выберите причину</option>
                                ${reasons.map(r => `<option value="${r.name}" ${att.reason === r.name ? 'selected' : ''}>${r.name}</option>`).join('')}
                            </select>
                            <input type="text" class="comment" value="${att.comment}" placeholder="Комментарий" style="display: ${isAbsent ? 'inline-block' : 'none'}" onchange="updateAttendance(${student.id}, ${p.number})">
                        </td>`;
                    console.log(`Добавлена ячейка для студента ${student.name}, пара ${p.number}`);
                });

                row += '</tr>';
                body.innerHTML += row;
            });
        } else {
            // Если расписание пустое, показываем сообщение
            header.innerHTML = '<tr><th colspan="5">Расписание не найдено. Сохраните расписание для этой даты.</th></tr>';
            students.forEach(student => {
                if (student.status === 'academic_leave') return;
                let row = `<tr data-student-id="${student.id}"><td>${student.name}</td><td colspan="4"></td></tr>`;
                body.innerHTML += row;
            });
            console.warn('Расписание для даты', date, 'не найдено или пустое.');
        }
    } catch (err) {
        console.error('Ошибка загрузки дня:', err);
        alert('Ошибка загрузки данных дня: ' + err.message);
    }
}

function toggleReason(checkbox, studentId, pair) {
    const cell = checkbox.parentElement;
    const select = cell.querySelector('select');
    const comment = cell.querySelector('.comment');
    const isPresent = checkbox.checked;
    if (!isPresent) {
        cell.classList.add('absent');
        select.style.display = 'inline-block';
        comment.style.display = 'inline-block';
    } else {
        cell.classList.remove('absent');
        select.style.display = 'none';
        comment.style.display = 'none';
    }
    updateAttendance(studentId, pair);
}

async function updateAttendance(studentId, pair) {
    const date = document.getElementById('datePicker').value;
    try {
        const scheduleResponse = await fetch(`/schedule/${date}`);
        if (!scheduleResponse.ok) throw new Error(`HTTP ${scheduleResponse.status}`);
        const scheduleData = await scheduleResponse.json();
        const schedule = scheduleData.schedule;
        if (!schedule) return;

        const pairData = schedule.pairs.find(p => p.number === pair);
        if (!pairData) return;

        const row = document.querySelector(`#tableBody tr[data-student-id="${studentId}"]`);
        const cell = row.querySelector(`td[data-pair="${pair}"]`);
        if (!cell) return;

        const status = cell.querySelector('input[type="checkbox"]').checked ? 'present' : 'absent';
        const reason = cell.querySelector('select').value || 'Неизвестно';
        const comment = cell.querySelector('.comment').value || '';
        const hours = status === 'absent' ? (pairData.type === 'regular' ? 2 : 1) : 0;
        const respectful = reasons.find(r => r.name === reason)?.respectful || false;

        const response = await fetch('/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, pair, student_id: studentId, status, reason, respectful, hours, comment })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(`Посещаемость обновлена: студент ${studentId}, пара ${pair}, причина: ${reason}, комментарий: ${comment}`);
    } catch (err) {
        console.error('Ошибка обновления посещаемости:', err);
        alert('Ошибка обновления посещаемости: ' + err.message);
    }
}

async function saveAttendance() {
    const date = document.getElementById('datePicker').value;
    try {
        const scheduleResponse = await fetch(`/schedule/${date}`);
        if (!scheduleResponse.ok) throw new Error(`HTTP ${scheduleResponse.status}`);
        const scheduleData = await scheduleResponse.json();
        const schedule = scheduleData.schedule;
        if (!schedule) return alert('Сначала сохраните расписание для этой дня');

        const holidayResponse = await fetch(`/holidays/${date}`);
        if (!holidayResponse.ok) throw new Error(`HTTP ${holidayResponse.status}`);
        const holidayData = await holidayResponse.json();
        const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
        const isWorkday = document.getElementById('workdayCheck').checked;
        const effectiveHoliday = holidayData.isHoliday && !isWorkday;
        if (effectiveHoliday || (isWeekend && !isWorkday)) {
            return alert('Нельзя сохранять посещаемость в выходные или праздничные дни');
        }

        alert('Посещаемость сохранена (данные обновлены в БД)');
        loadDay();
    } catch (err) {
        console.error('Ошибка сохранения посещаемости:', err);
        alert('Ошибка сохранения посещаемости: ' + err.message);
    }
}

async function showReport() {
    const monthStr = document.getElementById('monthPicker').value;
    if (!monthStr) return;

    try {
        const response = await fetch(`/report/${monthStr}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('Данные отчета:', data); // Отладка: полный JSON от API
        const reportBody = document.getElementById('reportBody');
        const reportTable = document.getElementById('reportTable');
        const reportSummary = document.getElementById('reportSummary');
        reportBody.innerHTML = '';

        let totalRespectfulGroup = 0;
        let totalNonRespectfulGroup = 0;
        let totalMissedGroup = 0;

        if (!data.report || data.report.length === 0) {
            reportBody.innerHTML = '<tr><td colspan="5">Нет данных за выбранный месяц.</td></tr>';
        } else {
            data.report.forEach((row, index) => {
                const respectful = row.respectful_hours || 0;
                const nonRespectful = row.non_respectful_hours || 0;
                const total = respectful + nonRespectful;

                totalRespectfulGroup += respectful;
                totalNonRespectfulGroup += nonRespectful;
                totalMissedGroup += total;

                // Отладка: логируем row.reasons для каждого студента
                console.log(`Причины для ${row.name}:`, row.reasons);

                let groupedReasons = '';
                if (row.reasons && typeof row.reasons === 'string' && row.reasons.trim() !== '') {
                    const reasonEntries = {};
                    const reasonParts = row.reasons.split(', ').filter(part => part.trim() !== '');
                    let hasInvalidFormat = false;

                    reasonParts.forEach(part => {
                        // Основная регулярка для формата "Причина (дата Пара X: комментарий)"
                        let match = part.match(/^(.*?)\s*\(([^)]+)\)$/);
                        if (match) {
                            const reasonName = match[1].trim();
                            const details = match[2].trim();
                            if (!reasonEntries[reasonName]) {
                                reasonEntries[reasonName] = { count: 0, detailsList: [] };
                            }
                            reasonEntries[reasonName].count++;
                            reasonEntries[reasonName].detailsList.push(details);
                        } else {
                            // Пробуем обработать некорректный формат
                            console.warn(`Некорректный формат причины для ${row.name}: ${part}`);
                            hasInvalidFormat = true;
                            // Проверяем, является ли part просто причиной без деталей
                            const reasonName = part.trim();
                            if (reasonName && reasons.some(r => r.name === reasonName)) {
                                if (!reasonEntries[reasonName]) {
                                    reasonEntries[reasonName] = { count: 0, detailsList: [] };
                                }
                                reasonEntries[reasonName].count++;
                                reasonEntries[reasonName].detailsList.push('без деталей');
                            } else if (part.includes('Пара')) {
                                // Если есть "Пара", но нет причины, считаем "Неизвестно"
                                if (!reasonEntries['Неизвестно']) {
                                    reasonEntries['Неизвестно'] = { count: 0, detailsList: [] };
                                }
                                reasonEntries['Неизвестно'].count++;
                                reasonEntries['Неизвестно'].detailsList.push(part);
                            }
                        }
                    });

                    if (Object.keys(reasonEntries).length > 0) {
                        groupedReasons = Object.entries(reasonEntries)
                            .map(([reason, entry]) => `${reason} (${entry.count} раза: ${entry.detailsList.join(', ')})`)
                            .join('; ');
                    } else if (hasInvalidFormat) {
                        groupedReasons = 'Ошибка формата причин';
                    } else {
                        groupedReasons = 'Нет пропусков';
                    }
                } else {
                    groupedReasons = 'Нет пропусков';
                }

                const rowClass = index % 2 === 0 ? 'even-row' : 'odd-row';
                const statusDisplay = row.status === 'academic_leave' ? 'академический пропуск' : row.status;

                reportBody.innerHTML += `
                    <tr class="${rowClass}">
                        <td>${row.name}${statusDisplay ? ` (${statusDisplay}: ${row.details})` : ''}</td>
                        <td class="respectful-hours">${respectful}</td>
                        <td class="non-respectful-hours">${nonRespectful}</td>
                        <td class="total-missed">${total}</td>
                        <td>${groupedReasons}</td>
                    </tr>`;
            });
        }

        reportTable.style.display = 'table';
        reportSummary.style.display = 'block';
        document.getElementById('totalRespectful').textContent = totalRespectfulGroup;
        document.getElementById('totalNonRespectful').textContent = totalNonRespectfulGroup;
        document.getElementById('totalMissed').textContent = totalMissedGroup;

    } catch (err) {
        console.error('Ошибка генерации отчета:', err);
        alert('Ошибка генерации отчёта: ' + err.message);
    }
}

loadStudents().then(() => loadDay());