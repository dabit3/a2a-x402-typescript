#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to relative imports in ESM output
 *
 * This script fixes the common TypeScript/Node.js ESM compatibility issue where
 * TypeScript doesn't automatically add .js extensions to relative imports when
 * compiling to ESM format. Node.js ESM requires explicit file extensions.
 *
 * Usage: node scripts/fix-esm-imports.js
 */

const fs = require('fs');
const path = require('path');

const ESM_DIR = path.join(__dirname, '..', 'dist', 'esm');

/**
 * Recursively get all .js files in a directory
 */
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Fix imports in a single file
 */
function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Match import statements with relative paths (starting with ./ or ../)
  // This regex handles:
  // - import { ... } from "./path"
  // - import { ... } from '../path'
  // - import "./path"
  // - export { ... } from "./path"
  // - export * from "./path"
  const importRegex = /((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"])(\.\.[\/]|\.\/)((?:[^'"]*?))(['"])/g;

  content = content.replace(importRegex, (match, prefix, relativePrefix, importPath, suffix) => {
    // Skip if already has .js extension
    if (importPath.endsWith('.js')) {
      return match;
    }

    // Skip if it's not a file import (e.g., imports with query params or fragments)
    if (importPath.includes('?') || importPath.includes('#')) {
      return match;
    }

    modified = true;
    return `${prefix}${relativePrefix}${importPath}.js${suffix}`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
  }

  return modified;
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Fixing ESM imports by adding .js extensions...\n');

  if (!fs.existsSync(ESM_DIR)) {
    console.error(`❌ Error: ESM directory not found at ${ESM_DIR}`);
    console.error('   Make sure to run this script after building the ESM output.');
    process.exit(1);
  }

  const jsFiles = getAllJsFiles(ESM_DIR);
  console.log(`📁 Found ${jsFiles.length} JavaScript files in ESM output\n`);

  let modifiedCount = 0;
  jsFiles.forEach(file => {
    if (fixImportsInFile(file)) {
      modifiedCount++;
    }
  });

  console.log(`\n✅ Done! Modified ${modifiedCount} file(s)`);

  if (modifiedCount === 0) {
    console.log('   No files needed modification (all imports already had .js extensions)');
  }
}

main();
