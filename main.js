'use strict';

const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // Drop a saved position that is no longer on any monitor.
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      s.x < a.x + a.width && s.x + s.width > a.x && s.y < a.y + a.height && s.y + s.height > a.y);
    return visible ? s : { width: s.width, height: s.height };
  } catch {
    return {};
  }
}

function createWindow() {
  const st = loadWindowState();
  // Never open larger than the screen, so the default layout fits without scrolling.
  const area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(st.width || 1280, area.width),
    height: Math.min(st.height || 860, area.height),
    x: st.x,
    y: st.y,
    minWidth: 420,
    minHeight: 520,
    title: 'Clock Weather',
    backgroundColor: '#f3f5fa',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (st.maximized) win.maximize();

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('close', () => {
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch { /* not worth failing the close over */ }
  });
}

ipcMain.on('set-always-on-top', (e, on) => {
  BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(!!on);
});

ipcMain.on('open-external', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
