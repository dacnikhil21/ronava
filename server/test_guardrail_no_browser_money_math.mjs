import fs from 'fs';
import path from 'path';

/**
 * GUARDRAIL TEST: ZERO BROWSER MONEY MATH & ZERO 'Super Admin' FALLBACKS
 *
 * Scans all client files in src/ for banned financial calculation patterns:
 * 1. Multiplying or dividing amounts by rates or 100 (e.g. amount * rate / 100)
 * 2. .reduce() sums over transactions, balances, or fees
 * 3. Browser-side fee subtraction (e.g. gross - fee, compFee - uplines)
 * 4. Hardcoded 'Super Admin' fallbacks (e.g. || 'Super Admin')
 */

const ROOT_DIR = process.cwd();
const TARGET_DIR = path.join(ROOT_DIR, 'src');
const EXTENSIONS = ['.js', '.jsx'];

const BANNED_PATTERNS = [
  {
    name: 'FEE_OR_PROFIT_CALCULATION',
    regex: /(\b(?:amount|amt|gross)\b\s*\*\s*\b(?:rate|margin|merchant_buy_rate|txnMargin)\b\s*\/\s*100|\b(?:rate|margin)\b\s*\*\s*\b(?:amount|amt)\b\s*\/\s*100)/i,
    description: "Browser-side fee or profit calculation (e.g., amount * rate / 100 or amt * txnMargin / 100)"
  },
  {
    name: 'FINANCIAL_REDUCE_SUM',
    regex: /\.reduce\s*\(\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>.*(?:\+|sum|acc|total).*?\b(?:amount|amt|fee|sales|balance|volume|rent|monthly_rent)\b/i,
    description: "Browser-side .reduce() sum over financial balances, amounts, transactions, or fees"
  },
  {
    name: 'FEE_SUBTRACTION_MATH',
    regex: /\b(?:gross|compFee|channelNetCredited)\s*-\s*(?:fee|uplines|totalUplines|adminNet|channelWithdrawn)\b/i,
    description: "Browser-side net margin or fee subtraction (e.g., gross - fee or compFee - totalUplines)"
  },
  {
    name: 'SUPER_ADMIN_FALLBACK',
    regex: /\|\|\s*['"]Super Admin['"]/i,
    description: "Hardcoded fallback to 'Super Admin' instead of authentic parent or 'Direct'"
  }
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  }
  return arrayOfFiles;
}

export function runNoBrowserMoneyMathGuardrail() {
  console.log('=== RUNNING SECURITY GUARDRAIL: ZERO BROWSER MONEY MATH & FALLBACKS ===');
  const violations = [];

  if (!fs.existsSync(TARGET_DIR)) {
    throw new Error(`Target directory ${TARGET_DIR} does not exist`);
  }

  const files = getAllFiles(TARGET_DIR);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Ignore comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      for (const pattern of BANNED_PATTERNS) {
        if (pattern.regex.test(line)) {
          violations.push({
            file: path.relative(ROOT_DIR, filePath),
            line: index + 1,
            content: trimmed,
            rule: pattern.description,
            patternName: pattern.name
          });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error(`\n❌ GUARDRAIL FAILED: Found ${violations.length} prohibited browser money math / fallback violation(s):`);
    violations.forEach((v, i) => {
      console.error(`  ${i + 1}. [${v.file}:${v.line}] (${v.patternName}) ${v.rule}`);
      console.error(`     Code: ${v.content}\n`);
    });
    throw new Error(`GUARDRAIL_VIOLATION: ${violations.length} prohibited browser money calculations or fallbacks detected in src/.`);
  }

  console.log(`✅ GUARDRAIL PASSED: 0 prohibited browser money math calculations or 'Super Admin' fallbacks found across ${files.length} src/ files.`);
  return true;
}

// Direct execution
if (process.argv[1]?.endsWith('test_guardrail_no_browser_money_math.mjs')) {
  try {
    runNoBrowserMoneyMathGuardrail();
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
