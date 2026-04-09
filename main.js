const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AMI POS - Point of Sale',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });


  // win.loadFile('index.html'); 
  // Use path.join to ensure correct resolution relative to this file
  // First-show -> Boot(second show) -> Login -> POS
  win.loadFile(path.join(__dirname, 'first-show.html'));
  // win.removeMenu(); // uncomment if you want to hide the menu bar
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
