import Gameboy from "serverboy";
import { readFileSync, writeFileSync, existsSync } from "fs";
import "ws";
import * as path from "path";
import { PNG } from "pngjs";
import { WebSocket } from "ws";
import {deflate} from "pako"; 


const romName: string = "pokemoncrystal.gbc";
const PORT = 24893;
const WIDTH = 160, HEIGHT = 144; // gameboy resolution
const EMULATOR_HZ = 120; // emulator runs at 120 refresh rate
const FRAMERATE = 30; // gameboy runs at ~60 fps
let inputHoldTime = 10;
let gameSpeed = 1; // use ingame command "speed num" to speed up, must be integer

const gameboy = new Gameboy();
const romPath: string = path.join(__dirname, "..", "roms", romName);
const savePath: string = path.join(__dirname, "..", "saves", romName + ".sav")
const controllerPath: string = path.join(__dirname, "..", "controller.png")
const rom = readFileSync(romPath);
const controllerImage = readFileSync(controllerPath)
let saveData = null

if (existsSync(savePath)) {
	saveData = getSaveFile();
}

const colorPalette: { [key: number]: number[] } = {
	0: [255, 238, 218], // white
	1: [5, 11, 21], // black
	2: [172, 0, 41], // red
	3: [0, 133, 131], // blue
	4: [230, 157, 0], // yellow
	6: [125, 162, 36], // green
}

type keyStates = {
	[key: string]: [number, boolean];
};

let keyStates: keyStates = {
	"UP": [0, false],
	"DOWN": [0, false],
	"LEFT": [0, false],
	"RIGHT": [0, false],
	"B": [0, false],
	"A": [0, false],
	"START": [0, false],
	"SELECT": [0, false]
}

let oldPixels = Array(23040);


