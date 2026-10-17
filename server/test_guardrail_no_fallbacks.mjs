import fs from 'fs';
import path from 'path';
import assert from 'assert';

/**
 * GUARDRAIL TEST: ZERO HARDCODED USER / ROLE FALLBACKS
 * 
 * Scans all JavaScript and JSX files in server/ and src/ for banned shortcut patterns:
 * - || 'ADM001', || 'ADMIN', || 'MERCHANT' (or double quotes / case-insensitive)
 * - Function default parameters that default callerId/createdBy to 'ADMIN', 'ADM001', or 'MERCHANT'
 */

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ['server', 'src'];
const EXTENSIONS = ['.js', '.jsx', '.mjs'];

// Patterns that indicate shortcut guessing instead of explicit authentication
const BANNED_PATTERNS = [
  {
    regex: /\|\|\s*['"](ADM001|ADMIN|MERCHANT)['"]/i,
    description: "Default fallback to fixed user/role identity (e.g. || 'ADM001' or || 'ADMIN' or || 'MERCHANT')"
  },
  {
    regex: /(callerId|createdBy|updatedBy|creatorId)\s*=\s*['"](ADM001|ADMIN|MERCHANT)['"]/i,
    description: "Function parameter default guessing caller identity (e.g. callerId = 'ADMIN')"
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
        // Exclude the test file itself
        if (!file.includes('test_guardrail_no_fallbacks')) {
          arrayOfFiles.push(fullPath);
        }
      }
    }
  }
  return arrayOfFiles;
}

export function runGuardrailAudit() {
  console.log('=== RUNNING SECURITY GUARDRAIL: ZERO USER/ROLE FALLBACKS ===');
  const violations = [];

  for (const dir of TARGET_DIRS) {
    const fullDirPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullDirPath)) continue;

    const files = getAllFiles(fullDirPath);
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Ignore single-line comments that mention the rule
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        for (const pattern of BANNED_PATTERNS) {
          if (pattern.regex.test(line)) {
            violations.push({
              file: path.relative(ROOT_DIR, filePath),
              line: index + 1,
              content: trimmed,
              rule: pattern.description
            });
          }
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error(`\n❌ GUARDRAIL FAILED: Found ${violations.length} shortcut fallback violation(s):`);
    violations.forEach((v, i) => {
      console.error(`  ${i + 1}. [${v.file}:${v.line}] ${v.rule}`);
      console.error(`     Code: ${v.content}\n`);
    });
    throw new Error(`GUARDRAIL_VIOLATION: ${violations.length} banned user/role fallbacks detected.`);
  }

  console.log('✅ GUARDRAIL PASSED: 0 shortcut user/role fallbacks found across server/ and src/.');
  return true;
}

// Direct execution
if (process.argv[1]?.endsWith('test_guardrail_no_fallbacks.mjs')) {
  try {
    runGuardrailAudit();
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
