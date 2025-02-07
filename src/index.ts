import Gameboy from "serverboy";
import { readFileSync, writeFileSync } from "fs";
import "ws";
import * as path from "path";
import { PNG } from "pngjs";
import { WebSocket } from "ws";
import {deflate} from "pako"; 

const PORT = 24893
const WIDTH = 160, HEIGHT = 144 // gameboy resolution
const EMULATOR_HZ = 120; // Game Boy logic runs at 120Hz
const FRAMERATE = 60

const gameboy = new Gameboy();
const romName: string = "pokemoncrystal.gbc"
const romPath: string = path.join(__dirname, "..", "roms", romName);
const rom = readFileSync(romPath)

const colorPalette: { [key: number]: number[] } = {
	0: [255, 238, 218], // white
	1: [5, 11, 21], // black
	2: [172, 0, 41], // red
	3: [0, 133, 131], // blue
	4: [230, 157, 0], // yellow
	6: [125, 162, 36], // green
  };

let frameCounter = 0;
let shouldRender = false;
var oldPixels = Array(23040)

var keyInputs: string[] = []

function createDataBuffer(pixelArray: number[]): ArrayBuffer {
    const changedPixels: Array<any> = [];

    for (let i = 0; i < pixelArray.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % WIDTH;
        const y = Math.floor(pixelIndex / WIDTH);

        if (y >= HEIGHT) continue;

        const r = pixelArray[i];
        const g = pixelArray[i + 1];
        const b = pixelArray[i + 2];
        const colorPaletteIndex = findClosestColor([r, g, b]);

        if (oldPixels[pixelIndex] === colorPaletteIndex) {
			//console.log("skipping");
			continue;
		};

        oldPixels[pixelIndex] = colorPaletteIndex;
        changedPixels.push([x, y, colorPaletteIndex]);
    }

    // Create a binary buffer
    const buffer = new ArrayBuffer(changedPixels.length * 3); // 3 bytes per pixel (x, y, c)
    const view = new Uint8Array(buffer);

    for (let i = 0; i < changedPixels.length; i++) {
        const pixel = changedPixels[i];
        view[i * 3] = pixel[0];     // X-coordinate (1 byte)
        view[i * 3 + 1] = pixel[1]; // Y-coordinate (1 byte)
        view[i * 3 + 2] = pixel[2]; // Color index (1 byte)
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

gameboy.loadRom(rom)

//console.log("skipping 2000 frames...")
//
//for (let i=0; i < 2000; i++) {
//	gameboy.doFrame()
//}

const socket = new WebSocket("ws://127.0.0.1:" + PORT.toString());

socket.onopen = () => {
    console.log("WebSocket connection opened");
    const intervalTime = 1000 / FRAMERATE;
    
    const stepsPerInterval = EMULATOR_HZ / FRAMERATE;

    const frameInterval = setInterval(() => {
    	for (let i = 0; i < stepsPerInterval; i++) {
            gameboy.doFrame();
             /**
	 		frameCounter++;
      
             if (frameCounter % 2 === 0) {
                 shouldRender = true;
                 frameCounter = 0;
             }
	 		*/
         }
    
         //if (!shouldRender) { return }
		var frame: number[] = gameboy.getScreen()
		var rawBuffer = createDataBuffer(frame)
		var compressedBuffer = deflate(rawBuffer, { raw: false });
   
		gameboy.pressKeys(keyInputs)
		keyInputs = []
		
        //if (socket.readyState === WebSocket.OPEN) {
	 	//console.log(socketData);
        socket.send(compressedBuffer);
         //}
  
         //shouldRender = false;
    }, intervalTime);

	socket.onmessage = (data) => {
		var message: string = data.toString()
		console.log(message)
		var splitMessage: any[] = message.split("|")
		if (splitMessage[0] == "input") {
			var keyString: any = splitMessage[1]
			var selectedKey = Gameboy.KEYMAP[keyString]
			console.log(keyString)
			console.log(selectedKey)
			keyInputs.push(selectedKey)
		};
	}

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