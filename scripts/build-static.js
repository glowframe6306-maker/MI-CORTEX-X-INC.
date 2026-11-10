'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const excludedFiles = new Set([
  'admin.html',
  'admin-login.html',
  'careers-admin.html',
  'careers-admin.css',
  'careers-admin.js',
  'careers-server.js',
  'careers-server.test.js',
  'careers-upload-entry.js'
]);
const staticExtensions = new Set(['.css', '.html', '.ico', '.jpeg', '.jpg', '.js', '.png', '.svg', '.webp']);

function copyStaticFiles(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'assets') continue;
      fs.mkdirSync(destinationPath, { recursive: true });
      copyStaticFiles(sourcePath, destinationPath);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!staticExtensions.has(extension) || excludedFiles.has(entry.name)) continue;
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

async function build() {
  if (fs.existsSync(output)) {
    throw new Error('The dist directory already exists. Review it and move it before building to avoid overwriting existing files.');
  }
  fs.mkdirSync(output, { recursive: true });
  copyStaticFiles(root, output);
  await esbuild.build({
    entryPoints: [path.join(root, 'careers-upload-entry.js')],
    bundle: true,
    format: 'iife',
    target: ['es2022'],
    outfile: path.join(output, 'careers-upload.js'),
    minify: true,
    legalComments: 'eof'
  });
  for (const privateFile of excludedFiles) {
    if (fs.existsSync(path.join(output, privateFile))) {
      throw new Error(`The public build unexpectedly contains ${privateFile}.`);
    }
  }
  console.log('Static website built in dist; private admin pages and local server files are excluded from public output.');
}

build().catch((error) => {
  console.error(`Static build failed: ${error.message}`);
  process.exitCode = 1;
});
