import fs from 'fs';
import path from 'path';

// List of files to scan
const srcDir = './src';
const findings = [];

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip CSS / styling lines
    if (
      trimmed.startsWith('padding:') ||
      trimmed.startsWith('margin:') ||
      trimmed.startsWith('fontSize:') ||
      trimmed.startsWith('opacity:') ||
      trimmed.startsWith('width:') ||
      trimmed.startsWith('height:') ||
      trimmed.startsWith('lineHeight:') ||
      trimmed.startsWith('borderRadius:') ||
      trimmed.startsWith('boxShadow:') ||
      trimmed.startsWith('border:') ||
      trimmed.startsWith('background:') ||
      trimmed.startsWith('color:') ||
      trimmed.startsWith('letterSpacing:') ||
      trimmed.includes('letterSpacing:') ||
      trimmed.includes('letter-spacing:') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return;
    }

    // Strip inline comments
    const codeOnly = trimmed.split('//')[0].trim();
    if (!codeOnly) return;

    // Pattern 1: Math operations with raw decimal numbers (e.g. * 0.0015, * 0.017, * 0.0025)
    const decimalMathMatch = codeOnly.match(/(\*|\/|\+|-)\s*(0\.\d{2,5})/);
    if (decimalMathMatch && !codeOnly.includes('scale(') && !codeOnly.includes('rgba(') && !codeOnly.includes('opacity') && !codeOnly.includes('letterSpacing') && !codeOnly.includes('letter-spacing') && !codeOnly.includes('numHeight')) {
      findings.push({
        type: 'FINANCIAL_DECIMAL_MATH',
        file: filePath,
        line: lineNum,
        code: codeOnly,
        match: decimalMathMatch[0]
      });
    }

    // Pattern 2: Hardcoded percentage text in UI (e.g. '(0.2%)', '(0.40%)', '1.50%', '1.80%')
    const hardcodedPercentMatch = line.match(/\(\s*0\.\d+%\s*\)/);
    if (hardcodedPercentMatch) {
      findings.push({
        type: 'HARDCODED_PERCENT_LABEL',
        file: filePath,
        line: lineNum,
        code: trimmed,
        match: hardcodedPercentMatch[0]
      });
    }
  });
}

scanDirectory(srcDir);

console.log('====================================================');
console.log(`🔍 HARDCODED MATH & PERCENTAGE SCANNER REPORT`);
console.log(`Found ${findings.length} mathematical hardcoded occurrences in src/`);
console.log('====================================================\n');

findings.forEach((f, i) => {
  console.log(`[#${i + 1}] [${f.type}] in ${f.file}:${f.line}`);
  console.log(`    Matched: "${f.match}"`);
  console.log(`    Code: ${f.code}`);
  console.log('----------------------------------------------------');
});
