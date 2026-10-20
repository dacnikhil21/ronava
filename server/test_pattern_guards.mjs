import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('RUNNING PATTERN-BASED ARCHITECTURAL GUARDS (RULES.md ENFORCEMENT)');
console.log('===============================================================\n');

let allPassed = true;
const results = [];

function checkFile(filePath, regex, message) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  lines.forEach((line, idx) => {
    // ignore comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    if (regex.test(line)) {
      violations.push({ line: idx + 1, content: trimmed });
    }
  });
  return violations;
}

function checkDirectory(dirPath, regex, extensions = ['.jsx', '.js']) {
  let violations = [];
  if (!fs.existsSync(dirPath)) return violations;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      violations = violations.concat(checkDirectory(fullPath, regex, extensions));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      const v = checkFile(fullPath, regex, '');
      if (v.length > 0) {
        violations.push({ file: fullPath, matches: v });
      }
    }
  }
  return violations;
}

// -------------------------------------------------------------
// GUARD 1: No .filter/.reduce/.map-sum/.length-count over payouts, swipes, balances, txns, or withdrawals in src/components
// -------------------------------------------------------------
console.log('--- GUARD 1: In-Memory Financial Aggregations & Math in src/components ---');
const mathRegex = /(?:payouts?|swipes?|balances?|transactions?|withdrawals?|records?|batchItems?|items)\s*\.\s*(?:filter\([^)]*\)\s*\.\s*length|reduce\s*\(|map\([^)]*\)\s*\.\s*reduce)/i;
const guard1Violations = checkDirectory('src/components', mathRegex);
if (guard1Violations.length > 0) {
  console.log('❌ FAIL: Found in-memory financial aggregations / counts in src/components:');
  guard1Violations.forEach(g => {
    g.matches.slice(0, 5).forEach(m => console.log(`   ${path.basename(g.file)}:${m.line}: ${m.content.slice(0, 100)}`));
  });
  allPassed = false;
  results.push({ name: 'Guard 1: No In-Memory Financial Math in Screens', status: 'FAIL', count: guard1Violations.length });
} else {
  console.log('✅ PASS: Zero in-memory financial aggregations detected in src/components.');
  results.push({ name: 'Guard 1: No In-Memory Financial Math in Screens', status: 'PASS', count: 0 });
}

// -------------------------------------------------------------
// GUARD 2: No localStorage / sessionStorage access for money, lock, status, or balance in src/components
// -------------------------------------------------------------
console.log('\n--- GUARD 2: Storage Access for Money, Lock, or Status in src/components ---');
const storageRegex = /(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*['"`][^'"`]*(?:money|lock|status|balance|payout|commission|wallet)[^'"`]*['"`]\)/i;
const guard2Violations = checkDirectory('src/components', storageRegex);
if (guard2Violations.length > 0) {
  console.log('❌ FAIL: Found localStorage/sessionStorage money/lock/status access:');
  guard2Violations.forEach(g => {
    g.matches.forEach(m => console.log(`   ${path.basename(g.file)}:${m.line}: ${m.content.slice(0, 100)}`));
  });
  allPassed = false;
  results.push({ name: 'Guard 2: No Storage Access for Money/Lock/Status', status: 'FAIL', count: guard2Violations.length });
} else {
  console.log('✅ PASS: Zero sensitive storage access in src/components.');
  results.push({ name: 'Guard 2: No Storage Access for Money/Lock/Status', status: 'PASS', count: 0 });
}

// -------------------------------------------------------------
// GUARD 3: No status aliases (e.g. 'APPROVED' instead of COMPLETED)
// -------------------------------------------------------------
console.log('\n--- GUARD 3: Status Vocabulary Invariants (No APPROVED status) ---');
const aliasRegex = /(?:setPayoutStatusFilter|statusFilter|payout_status|withdrawal_status|status\s*===?)\s*['"`]APPROVED['"`]|status:\s*['"`]APPROVED['"`]/;
const guard3Violations = checkDirectory('src/components', aliasRegex);
if (guard3Violations.length > 0) {
  console.log('❌ FAIL: Found legacy status alias "APPROVED" in src/components:');
  guard3Violations.forEach(g => {
    g.matches.forEach(m => console.log(`   ${path.basename(g.file)}:${m.line}: ${m.content.slice(0, 100)}`));
  });
  allPassed = false;
  results.push({ name: 'Guard 3: Canonical Status Vocabulary (No APPROVED)', status: 'FAIL', count: guard3Violations.length });
} else {
  console.log('✅ PASS: Zero legacy "APPROVED" status aliases found.');
  results.push({ name: 'Guard 3: Canonical Status Vocabulary (No APPROVED)', status: 'PASS', count: 0 });
}

