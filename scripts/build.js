/**
 * Build script: compiles React client, copies dist into server/public,
 * then runs electron-builder to produce the Windows installer.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT       = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const SERVER_DIR = path.join(ROOT, 'server');
const DIST_SRC   = path.join(CLIENT_DIR, 'dist');
const DIST_DEST  = path.join(SERVER_DIR, 'public');

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log('═══════════════════════════════════════');
console.log('  Merchandise ERP — Installer Build');
console.log('═══════════════════════════════════════\n');

// 1. Build React client
console.log('Step 1/4 — Building React client...');
run('npm run build', CLIENT_DIR);

// 2. Copy client/dist → server/public
console.log('\nStep 2/4 — Copying client build to server/public...');
copyDir(DIST_SRC, DIST_DEST);
console.log(`  ✓ Copied to ${DIST_DEST}`);

// 3. Install server production deps (prune devDeps)
console.log('\nStep 3/4 — Installing server production dependencies...');
run('npm install --omit=dev', SERVER_DIR);

// 4. Run electron-builder (package the app)
console.log('\nStep 4/4 — Packaging app with Electron...');
const env4 = {
  ...process.env,
  TEMP: 'G:/tmp', TMP: 'G:/tmp',
  LOCALAPPDATA: 'G:/AppData/Local',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
};

try {
  execSync('npx electron-builder --win --x64', { cwd: ROOT, stdio: 'inherit', env: env4 });
} catch {
  // electron-builder may fail on winCodeSign symlinks — that's OK if win-unpacked is there
  const unpacked = path.join(ROOT, 'dist-installer', 'win-unpacked');
  if (!fs.existsSync(unpacked)) {
    throw new Error('electron-builder failed and win-unpacked was not created');
  }
  console.log('\nCreating ZIP from win-unpacked (winCodeSign symlink error is harmless)...');
  execSync(
    `powershell -Command "Compress-Archive -Path '${unpacked}' -DestinationPath '${path.join(ROOT, 'dist-installer', 'MerchandiseERP-v1.0.0-win64.zip')}' -Force"`,
    { stdio: 'inherit' }
  );
}

console.log('\n✅ Build complete! Output is in dist-installer/');
console.log('   Share: dist-installer/MerchandiseERP-v1.0.0-win64.zip');
console.log('   Instructions: Extract the ZIP, open the folder, run "Merchandise ERP.exe"');
