const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');


// ── Paths ──────────────────────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged;
const APP_DATA    = path.join(app.getPath('appData'), 'MerchandiseERP');
const PG_DATA_DIR = path.join(APP_DATA, 'pgdata');
const PG_PORT     = 5433;  // use non-default to avoid conflicts
const API_PORT    = 5000;
const DB_NAME     = 'merchandise_erp';
const DB_USER     = 'merch_user';
const DB_PASS     = 'merch_internal_2025';
const DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@localhost:${PG_PORT}/${DB_NAME}`;

const SERVER_DIR = IS_PACKAGED
  ? path.join(process.resourcesPath, 'server')
  : path.join(__dirname, '..', 'server');

const CLIENT_DIST = IS_PACKAGED
  ? path.join(process.resourcesPath, 'server', 'public')
  : path.join(__dirname, '..', 'client', 'dist');

// ── State ──────────────────────────────────────────────────────────────────────
let mainWindow   = null;
let loadingWin   = null;
let tray         = null;
let serverProc   = null;
let pg           = null;
let isQuitting   = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  const logFile = path.join(APP_DATA, 'app.log');
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  console.log(msg);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const sock = net.createConnection(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        setTimeout(attempt, 500);
      });
    }
    attempt();
  });
}

// ── Loading window ─────────────────────────────────────────────────────────────
function createLoadingWindow() {
  loadingWin = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    webPreferences: { nodeIntegration: false },
  });
  loadingWin.loadFile(path.join(__dirname, 'loading.html'));
  loadingWin.once('ready-to-show', () => loadingWin.show());
}

function updateStatus(msg) {
  log(msg);
  if (loadingWin && !loadingWin.isDestroyed()) {
    loadingWin.webContents.executeJavaScript(
      `document.getElementById('status') && (document.getElementById('status').textContent = ${JSON.stringify(msg)})`
    ).catch(() => {});
  }
}

// ── Main window ────────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Merchandise ERP',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${API_PORT}`);

  mainWindow.once('ready-to-show', () => {
    if (loadingWin && !loadingWin.isDestroyed()) loadingWin.destroy();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── System tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'assets', 'icon-16.png'));
  tray.setToolTip('Merchandise ERP');

  const menu = Menu.buildFromTemplate([
    { label: 'Open Merchandise ERP', click: () => { mainWindow ? mainWindow.show() : createMainWindow(); } },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${API_PORT}`) },
    { type: 'separator' },
    { label: 'View Logs', click: () => shell.openPath(path.join(APP_DATA, 'app.log')) },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow ? mainWindow.show() : createMainWindow(); });
}

// ── PostgreSQL ─────────────────────────────────────────────────────────────────
async function startPostgres() {
  updateStatus('Starting database engine...');
  ensureDir(PG_DATA_DIR);

  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: DB_USER,
    password: DB_PASS,
    port: PG_PORT,
    persistent: true,
  });

  // Only run initdb on first launch — an already-initialised data dir has PG_VERSION.
  const alreadyInitialised = fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'));
  if (!alreadyInitialised) {
    await pg.initialise();
    log('PostgreSQL data directory initialised');
  }
  await pg.start();
  log('PostgreSQL started');

  // Create DB if it doesn't exist
  try {
    await pg.createDatabase(DB_NAME);
    log(`Database '${DB_NAME}' created`);
  } catch (e) {
    // Already exists — fine
    log(`Database '${DB_NAME}' already exists`);
  }
}

// ── Prisma migrate + seed ──────────────────────────────────────────────────────
// Run a Node script using Electron's OWN bundled Node (via ELECTRON_RUN_AS_NODE),
// so the client machine does not need Node.js / npx installed.
function runNode(scriptPath, args, env, label) {
  return new Promise((resolve, reject) => {
    // Pass --experimental-require-module as a direct flag so Electron's bundled
    // Node 20.18 can require() synchronous ES modules (needed by Prisma 7 internals).
    const proc = spawn(process.execPath, ['--experimental-require-module', scriptPath, ...args], {
      cwd: SERVER_DIR,
      env: { ...process.env, ...env, DATABASE_URL, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => log(`${label}: ${d.toString().trim()}`));
    proc.stderr.on('data', (d) => log(`${label}: ${d.toString().trim()}`));
    proc.on('error', (err) => reject(new Error(`${label} failed to start: ${err.message}`)));
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (code ${code})`)));
  });
}

function runPrisma(args, env) {
  const prismaCli = path.join(SERVER_DIR, 'node_modules', 'prisma', 'build', 'index.js');
  return runNode(prismaCli, args, env, `prisma ${args[0]}`);
}

async function migrateAndSeed() {
  const firstRunFlag = path.join(APP_DATA, '.seeded');

  updateStatus('Running database migrations...');
  await runPrisma(['migrate', 'deploy'], {});

  if (!fs.existsSync(firstRunFlag)) {
    updateStatus('Seeding initial data...');
    await runNode(path.join('prisma', 'seed.js'), [], {}, 'seed');
    fs.writeFileSync(firstRunFlag, new Date().toISOString());
    log('First-run seed complete');
  }
}

// ── Express server ─────────────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    updateStatus('Starting application server...');

    const env = {
      ...process.env,
      DATABASE_URL,
      PORT: String(API_PORT),
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET:  'merchandise-access-secret-prod-2025',
      JWT_REFRESH_SECRET: 'merchandise-refresh-secret-prod-2025',
      JWT_ACCESS_EXPIRES_IN:  '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      CLIENT_URL: `http://localhost:${API_PORT}`,
      NODE_OPTIONS,
    };

    serverProc = spawn(process.execPath, ['src/index.js'], {
      cwd: SERVER_DIR,
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProc.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      log(`server: ${msg}`);
      if (msg.includes('running on port') || msg.includes('5000')) resolve();
    });

    serverProc.stderr.on('data', (d) => log(`server-err: ${d.toString().trim()}`));
    serverProc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        log(`Server exited with code ${code}`);
        if (!mainWindow || mainWindow.isDestroyed()) reject(new Error(`Server crashed (code ${code})`));
      }
    });

    // Fallback: wait for port
    waitForPort(API_PORT, 30000).then(resolve).catch(reject);
  });
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
async function cleanup() {
  log('Shutting down...');
  if (serverProc) {
    try { serverProc.kill(); } catch {}
  }
  if (pg) {
    try { await pg.stop(); } catch {}
  }
}

// ── Boot sequence ──────────────────────────────────────────────────────────────
async function boot() {
  ensureDir(APP_DATA);
  createLoadingWindow();

  try {
    await startPostgres();
    await migrateAndSeed();
    await startServer();

    updateStatus('Launching interface...');
    createMainWindow();
    createTray();
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const stack = (err && err.stack) ? err.stack : String(err);
    log(`BOOT ERROR: ${stack}`);
    try { await cleanup(); } catch {}
    if (loadingWin && !loadingWin.isDestroyed()) loadingWin.destroy();
    dialog.showErrorBox(
      'Merchandise ERP — Startup Error',
      `Failed to start the application:\n\n${msg}\n\nCheck logs at:\n${path.join(APP_DATA, 'app.log')}`
    );
    app.quit();
  }
}

// ── App events ─────────────────────────────────────────────────────────────────
app.whenReady().then(boot);

app.on('window-all-closed', (e) => {
  // Keep running in tray — don't quit
  e.preventDefault();
});

app.on('before-quit', async (e) => {
  if (!isQuitting) return;
  e.preventDefault();
  await cleanup();
  app.exit(0);
});

app.on('activate', () => {
  if (!mainWindow) createMainWindow();
  else mainWindow.show();
});
