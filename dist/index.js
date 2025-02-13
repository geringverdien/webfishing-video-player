"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const serverboy_1 = __importDefault(require("serverboy"));
const fs_1 = require("fs");
require("ws");
const path = __importStar(require("path"));
//import { PNG } from "pngjs";
const ws_1 = require("ws");
const pako_1 = require("pako");
const PORT = 24893;
const WIDTH = 160, HEIGHT = 144; // gameboy resolution
const EMULATOR_HZ = 120; // emulator runs at 120 refresh rate
const FRAMERATE = 30; // gameboy runs at ~60 fps
var inputHoldTime = 10;
var gameSpeed = 1; // use ingame command "speed num" to speed up, must be integer
const gameboy = new serverboy_1.default();
const romName = "doom_demo.gbc";
const romPath = path.join(__dirname, "..", "roms", romName);
const savePath = path.join(__dirname, "..", "saves", romName + ".sav");
const rom = (0, fs_1.readFileSync)(romPath);
var saveData = null;
if ((0, fs_1.existsSync)(savePath)) {
    saveData = getSaveFile();
}
const colorPalette = {
    0: [255, 238, 218], // white
    1: [5, 11, 21], // black
    2: [172, 0, 41], // red
    3: [0, 133, 131], // blue
    4: [230, 157, 0], // yellow
    6: [125, 162, 36], // green
};
var keyStates = {
    "UP": 0,
    "DOWN": 0,
    "LEFT": 0,
    "RIGHT": 0,
    "B": 0,
    "A": 0,
    "START": 0,
    "SELECT": 0
};
var oldPixels = Array(23040);
function createDataBuffer(pixelArray) {
    const changedPixels = [];
    for (let i = 0; i < pixelArray.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % WIDTH;
        const y = Math.floor(pixelIndex / WIDTH);
        if (y >= HEIGHT)
            continue;
        const r = pixelArray[i];
        const g = pixelArray[i + 1];
        const b = pixelArray[i + 2];
        const colorPaletteIndex = findClosestColor([r, g, b]);
        if (oldPixels[pixelIndex] === colorPaletteIndex) {
            continue;
        }
        oldPixels[pixelIndex] = colorPaletteIndex;
        changedPixels.push([x, y, colorPaletteIndex]);
    }
    const buffer = new ArrayBuffer(changedPixels.length * 3);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < changedPixels.length; i++) {
        const pixel = changedPixels[i];
        view[i * 3] = pixel[0]; // x
        view[i * 3 + 1] = pixel[1]; // y
        view[i * 3 + 2] = pixel[2]; // color
    }
    return buffer;
}
function findClosestColor(target) {
    let minDistance = Infinity;
    let closestKey = 0;
    for (const [key, color] of Object.entries(colorPalette)) {
        const dr = target[0] - color[0];
        const dg = target[1] - color[1];
        const db = target[2] - color[2];
        const distanceSq = dr * dr + dg * dg + db * db;
        if (distanceSq < minDistance) {
            minDistance = distanceSq;
            closestKey = Number(key);
        }
    }
    return closestKey;
}
function getPressedKeys() {
    const currentlyPressed = [];
    for (const [keyName, framesRemaining] of Object.entries(keyStates)) {
        if (framesRemaining === 0) {
            continue;
        }
        keyStates[keyName] -= 1;
        const key = keyName;
        currentlyPressed.push(serverboy_1.default.KEYMAP[key]);
    }
    if (currentlyPressed.length > 0) {
        console.log(currentlyPressed);
    }
    ;
    return currentlyPressed;
}
function sramToBuffer(integers) {
    const buffer = Buffer.alloc(integers.length * 4);
    for (let i = 0; i < integers.length; i++) {
        buffer.writeInt32BE(integers[i], i * 4);
    }
    return buffer;
}
function saveSRAM(integers) {
    const buffer = sramToBuffer(integers);
    (0, fs_1.writeFileSync)(savePath, buffer);
}
function bufferToIntegers(buffer) {
    const integers = [];
    for (let i = 0; i < buffer.length; i += 4) {
        const integer = buffer.readInt32BE(i);
        integers.push(integer);
    }
    return integers;
}
function getSaveFile() {
    const buffer = (0, fs_1.readFileSync)(savePath);
    return bufferToIntegers(buffer);
}
function storeSaveData() {
    var sram = gameboy.getSaveData();
    saveSRAM(sram);
}
gameboy.loadRom(rom, saveData);
const socket = new ws_1.WebSocket("ws://127.0.0.1:" + PORT.toString());
socket.onopen = () => {
    console.log("WebSocket connection opened");
    const intervalTime = 1000 / FRAMERATE;
    const stepsPerInterval = EMULATOR_HZ / FRAMERATE;
    var frameCount = 0;
    const frameInterval = setInterval(() => {
        for (let i = 0; i < (stepsPerInterval * gameSpeed); i++) {
            gameboy.pressKeys(getPressedKeys());
            gameboy.doFrame();
        }
        var frame = gameboy.getScreen();
        var rawBuffer = createDataBuffer(frame);
        var compressedBuffer = (0, pako_1.deflate)(rawBuffer, { raw: false });
        if (socket.readyState !== ws_1.WebSocket.OPEN) {
            return;
        }
        socket.send(compressedBuffer);
    }, intervalTime);
    socket.onmessage = (event) => {
        var message = event.data.toString();
        console.log("MESSAGE: " + message);
        var splitMessage = message.split("|");
        const command = splitMessage[0];
        console.log(command);
        const args = splitMessage.slice(1);
        switch (command) {
            case "input":
                var keyString = args[0];
                keyStates[keyString] = inputHoldTime;
                break;
            case "savegame":
                console.log("saving state");
                storeSaveData();
                break;
            case "setspeed":
                const newSpeed = Math.floor(Number(args[0]));
                console.log(`set speed to ${newSpeed}`);
                gameSpeed = newSpeed;
                break;
            case "setholdtime":
                const newHoldTime = Math.floor(Number(args[0]));
                inputHoldTime = newHoldTime;
                break;
        }
    };
    socket.onclose = () => {
        clearInterval(frameInterval);
        console.log("WebSocket connection closed");
    };
};
/**

var pixels = gameboy.getScreen()

var png = new PNG({ width: 160, height: 144 });

for (let i=0; i < 50; i++) {
    gameboy.doFrame()
}

for (let i=0; i<pixels.length; i++) {
   png.data[i] = pixels[i];
}

var buffer = PNG.sync.write(png);
writeFileSync("out.png", buffer);
*/ 
