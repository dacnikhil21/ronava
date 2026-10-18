import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
const traverse = traversePkg.default || traversePkg;

const KNOWN_GLOBALS = new Set([
  'window', 'document', 'console', 'fetch', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'sessionStorage', 'localStorage', 'Math',
  'JSON', 'Promise', 'Date', 'Error', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Symbol', 'BigInt', 'alert', 'prompt', 'confirm', 'atob', 'btoa', 'crypto',
  'AbortController', 'CustomEvent', 'Event', 'Blob', 'FileReader', 'URL',
  'FormData', 'Headers', 'Request', 'Response', 'navigator', 'location',
  'history', 'performance', 'process', 'Buffer', 'globalThis', 'requestAnimationFrame',
  'cancelAnimationFrame', 'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
  'Image', 'Intl', 'URLSearchParams', 'Node', 'Element', 'HTMLElement'
]);

function getFiles(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) res = res.concat(getFiles(full));
    else if (full.endsWith('.js') || full.endsWith('.jsx')) res.push(full);
  }
  return res;
}

const targetDir = path.resolve('src');
const files = getFiles(targetDir);
const errors = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    errors.push({
      file: path.relative(process.cwd(), file),
      line: err.loc?.line || 1,
      message: `Syntax error: ${err.message}`
    });
    continue;
  }

  traverse(ast, {
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      const name = p.node.name;
      if (KNOWN_GLOBALS.has(name)) return;
      if (!p.scope.hasBinding(name)) {
        errors.push({
          file: path.relative(process.cwd(), file),
          line: p.node.loc?.start.line,
          name,
          message: `'${name}' is not defined or imported.`
        });
      }
    },
    JSXIdentifier(p) {
      if (p.parentPath.isJSXOpeningElement() && p.parentPath.node.name === p.node) {
        const name = p.node.name;
        if (name[0] === name[0].toUpperCase()) {
          if (!p.scope.hasBinding(name) && !KNOWN_GLOBALS.has(name)) {
            errors.push({
              file: path.relative(process.cwd(), file),
              line: p.node.loc?.start.line,
              name,
              message: `JSX Component '<${name} />' is not defined or imported.`
            });
          }
        }
      }
    }
  });
}

if (errors.length > 0) {
  console.error(`\n❌ LINT FAILED: Found ${errors.length} undefined variable(s) in src/:`);
  for (const e of errors) {
    console.error(`  - ${e.file}:${e.line} -> ${e.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n✓ LINT PASSED: Verified ${files.length} files in src/ - 0 undefined variables.`);
  process.exit(0);
}
