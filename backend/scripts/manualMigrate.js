const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Manual SQL Migration (V3)...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'prisma', 'init.sql');
    const buffer = fs.readFileSync(sqlPath);

    // Detect encoding (type output showed readable text, so buffer to string should work if cleaned)
    let sql = buffer.toString('utf8');
    if (sql.includes('\0')) {
        sql = buffer.toString('utf16le');
    }

    // Remove BOM and clean whitespace
    sql = sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    console.log('📦 Parsing SQL commands...');

    // Split by semicolons, but ignore semicolons inside single quotes
    // This is a simple but effective regex for most schema files
    const commands = [];
    let currentCommand = '';
    let inQuote = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'" && (i === 0 || sql[i - 1] !== "\\")) {
            inQuote = !inQuote;
        }

        if (char === ';' && !inQuote) {
            commands.push(currentCommand.trim());
            currentCommand = '';
        } else {
            currentCommand += char;
        }
    }
    if (currentCommand.trim()) commands.push(currentCommand.trim());

    const filteredCommands = commands.filter(cmd => {
        // Remove comments for cleaner execution log
        const cleaned = cmd.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        return cleaned.length > 0;
    });

    console.log(`🚀 Executing ${filteredCommands.length} commands...`);

    for (let cmd of filteredCommands) {
        // Remove comments from the actual command being sent
        const sqlToSend = cmd.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();

        try {
            await prisma.$executeRawUnsafe(sqlToSend);
            console.log(`  ✅ Success: ${sqlToSend.substring(0, 40).replace(/\n/g, ' ')}...`);
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('already a member')) {
                console.log(`  ℹ Skipping: ${sqlToSend.substring(0, 40).replace(/\n/g, ' ')}... (Exists)`);
            } else {
                console.error(`  ❌ Failed: ${sqlToSend.substring(0, 40).replace(/\n/g, ' ')}...`);
                console.error(`     Error: ${err.message}`);
            }
        }
    }

    console.log('🎊 Manual Migration (V3) Finished!');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
