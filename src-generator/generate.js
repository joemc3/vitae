#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse --input argument
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
if (inputIndex === -1 || !args[inputIndex + 1]) {
  console.error('Usage: node generate.js --input <path-to-input.json>');
  process.exit(1);
}

const inputPath = args[inputIndex + 1];

// Read input
let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
} catch (e) {
  console.error(`Failed to read input: ${e.message}`);
  process.exit(1);
}

const { site_id, output_dir, portfolio_data } = input;

console.log(`Generating ${portfolio_data.siteType} site with theme "${portfolio_data.theme.name}" for site ${site_id}`);
console.log(`Output: ${output_dir}`);

// Write portfolio data for Next.js to consume
const dataDir = path.join(__dirname, '.data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'portfolio-data.json'),
  JSON.stringify(portfolio_data, null, 2)
);

// Run Next.js static export
try {
  execSync('npx next build', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  // Copy the static output to the target directory
  const nextOutputDir = path.join(__dirname, 'out');
  if (!fs.existsSync(nextOutputDir)) {
    console.error('Next.js build did not produce output directory');
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(output_dir, { recursive: true });

  // Copy files recursively
  copyRecursive(nextOutputDir, output_dir);

  console.log(`Site generated successfully at ${output_dir}`);
} catch (e) {
  console.error(`Build failed: ${e.message}`);
  process.exit(1);
} finally {
  // Clean up .data directory
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
