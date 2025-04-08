import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import Store from 'electron-store';
import { topLeftPosition, bottomRightPosition, algorithmConfig, SolveOnce, SolveInterval } from './algorithm.js';
import Robot from "@hurdlegroup/robotjs";
import path from "path";

const store = new Store();

const storedTopLeftPosition = store.get('topLeftPosition');
const storedBottomRightPosition = store.get('bottomRightPosition');
const storedAlgorithmConfig = store.get('algorithmConfig') || algorithmConfig;

if (storedTopLeftPosition) {
  topLeftPosition.x = storedTopLeftPosition.x;
  topLeftPosition.y = storedTopLeftPosition.y;
}
if (storedBottomRightPosition) {
  bottomRightPosition.x = storedBottomRightPosition.x;
  bottomRightPosition.y = storedBottomRightPosition.y;
}

const createMainWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 750,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.js"),
    },
    icon: './ballinghighres.ico'
  })

  if (app.isPackaged) {
    win.removeMenu();
  }
  
  ipcMain.handle('getTopLeftPosition', async () => {
    //console.log("Top left position: ", topLeftPosition);
    return topLeftPosition;
  });
  ipcMain.handle('getBottomRightPosition', async () => {
    //console.log("bottomRightPosition: ", bottomRightPosition);
    return bottomRightPosition;
  });

  ipcMain.on('setAlgorithmConfig', (event, newAlgorithmConfig) => {
    // console.log("newAlgorithmConfig: ", newAlgorithmConfig);
    algorithmConfig.mouseMoveDelayMs = newAlgorithmConfig.mouseMoveDelayMs;
    algorithmConfig.gridWidth = newAlgorithmConfig.gridWidth;
    algorithmConfig.gridHeight = newAlgorithmConfig.gridHeight;
    store.set('algorithmConfig', newAlgorithmConfig);
  })

  win.webContents.on('did-finish-load', () => {
    algorithmConfig.mouseMoveDelayMs = storedAlgorithmConfig.mouseMoveDelayMs;
    algorithmConfig.gridWidth = storedAlgorithmConfig.gridWidth;
    algorithmConfig.gridHeight = storedAlgorithmConfig.gridHeight;
    win.webContents.send('setAlgorithmConfigToRenderer', algorithmConfig);
  });
  // setTimeout(() => {
  //   win.webContents.send('setMouseMoveDelayToRenderer', storedMouseMoveDelay);
  // }, 4000);


  win.loadFile('./pages/index.html');
}

app.whenReady().then(() => {
  createMainWindow();

  const ret1 = globalShortcut.register('Alt+Q', () => {
    // Set top left corner
    const mousePos = Robot.getMousePos();
    topLeftPosition.x = mousePos.x;
    topLeftPosition.y = mousePos.y;
    store.set('topLeftPosition', topLeftPosition);
  })
  if (!ret1) {
    console.log('registration1 failed');
  }

  const ret2 = globalShortcut.register('Alt+C', () => {
    // Set bottom right corner
    const mousePos = Robot.getMousePos();
    bottomRightPosition.x = mousePos.x;
    bottomRightPosition.y = mousePos.y;
    store.set('bottomRightPosition', bottomRightPosition);
  })
  if (!ret2) {
    console.log('registration2 failed');
  }

  const ret3 = globalShortcut.register('Alt+E', () => {
    // Start solving
    SolveOnce();
  });
  if (!ret3) {
    console.log('registration3 failed');
  }

  const ret4 = globalShortcut.register('Alt+R', () => {
    // Start solving
    SolveInterval(500);
  });
  if (!ret4) {
    console.log('registration4 failed');
  }

})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
})