import Gameboy from "serverboy";
import { readFileSync, writeFileSync } from "fs";
import "ws";
import * as path from "path";
import { PNG } from "pngjs";

const colorPalette: { [key: number]: number[] } = {
	0: [255, 238, 218], // white
	1: [5, 11, 21], // black
	2: [172, 0, 41], // red
	3: [0, 133, 131], // blue
	4: [230, 157, 0], // yellow
	6: [125, 162, 36], // green
  };

const gameboy = new Gameboy();
const romName: string = "pokecrystal.gbc"
const romPath: string = path.join(__dirname, "..", "roms", romName);
const rom = readFileSync(romPath)

const WIDTH = 160, HEIGHT = 144

function splitArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

function findClosestColor(target: number[]): number {
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

gameboy.loadRom(rom)

for (let i=0; i < 300; i++) {
	gameboy.doFrame()
}

for (let i=0; i < 20; i++) {
	gameboy.pressKey(Gameboy.KEYMAP.START)
	gameboy.doFrame()
}

for (let i=0; i < 200; i++) {
	gameboy.doFrame()
}

for (let i=0; i < 150; i++) {
	gameboy.pressKey(Gameboy.KEYMAP.START)
	gameboy.doFrame()
}

var pixels = gameboy.getScreen()
var splitPixels: Array<any> = splitArray(pixels, 4)
var lastPixel: Array<any> = splitPixels[splitPixels.length - 1]
console.log(findClosestColor(lastPixel))
console.log(splitPixels.length)

var png = new PNG({ width: 160, height: 144 });
for (let i=0; i<pixels.length; i++) {
   png.data[i] = pixels[i];
}

var buffer = PNG.sync.write(png);
writeFileSync('out.png', buffer);