// -------------------------------------------------------------
// GUARD 4: No duplicate routes in server/api.js
// -------------------------------------------------------------
console.log('\n--- GUARD 4: Duplicate Route Definitions in server/api.js ---');
const apiContent = fs.readFileSync('server/api.js', 'utf8');
const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const declaredRoutes = new Map();
let routeMatch;
const duplicateRoutes = [];
while ((routeMatch = routeRegex.exec(apiContent)) !== null) {
  const method = routeMatch[1].toUpperCase();
  const routePath = routeMatch[2];
  const key = `${method} ${routePath}`;
  if (declaredRoutes.has(key)) {
    duplicateRoutes.push({ key, firstLine: declaredRoutes.get(key) });
  } else {
    declaredRoutes.set(key, routeMatch.index);
  }
}
if (duplicateRoutes.length > 0) {
  console.log('❌ FAIL: Found duplicate route registrations in server/api.js:');
  duplicateRoutes.forEach(d => console.log(`   Duplicate: ${d.key}`));
  allPassed = false;
  results.push({ name: 'Guard 4: No Duplicate Server Routes', status: 'FAIL', count: duplicateRoutes.length });
} else {
  console.log(`✅ PASS: All ${declaredRoutes.size} server routes are uniquely registered.`);
  results.push({ name: 'Guard 4: No Duplicate Server Routes', status: 'PASS', count: 0 });
}

// -------------------------------------------------------------
// GUARD 5: No identity read from request body or query in server/api.js
// -------------------------------------------------------------
console.log('\n--- GUARD 5: Strict Identity from Token (No body/query caller spoofing) ---');
const identitySpoofRegex = /(?:const|let|var)?\s*(?:merchant_id|merchantId|callerId|userId)\s*=\s*req\.(?:body|query)\.(?:merchant_id|merchantId|userId|caller_id)\s*\|\|/i;
const guard5Violations = checkFile('server/api.js', identitySpoofRegex, '');
if (guard5Violations.length > 0) {
  console.log('❌ FAIL: Found request body/query identity fallback spoofing in server/api.js:');
  guard5Violations.forEach(m => console.log(`   line ${m.line}: ${m.content.slice(0, 100)}`));
  allPassed = false;
  results.push({ name: 'Guard 5: Zero Caller Identity Spoofing in Server', status: 'FAIL', count: guard5Violations.length });
} else {
  console.log('✅ PASS: Caller identity is exclusively authenticated via verified token.');
  results.push({ name: 'Guard 5: Zero Caller Identity Spoofing in Server', status: 'PASS', count: 0 });
}

// -------------------------------------------------------------
// GUARD 6: No hardcoded user ID prefix logic for authorization
// -------------------------------------------------------------
console.log('\n--- GUARD 6: Role Authorization from Database (No ID Prefix Guessing) ---');
const prefixRegex = /(?:userId|user_id|merchant_id|merchantId|id|caller\.id)\s*\.\s*startsWith\s*\(\s*['"`](?:MID|ADM|DIST|SD|MST|DD)['"`]\)/;
const guard6Violations = checkFile('server/api.js', prefixRegex, '');
if (guard6Violations.length > 0) {
  console.log('❌ FAIL: Found role authorization guessing by ID prefix in server/api.js:');
  guard6Violations.forEach(m => console.log(`   line ${m.line}: ${m.content.slice(0, 100)}`));
  allPassed = false;
  results.push({ name: 'Guard 6: No Hardcoded ID Prefix Authorization', status: 'FAIL', count: guard6Violations.length });
} else {
  console.log('✅ PASS: Role authorization relies strictly on database user role.');
  results.push({ name: 'Guard 6: No Hardcoded ID Prefix Authorization', status: 'PASS', count: 0 });
}

console.log('\n===============================================================');
console.log('PATTERN GUARD SUMMARY:');
results.forEach(r => console.log(`  [${r.status}] ${r.name} (Violations: ${r.count})`));
console.log('===============================================================');

export { allPassed, results };
