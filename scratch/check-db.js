const Database = require('better-sqlite3');
const path = require('path');

try {
    const dbPath = path.resolve('prisma/dev.db');
    console.log('Opening database at:', dbPath);
    const db = new Database(dbPath);
    const info = db.prepare("PRAGMA table_info(User)").all();
    console.log('Columns in User table:', info.map(c => c.name));
    db.close();
} catch (err) {
    console.error('Error:', err);
}