function createDataBuffer(pixelArray: number[]): ArrayBuffer {
	const changedPixels: Array<any> = [];

	for (let i = 0; i < pixelArray.length; i += 4) {
		const pixelIndex = i / 4;
		const x = pixelIndex % WIDTH;
		const y = Math.floor(pixelIndex / WIDTH);

		//if (y >= HEIGHT) continue;

		const r = pixelArray[i];
		const g = pixelArray[i + 1];
		const b = pixelArray[i + 2];
		const a = pixelArray[i + 3];
		if (a === 0) { 
			continue 
		};
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
		view[i * 3] = pixel[0];     // x
		view[i * 3 + 1] = pixel[1]; // y
		view[i * 3 + 2] = pixel[2]; // color
	}

	return buffer;
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

function getPressedKeys(): number[] {
	const currentlyPressed: number[] = [];

	for (const [keyName, keyData] of Object.entries(keyStates)) {
		const framesRemaining = keyData[0]
		const isHeldDown = keyData[1]
		const hasZeroTicks = framesRemaining === 0
		if (hasZeroTicks && isHeldDown === false) {
			continue;
		}
		
		if (!hasZeroTicks) {
			keyStates[keyName][0] -= 1;
		}
		
		const key = keyName as keyof typeof Gameboy.KEYMAP;

		currentlyPressed.push(Gameboy.KEYMAP[key]);
	}
	if (currentlyPressed.length > 0) {console.log(currentlyPressed) };
	return currentlyPressed;
}

function sramToBuffer(integers: number[]): Buffer {
	const buffer = Buffer.alloc(integers.length * 4);

	for (let i = 0; i < integers.length; i++) {
		buffer.writeInt32BE(integers[i], i * 4);
	}

	return buffer;
}

function saveSRAM(integers: number[]): void {
	const buffer = sramToBuffer(integers);
	writeFileSync(savePath, buffer);
}

function bufferToIntegers(buffer: Buffer): number[] {
	const integers: number[] = [];

	for (let i = 0; i < buffer.length; i += 4) {
		const integer = buffer.readInt32BE(i);
		integers.push(integer);
	}

	return integers;
}

function getSaveFile(): number[] {
	const buffer = readFileSync(savePath);
	return bufferToIntegers(buffer);
}

function storeSaveData() {
	const sram = gameboy.getSaveData()
	saveSRAM(sram)
}

function createControllerPixelBuffer(pixelArray: number[]): ArrayBuffer {
	const changedPixels: Array<any> = [];

	for (let i = 0; i < pixelArray.length; i += 4) {
		const pixelIndex = i / 4;
		const x = pixelIndex % 200;
		const y = Math.floor(pixelIndex / 200);

		//if (y >= HEIGHT) continue;

		const r = pixelArray[i];
		const g = pixelArray[i + 1];
		const b = pixelArray[i + 2];
		const a = pixelArray[i + 3];
		if (a === 0) { 
			continue 
		};
		const colorPaletteIndex = findClosestColor([r, g, b]);
		changedPixels.push([x, y, colorPaletteIndex]);
	}

	const buffer = new ArrayBuffer(changedPixels.length * 3);
	const view = new Uint8Array(buffer);

	for (let i = 0; i < changedPixels.length; i++) {
		const pixel = changedPixels[i];
		view[i * 3] = pixel[0];     // x
		view[i * 3 + 1] = pixel[1]; // y
		view[i * 3 + 2] = pixel[2]; // color
	}

	return buffer;
}

function createControllerBuffer(): ArrayBuffer {
	const imageDataBuffer = PNG.sync.read(controllerImage).data;
	const imageDataArray = Buffer.from(imageDataBuffer).toJSON().data;
	const buffer = createControllerPixelBuffer(imageDataArray);
	console.log(buffer.byteLength)
	const compressedControllerBuffer = deflate(buffer, { raw: false });
	return compressedControllerBuffer;
}

const socket = new WebSocket("ws://127.0.0.1:" + PORT.toString());

gameboy.loadRom(rom, saveData)

socket.onopen = () => {
	console.log("WebSocket connection opened");
	const intervalTime = 1000 / FRAMERATE;
	
	const stepsPerInterval = EMULATOR_HZ / FRAMERATE;
	let frameCount = 0

	const controllerData = createControllerBuffer();
	socket.send(controllerData);


	const frameInterval = setInterval(() => {
		for (let i = 0; i < (stepsPerInterval * gameSpeed); i++) {
			gameboy.pressKeys(getPressedKeys());
			gameboy.doFrame();
		}

		const frame: number[] = gameboy.getScreen();
		const rawBuffer = createDataBuffer(frame);
		const compressedBuffer = deflate(rawBuffer, { raw: false });
   
		
		if (socket.readyState !== WebSocket.OPEN) { return }
		socket.send(compressedBuffer);
  
	}, intervalTime);

	socket.onmessage = (event) => {
		let message: string = event.data.toString();
		console.log("MESSAGE: " + message);
		let splitMessage: any[] = message.split("|");
		const command = splitMessage[0];
		console.log(command);
		const args = splitMessage.slice(1);
		switch (command) {
			case "input":
				var keyString: any = args[0];
				keyStates[keyString][0] = inputHoldTime;
				break;
			case "keydown":
				var keyString: any = args[0];
				keyStates[keyString][1] = true;
				break;
			case "keyup":
				var keyString: any = args[0];
				keyStates[keyString][1] = false;
				break;
			case "savegame":
				console.log("saving state");
				storeSaveData();
				break;
			case "setspeed":
				var newSpeed = Math.floor(Number(args[0]));
				console.log(`set speed to ${newSpeed}`);
				gameSpeed = newSpeed;
				break;
			case "setholdtime":
				var newHoldTime = Math.floor(Number(args[0]));
				inputHoldTime = newHoldTime;
				break;
		}
	}

	socket.onclose = () => {
		clearInterval(frameInterval);
		console.log("WebSocket connection closed");
	}


}

/**

let pixels = gameboy.getScreen()

let png = new PNG({ width: 160, height: 144 });

for (let i=0; i < 50; i++) {
	gameboy.doFrame()
}

for (let i=0; i<pixels.length; i++) {
   png.data[i] = pixels[i];
}

let buffer = PNG.sync.write(png);
writeFileSync("out.png", buffer);
*/