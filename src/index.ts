import Gameboy from "serverboy";
import { readFileSync, writeFileSync } from "fs";
import "ws";
import * as path from "path";
import { PNG } from "pngjs";

const gameboy = new Gameboy();
const romName = "pokecrystal.gbc"
const romPath = path.join(__dirname, "..", "roms", romName);
const rom = readFileSync(romPath)

const WIDTH = 160, HEIGHT = 144

function splitArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

gameboy.loadRom(rom)

for (let i=0; i < 1800; i++) {
	gameboy.doFrame()
}
//gameboy.pressKey(Gameboy.KEYMAP.START)

var pixels = gameboy.getScreen()
var splitPixels = splitArray(pixels, 4)
console.log(splitPixels[splitPixels.length - 1])

var png = new PNG({ width: 160, height: 144 });
for (let i=0; i<pixels.length; i++) {
   png.data[i] = pixels[i];
}

var buffer = PNG.sync.write(png);
writeFileSync('out.png', buffer);