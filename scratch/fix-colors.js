const fs = require('fs');
const path = require('path');

const directory = 'c:/Users/HP/Desktop/Sellsnap';
const search = /var\(--color-border\)/g;
const replacement = 'var(--color-outline-variant)';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
                walk(fullPath);
            }
        } else if (fullPath.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (search.test(content)) {
                console.log(`Updating ${fullPath}`);
                const newContent = content.replace(search, replacement);
                fs.writeFileSync(fullPath, newContent, 'utf8');
            }
        }
    }
}

walk(directory);
console.log('Finished updating color tokens.');
