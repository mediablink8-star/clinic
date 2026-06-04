export function getOrthodoxEaster(year) {
    const a = year % 19;
    const b = year % 4;
    const c = year % 7;
    const d = (19 * a + 16) % 30;
    const e = (2 * b + 4 * c + 6 * d) % 7;
    const days = 3 + d + e;
    const month = days <= 30 ? 3 : 4;
    const day = days <= 30 ? days : days - 30;
    return new Date(year, month - 1, day);
}

function dateKey(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function getGreekHolidays(year) {
    const holidays = {};
    const add = (m, d, name, type = 'holiday') => {
        holidays[dateKey(year, m, d)] = { name, type };
    };

    // Fixed holidays
    add(1, 1, 'Πρωτοχρονιά — Αγ. Βασίλειος');
    add(1, 6, 'Θεοφάνεια');
    add(3, 25, 'Επέτειος 1821 — Ευαγγελισμός');
    add(5, 1, 'Πρωτομαγιά');
    add(8, 15, 'Δεκαπενταύγουστος — Κοίμηση Θεοτόκου');
    add(10, 28, 'Επέτειος 1940');
    add(12, 25, 'Χριστούγεννα');
    add(12, 26, 'Σύναξη Θεοτόκου');

    // Movable (Orthodox Easter-based)
    const easter = getOrthodoxEaster(year);
    const e = (offset) => {
        const d = new Date(easter);
        d.setDate(d.getDate() + offset);
        return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    };

    holidays[e(-48)] = { name: 'Καθαρά Δευτέρα', type: 'holiday' };
    holidays[e(-2)] = { name: 'Μεγάλη Παρασκευή', type: 'holiday' };
    holidays[e(0)] = { name: 'Πάσχα', type: 'holiday' };
    holidays[e(1)] = { name: 'Δευτέρα του Πάσχα', type: 'holiday' };
    holidays[e(50)] = { name: 'Αγίου Πνεύματος', type: 'holiday' };

    // Major namedays
    add(1, 7, 'Αγ. Ιωάννης', 'nameday');
    add(1, 17, 'Αγ. Αντώνιος', 'nameday');
    add(1, 30, 'Τρεις Ιεράρχες', 'nameday');
    add(2, 10, 'Αγ. Χαράλαμπος', 'nameday');
    add(3, 17, 'Αγ. Αλέξιος', 'nameday');
    add(4, 23, 'Αγ. Γεώργιος', 'nameday');
    add(5, 5, 'Αγ. Ειρήνη', 'nameday');
    add(5, 21, 'Κων/νος & Ελένη', 'nameday');
    add(6, 29, 'Πέτρος & Παύλος', 'nameday');
    add(7, 17, 'Αγ. Μαρίνα', 'nameday');
    add(7, 20, 'Προφ. Ηλίας', 'nameday');
    add(7, 27, 'Αγ. Παντελεήμονας', 'nameday');
    add(8, 6, 'Μεταμόρφωση Σωτήρος', 'nameday');
    add(8, 29, 'Αγ. Ιωάννης Πρόδρομος', 'nameday');
    add(9, 14, 'Ύψωση Τιμίου Σταυρού', 'nameday');
    add(9, 26, 'Αγ. Ιωάννης Θεολόγος', 'nameday');
    add(10, 26, 'Αγ. Δημήτριος', 'nameday');
    add(11, 8, 'Συν. Αρχαγγέλων', 'nameday');
    add(11, 30, 'Αγ. Ανδρέας', 'nameday');
    add(12, 4, 'Αγ. Βαρβάρα', 'nameday');
    add(12, 6, 'Αγ. Νικόλαος', 'nameday');
    add(12, 12, 'Αγ. Σπυρίδωνας', 'nameday');
    add(12, 27, 'Αγ. Στέφανος', 'nameday');

    return holidays;
}

export function getHoliday(dateKeyStr) {
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    return getGreekHolidays(y)[dateKeyStr] || null;
}
