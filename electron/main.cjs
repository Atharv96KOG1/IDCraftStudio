const { app, BrowserWindow, Menu, shell, session, ipcMain, clipboard } = require('electron');
const path = require('path');
const { LicenseManager } = require('./license.cjs');

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isPackaged = app.isPackaged;
const smokeTest = process.argv.includes('--smoke-test');

// One running copy at a time.
if (!smokeTest && !app.requestSingleInstanceLock()) app.quit();

let win = null;
let licenses = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: !smokeTest,
    title: 'IDCraft Studio',
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !isPackaged,
      spellcheck: false,
    },
  });

  if (devServerUrl) win.loadURL(devServerUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // External links open in the user's browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  // The window may only ever show the app itself (blocks drag-and-drop navigation too).
  win.webContents.on('will-navigate', (e, url) => {
    if (devServerUrl && url.startsWith(devServerUrl)) return;
    e.preventDefault();
  });

  // Let the page finish saving before the window closes.
  let canClose = false;
  win.on('close', (e) => {
    if (canClose || smokeTest) return;
    e.preventDefault();
    win.webContents.send('app:flush');
    setTimeout(() => {
      canClose = true;
      win?.close();
    }, 2000);
  });
  ipcMain.removeHandler('app:flushed');
  ipcMain.handle('app:flushed', () => {
    canClose = true;
    win?.close();
  });

  if (smokeTest) {
    // CI check: the packaged app must load, render, and report a licence state.
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const ok = await win.webContents.executeJavaScript(
            "(async () => { const s = await window.idcraft.license.status(); return document.querySelector('#root').children.length > 0 && !!s.state; })()",
          );
          console.log(ok ? 'SMOKE_OK' : 'SMOKE_FAIL');
          app.exit(ok ? 0 : 1);
        } catch (e) {
          console.log('SMOKE_FAIL ' + e);
          app.exit(1);
        }
      }, 4000);
    });
    win.webContents.on('did-fail-load', () => app.exit(1));
  }
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  if (!devServerUrl) Menu.setApplicationMenu(null);
  licenses = new LicenseManager(app.getPath('userData'));

  ipcMain.handle('license:status', () => licenses.status());
  ipcMain.handle('license:activate', (_e, key) => licenses.activate(key));
  ipcMain.handle('license:deactivate', () => licenses.deactivate());
  ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(text));
  ipcMain.handle('app:version', () => app.getVersion());

  // Allowed: camera (ID photos) and reading installed font names.
  const allowed = new Set(['media', 'local-fonts']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
