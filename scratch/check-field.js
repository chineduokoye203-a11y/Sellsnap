const Database = require('better-sqlite3');
const path = require('path');

try {
    const dbPath = path.resolve('prisma/dev.db');
    const db = new Database(dbPath);
    try {
        const row = db.prepare("SELECT onboardingComplete FROM User LIMIT 1").get();
        console.log('Query success! Value:', row);
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    db.close();
} catch (err) {
    console.error('Error:', err);
}
