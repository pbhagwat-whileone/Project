const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = [...walk('./src'), ...walk('./app')];
let totalRemoved = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // We will replace console.log with void 0 /* console.log removed */
    // but a safer way is to just comment out lines that start with console.log
    
    const lines = content.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*console\.log\(/.test(lines[i])) {
            // Check if it's a single line console.log
            if (/\);?\s*$/.test(lines[i])) {
                lines[i] = lines[i].replace(/console\.log\(/, '// console.log(');
                changed = true;
                totalRemoved++;
            }
        }
    }
    
    if (changed) {
        fs.writeFileSync(file, lines.join('\n'));
    }
});

console.log(`Commented out ${totalRemoved} console.log lines.`);
