const fs = require('fs');

// .env.example — remove Twilio/Vapi vars
let env = fs.readFileSync('.env.example', 'utf8');
env = env.split('\n').filter(l => {
    const lower = l.toLowerCase();
    return !lower.includes('twilio') && !lower.includes('vapi');
}).join('\n');
fs.writeFileSync('.env.example', env, 'utf8');
console.log('.env.example cleaned');

// render.yaml — check for Twilio env vars
if (fs.existsSync('backend/render.yaml')) {
    let ry = fs.readFileSync('backend/render.yaml', 'utf8');
    const before = ry.split('\n').length;
    ry = ry.split('\n').filter(l => {
        const lower = l.toLowerCase();
        return !lower.includes('twilio') && !lower.includes('vapi');
    }).join('\n');
    fs.writeFileSync('backend/render.yaml', ry, 'utf8');
    console.log('render.yaml cleaned, removed', before - ry.split('\n').length, 'lines');
}

// railway.toml / railway.json
for (const f of ['backend/railway.toml', 'backend/railway.json']) {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        if (content.toLowerCase().includes('twilio') || content.toLowerCase().includes('vapi')) {
            console.log(f, 'has Twilio/Vapi refs — check manually');
        } else {
            console.log(f, 'clean');
        }
    }
}

// package.json — check for twilio npm package
const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const twilioPackages = Object.keys(deps).filter(k => k.toLowerCase().includes('twilio') || k.toLowerCase().includes('vapi'));
console.log('Twilio/Vapi npm packages:', twilioPackages);
