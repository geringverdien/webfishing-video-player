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
const pngjs_1 = require("pngjs");
const colorPalette = {
    0: [255, 238, 218], // white
    1: [5, 11, 21], // black
    2: [172, 0, 41], // red
    3: [0, 133, 131], // blue
    4: [230, 157, 0], // yellow
    6: [125, 162, 36], // green
};
const gameboy = new serverboy_1.default();
const romName = "pokecrystal.gbc";
const romPath = path.join(__dirname, "..", "roms", romName);
const rom = (0, fs_1.readFileSync)(romPath);
const WIDTH = 160, HEIGHT = 144;
var oldPixels = Array(23040);
function createDataString(pixelArray) {
    let result = "";
    for (let i = 0; i < pixelArray.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % WIDTH;
        const y = Math.floor(pixelIndex / WIDTH);
        if (y >= HEIGHT) {
            continue;
        }
        ;
        const r = pixelArray[i];
        const g = pixelArray[i + 1];
        const b = pixelArray[i + 2];
        const colorPaletteIndex = findClosestColor([r, g, b]);
        if (oldPixels[pixelIndex] == colorPaletteIndex) {
            continue;
        }
        oldPixels[pixelIndex] = colorPaletteIndex;
        result += `${x},${y},${colorPaletteIndex}|`;
    }
    return result.slice(0, -1);
}
function splitArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
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
for (let i = 0; i < 300; i++) {
    gameboy.doFrame();
}
for (let i = 0; i < 20; i++) {
    gameboy.pressKey(serverboy_1.default.KEYMAP.START);
    gameboy.doFrame();
}
for (let i = 0; i < 200; i++) {
    gameboy.doFrame();
}
for (let i = 0; i < 150; i++) {
    gameboy.pressKey(serverboy_1.default.KEYMAP.START);
    gameboy.doFrame();
}
var pixels = gameboy.getScreen();
var data = createDataString(pixels);
var splitPixels = splitArray(pixels, 4);
var lastPixel = splitPixels[splitPixels.length - 1];
console.log(data.split("|").length);
console.log(findClosestColor(lastPixel));
console.log(pixels.length);
var png = new pngjs_1.PNG({ width: 160, height: 144 });
for (let i = 0; i < 50; i++) {
    gameboy.doFrame();
}
var newData = createDataString(gameboy.getScreen());
console.log(newData.split("|").length);
for (let i = 0; i < pixels.length; i++) {
    png.data[i] = pixels[i];
}
var buffer = pngjs_1.PNG.sync.write(png);
(0, fs_1.writeFileSync)('out.png', buffer);
