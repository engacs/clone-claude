const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let currentPort = 8082;

// Check if app is in development mode
const isDev = !app.isPackaged;

// Check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port in use
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port free
    });
    server.listen(port, '127.0.0.1');
  });
}

// Find first available port starting from startPort
async function getAvailablePort(startPort) {
  let port = startPort;
  while (port < 65535) {
    const inUse = await checkPort(port);
    if (!inUse) {
      return port;
    }
    port++;
  }
  return startPort;
}

// Start Python backend server in production
async function startBackend() {
  if (isDev) {
    console.log('Running in Development mode - Python server expected to be running via npm run dev script.');
    return;
  }

  currentPort = await getAvailablePort(8082);
  console.log(`Starting backend server on port: ${currentPort}`);

  // Resolve PyInstaller executable path outside ASAR archive
  const binaryPath = path.join(process.resourcesPath, 'binaries', 'fcc-server');

  backendProcess = spawn(binaryPath, [], {
    env: {
      ...process.env,
      PORT: currentPort.toString(),
      HOST: '127.0.0.1'
    }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Python OUT]: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Python ERR]: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mNkYPj/HwWUTg0EABJ7Az97491BAAAAAElFTkSuQmCC'
  );
  tray = new Tray(icon);

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: `Proxy: Running on port ${currentPort}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Open Admin UI',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      {
        label: 'Restart Proxy Server',
        click: async () => {
          if (backendProcess) {
            backendProcess.kill();
            await startBackend();
          }
        },
        enabled: !isDev
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateMenu();
  tray.setToolTip('iXali AI Proxy');
}

function createAppMenu() {
  const { dialog } = require('electron');

  const template = [
    {
      label: 'iXali AI',
      submenu: [
        {
          label: 'About iXali AI',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About iXali AI',
              message: 'iXali AI',
              detail: `Version: 2.3.15\n\nAn advanced native macOS proxy controller and model routing admin panel for coding agents.\n\nCreated by Abdisalam Nor (engacs).\nLicensed under MIT.`,
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Admin',
      submenu: [
        {
          label: 'Open Admin UI',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            } else {
              createWindow();
            }
          }
        },
        {
          label: 'Restart Proxy Server',
          accelerator: 'CmdOrCtrl+R',
          click: async () => {
            if (backendProcess) {
              backendProcess.kill();
              await startBackend();
            }
          },
          enabled: !isDev
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false, // Frameless design
    titleBarStyle: 'hiddenInset', // macOS traffic lights overlay
    vibrancy: 'under-window', // macOS translucency effect
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Redirect to the dynamic local Admin UI port
  const localUrl = `http://localhost:${currentPort}/admin`;
  mainWindow.loadURL(localUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // If in dev mode, we default to 8082
  if (isDev) {
    currentPort = 8082;
  }

  await startBackend();
  createTray();
  createAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clean up and kill python processes on exit
app.on('will-quit', () => {
  if (backendProcess) {
    console.log('Terminating Python server process...');
    backendProcess.kill('SIGINT');
  }
});

app.on('window-all-closed', () => {
  // Keep app active in status bar menu if on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
