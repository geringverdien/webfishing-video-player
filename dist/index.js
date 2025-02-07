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
const ws_1 = require("ws");
const pako_1 = require("pako");
const PORT = 24893;
const WIDTH = 160, HEIGHT = 144; // gameboy resolution
const EMULATOR_HZ = 120; // Game Boy logic runs at 120Hz
const FRAMERATE = 60;
const gameboy = new serverboy_1.default();
const romName = "pokemoncrystal.gbc";
const romPath = path.join(__dirname, "..", "roms", romName);
const rom = (0, fs_1.readFileSync)(romPath);
const colorPalette = {
    0: [255, 238, 218], // white
    1: [5, 11, 21], // black
    2: [172, 0, 41], // red
    3: [0, 133, 131], // blue
    4: [230, 157, 0], // yellow
    6: [125, 162, 36], // green
};
let frameCounter = 0;
let shouldRender = false;
var oldPixels = Array(23040);
var keyInputs = [];
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
            //console.log("skipping");
            continue;
        }
        ;
        oldPixels[pixelIndex] = colorPaletteIndex;
        changedPixels.push([x, y, colorPaletteIndex]);
    }
    // Create a binary buffer
    const buffer = new ArrayBuffer(changedPixels.length * 3); // 3 bytes per pixel (x, y, c)
    const view = new Uint8Array(buffer);
    for (let i = 0; i < changedPixels.length; i++) {
        const pixel = changedPixels[i];
        view[i * 3] = pixel[0]; // X-coordinate (1 byte)
        view[i * 3 + 1] = pixel[1]; // Y-coordinate (1 byte)
        view[i * 3 + 2] = pixel[2]; // Color index (1 byte)
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
gameboy.loadRom(rom);
//console.log("skipping 2000 frames...")
//
//for (let i=0; i < 2000; i++) {
//	gameboy.doFrame()
//}
const socket = new ws_1.WebSocket("ws://127.0.0.1:" + PORT.toString());
socket.onopen = () => {
    console.log("WebSocket connection opened");
    const intervalTime = 1000 / FRAMERATE;
    const stepsPerInterval = EMULATOR_HZ / FRAMERATE;
    const frameInterval = setInterval(() => {
        for (let i = 0; i < stepsPerInterval; i++) {
            gameboy.doFrame();
        }
        //if (!shouldRender) { return }
        var frame = gameboy.getScreen();
        var rawBuffer = createDataBuffer(frame);
        var compressedBuffer = (0, pako_1.deflate)(rawBuffer, { raw: false });
        gameboy.pressKeys(keyInputs);
        keyInputs = [];
        if (socket.readyState !== ws_1.WebSocket.OPEN) {
            return;
        }
        //console.log(socketData);
        socket.send(compressedBuffer);
        //shouldRender = false;
    }, intervalTime);
    socket.onmessage = (data) => {
        var message = data.toString();
        console.log("MESSAGE: " + message);
        var splitMessage = message.split("|");
        if (splitMessage[0] == "input") {
            var keyString = splitMessage[1];
            var selectedKey = serverboy_1.default.KEYMAP[keyString];
            console.log(keyString);
            console.log(selectedKey);
            keyInputs.push(selectedKey);
        }
        ;
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
