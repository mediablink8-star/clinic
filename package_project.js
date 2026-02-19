const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'CODEBASE_FOR_REVIEW_V2.md');

// Configuration: Files and directories to include
const includePaths = [
    'package.json',
    'backend/package.json',
    'backend/index.js',
    'backend/prisma/schema.prisma',
    'backend/routes',
    'backend/services',
    'frontend/package.json',
    'frontend/src',
    'frontend/vite.config.js'
];

// Configuration: Extensions to include
const allowedExtensions = ['.js', '.jsx', '.prisma', '.json', '.html', '.css', '.md'];

// Exclusions
const excludeFiles = ['package-lock.json', 'dev.db'];

let output = '# Codebase Review Payload\n\nGenerated for ChatGPT review.\n\n';

function walk(dir, relativePath = '') {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.join(relativePath, file).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                // Only descend if the path is part of an included path
                const isPartofInclude = includePaths.some(p => p.startsWith(relPath) || relPath.startsWith(p));
                if (isPartofInclude) {
                    walk(fullPath, relPath);
                }
            }
        } else {
            const isIncluded = includePaths.some(p => relPath === p || relPath.startsWith(p + '/'));
            const isAllowedExt = allowedExtensions.includes(path.extname(file));
            const isNotExcluded = !excludeFiles.includes(file);

            if (isIncluded && isAllowedExt && isNotExcluded) {
                const content = fs.readFileSync(fullPath, 'utf8');
                let lang = path.extname(file).slice(1);
                if (lang === 'jsx') lang = 'javascript';
                if (lang === 'prisma') lang = 'graphql';

                output += `## File: ${relPath}\n\n`;
                output += '```' + lang + '\n';
                output += content + '\n';
                output += '```\n\n';
            }
        }
    }
}

console.log('Gathering codebase...');
walk(rootDir);
fs.writeFileSync(outputFile, output);
console.log(`✅ Done! Payload saved to: ${outputFile}`);
