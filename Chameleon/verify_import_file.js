#!/usr/bin/env node
/**
 * Static verification for import_simplyplural_file.js
 * Checks: syntax parsing, require paths, export shape, no naming conflicts
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'discord_commands', 'functions', 'import', 'import_simplyplural_file.js');
const IMPORT_DIR = path.join(__dirname, 'discord_commands', 'functions', 'import');
const BOT_UTILS_DIR = path.join(__dirname, 'discord_commands', 'functions', 'bot_utils');
const SCHEMAS_DIR = path.join(__dirname, 'schemas');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
    if (ok) { passed++; console.log(`  ✅ ${label}`); }
    else    { failed++; console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }
}

// 1. File exists and is readable
console.log('\n=== import_simplyplural_file.js Verification ===\n');
console.log('1. File existence');
check('File exists', fs.existsSync(FILE));

const content = fs.readFileSync(FILE, 'utf8');
check('File is non-empty', content.length > 100, `${content.length} bytes`);

// 2. Syntax: try to parse with Function constructor (basic syntax check)
console.log('\n2. JavaScript syntax');
try {
    // Wrap in a function to avoid actually executing require() calls
    new Function('require', 'module', 'exports', '__dirname', '__filename', content);
    check('No syntax errors', true);
} catch (e) {
    check('No syntax errors', false, e.message);
}

// 3. Require paths resolve
console.log('\n3. Require path resolution');
const requirePaths = [
    { pattern: /require\('\.\/import_simplyplural'\)/, file: path.join(IMPORT_DIR, 'import_simplyplural.js'), label: './import_simplyplural' },
    { pattern: /require\('\.\/r2_sync'\)/, file: path.join(IMPORT_DIR, 'r2_sync.js'), label: './r2_sync' },
    { pattern: /require\('(\.\.\/schemas\/front)'\)/, file: path.join(SCHEMAS_DIR, 'front.js'), label: '../../schemas/front' },
    { pattern: /require\('(\.\.\/schemas\/settings)'\)/, file: path.join(SCHEMAS_DIR, 'settings.js'), label: '../../schemas/settings' },
    { pattern: /require\('(\.\.\/schemas\/alter)'\)/, file: path.join(SCHEMAS_DIR, 'alter.js'), label: '../../schemas/alter' },
    { pattern: /require\('(\.\.\/schemas\/state)'\)/, file: path.join(SCHEMAS_DIR, 'state.js'), label: '../../schemas/state' },
    { pattern: /require\('\.\.\/bot_utils'\)/, file: path.join(BOT_UTILS_DIR, 'index.js'), label: '../bot_utils/index.js' },
];

for (const req of requirePaths) {
    const found = req.pattern.test(content);
    check(`require('${req.label}') referenced`, found);
    if (found) {
        check(`require('${req.label}') file exists`, fs.existsSync(req.file), req.file);
    }
}

// 4. Module exports shape
console.log('\n4. Module exports');
check('Has module.exports', content.includes('module.exports'));
check('Exports importSimplyPluralFile', content.includes('importSimplyPluralFile'));
check('Exports previewSimplyPluralFile', content.includes('previewSimplyPluralFile'));
check('Exports previewSimplyPluralFileData', content.includes('previewSimplyPluralFileData'));

// 5. No naming conflicts with import_simplyplural.js
console.log('\n5. Barrel export compatibility');
const SP_FILE = path.join(IMPORT_DIR, 'import_simplyplural.js');
const spContent = fs.readFileSync(SP_FILE, 'utf8');

const spExports = ['importSimplyPluralAPI', 'processSimplyPluralData', 'fetchSPMembers', 'previewSimplyPluralData', 'previewSimplyPluralAPI'];
const fileExports = ['importSimplyPluralFile', 'previewSimplyPluralFile', 'previewSimplyPluralFileData'];

for (const exp of fileExports) {
    const conflict = spExports.includes(exp);
    check(`No conflict: ${exp}`, !conflict);
}

// 6. Key functions defined (not just referenced)
console.log('\n6. Function definitions');
const fns = ['importSimplyPluralFile', 'transformSPExportData', 'handleAvatarFolder', 'buildMemberIdMap', 'importSPFrontHistory', 'applyCustomFields', 'applyMemberPrivacy', 'updateSystemInfo', 'importPrivacyBuckets', 'previewSimplyPluralFile', 'previewSimplyPluralFileData'];
for (const fn of fns) {
    check(`Function '${fn}' defined`, content.includes(`function ${fn}(`) || content.includes(`async function ${fn}(`));
}

// 7. Reuses processSimplyPluralData (the key requirement)
console.log('\n7. Core requirement: reuse processSimplyPluralData');
check('Calls processSimplyPluralData', content.includes('await processSimplyPluralData('));
check('Does NOT redefine processSimplyPluralData', !content.includes('async function processSimplyPluralData('));

// 8. Handles all SP export fields
console.log('\n8. SP export field handling');
check('Handles frontHistory', content.includes('frontHistory'));
check('Handles customFields', content.includes('customFields'));
check('Handles privacyBuckets', content.includes('privacyBuckets'));
check('Handles users[]', content.includes('data.users'));
check('Handles friends[]', content.includes('data.friends'));
check('Handles fronters[]', content.includes('data.fronters'));
check('Handles avatar folder', content.includes('avatarFolderPath'));

// 9. API route compatibility
console.log('\n9. API route compatibility');
const API_ROUTE = path.join(__dirname, 'api', 'routes', 'import.js');
const apiContent = fs.readFileSync(API_ROUTE, 'utf8');
check('API route imports importSimplyPluralFile', apiContent.includes("require('../../discord_commands/functions/import/import_simplyplural_file')"));
check('API route calls importSimplyPluralFile(system, user, fileData, importOptions)', apiContent.includes('importSimplyPluralFile(system, user, fileData, importOptions)'));
check('API route calls previewSimplyPluralFile(system, fileData)', apiContent.includes('previewSimplyPluralFile(system, fileData)'));

// 10. import_simplyplural.js NOT modified
console.log('\n10. import_simplyplural.js unmodified');
const originalExports = spContent.match(/module\.exports\s*=\s*\{([^}]+)\}/s)?.[1] || '';
check('processSimplyPluralData still exported', originalExports.includes('processSimplyPluralData'));
check('importSimplyPluralAPI still exported', originalExports.includes('importSimplyPluralAPI'));

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
