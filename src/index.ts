import { readFileSync, writeFileSync, existsSync } from "fs";
import "ws";
import * as path from "path";
import { PNG } from "pngjs";
import { WebSocket } from "ws";
import { deflate } from "pako"; 
import ytdl from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Jimp} from "jimp";
import { PassThrough } from "stream"
import { parentPort } from 'worker_threads';

const FRAMERATE = 30; // video target fps, doesnt have to match real video fps
const videoURL: string = "https://www.youtube.com/watch?v=RHuQqLxmEyg";

const PORT = 24897;
const WIDTH = 200, HEIGHT = 200; // 1 canvas

const pixelsPerBuffer = 100*100; // if amount of pixels per frame surpasses this, split it into a separate buffer
const useChalksColorPalette = false // toggled ingame using "chalksmod true/false/on/off", causes the fps to drop drastically
let colorDistanceThreshold = 4000; // use ingame command "colorthreshold num" to change, helps with low fps when using Chalks colors while sacrificing color accuracy

const vanillaColorPalette: { [key: number]: number[] } = {
	0: [255, 238, 218], // white
	1: [5, 11, 21], // black
	2: [172, 0, 41], // red
	3: [0, 133, 131], // blue
	4: [230, 157, 0], // yellow
	6: [125, 162, 36], // green
}

const chalksModColorPalette: { [key: number]: [number, number, number] } = {
	0: [255, 238, 218], // white
	1: [5, 11, 21], // black
	2: [172, 0, 41], // red
	3: [0, 133, 131], // blue
	4: [230, 157, 0], // yellow
	6: [125, 162, 36], // green
    7: [163, 178, 210],
    8: [214, 206, 194],
    9: [191, 222, 216],
    10: [169, 196, 132],
    11: [93, 147, 123],
    12: [162, 166, 169],
    13: [119, 127, 143],
    14: [234, 178, 129],
    15: [234, 114, 134],
    16: [244, 164, 191],
    17: [160, 124, 167],
    18: [191, 121, 109],
    19: [245, 209, 182],
    20: [227, 225, 159],
    21: [255, 223, 0],
    22: [255, 191, 0],
    23: [196, 180, 84],
    24: [245, 222, 179],
    25: [244, 196, 48],
    26: [0, 255, 255],
    27: [137, 207, 240],
    28: [77, 77, 255],
    29: [0, 0, 139],
    30: [65, 105, 225],
    31: [0, 103, 66],
    32: [76, 187, 23],
    33: [46, 111, 64],
    34: [46, 139, 87],
    35: [192, 192, 192],
    36: [129, 133, 137],
    37: [137, 148, 153],
    38: [112, 128, 144],
    39: [255, 165, 0],
    40: [255, 140, 0],
    41: [215, 148, 45],
    42: [255, 95, 31],
    43: [204, 119, 34],
    44: [255, 105, 180],
    45: [255, 16, 240],
    46: [170, 51, 106],
    47: [244, 180, 196],
    48: [149, 53, 83],
    49: [216, 191, 216],
    50: [127, 0, 255],
    51: [128, 0, 128],
    52: [255, 36, 0],
    53: [255, 68, 51],
    54: [165, 42, 42],
    55: [145, 56, 49],
    56: [255, 0, 0],
    57: [59, 34, 25],
    58: [161, 110, 75],
    59: [212, 170, 120],
    60: [230, 188, 152],
    61: [255, 231, 209]
};

var usedColorPalette = useChalksColorPalette ? chalksModColorPalette : vanillaColorPalette;

let oldPixels = Array(WIDTH*HEIGHT);

console.log("downloading video...")
const videoStream = ytdl(videoURL, { quality: "lowestvideo" });
console.log("video downloaded")
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const frameStream = new PassThrough();

ffmpeg(videoStream)
    .on("start", () => console.log("Processing video..."))
    .on("error", (err) => console.error("Error:", err))
    .on("end", () => console.log("Video processing finished."))
    .outputOptions([
        "-preset", "ultrafast",
        "-vf", `fps=${FRAMERATE},scale=200:200:force_original_aspect_ratio=decrease`, // Process fewer frames but maintain timing
        "-r", `${FRAMERATE}`, // Set output framerate
        "-f", "image2pipe",
        "-c:v", "png",
    ])
    .output(frameStream) // Pipe frames to the PassThrough stream
    .run();

function createDataBuffers(pixelArray: number[]): ArrayBuffer[] {
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

	const buffers: ArrayBuffer[] = [];
	
	// First buffer (up to 22500 pixels)
	const firstBufferSize = Math.min(changedPixels.length, pixelsPerBuffer);
	const buffer1 = new ArrayBuffer(firstBufferSize * 3);
	const view1 = new Uint8Array(buffer1);
	
	for (let i = 0; i < firstBufferSize; i++) {
		const pixel = changedPixels[i];
		view1[i * 3] = pixel[0];     // x
		view1[i * 3 + 1] = pixel[1]; // y
		view1[i * 3 + 2] = pixel[2]; // color
	}

	const compressedBuffer1 = deflate(buffer1, { raw: false });
	buffers.push(compressedBuffer1);
	
	if (changedPixels.length > pixelsPerBuffer) {
		const remainingPixels = changedPixels.length - pixelsPerBuffer;
		const buffer2 = new ArrayBuffer(remainingPixels * 3);
		const view2 = new Uint8Array(buffer2);
		
		for (let i = 0; i < remainingPixels; i++) {
			const pixel = changedPixels[pixelsPerBuffer + i];
			view2[i * 3] = pixel[0];     // x
			view2[i * 3 + 1] = pixel[1]; // y
			view2[i * 3 + 2] = pixel[2]; // color
		}

		const compressedBuffer2 = deflate(buffer2, { raw: false });
		buffers.push(compressedBuffer2);
	}
	
	return buffers;
}

function findClosestColor(target: number[]): number {
	let minDistance = Infinity;
	let closestKey = 0;

	for (const [key, color] of Object.entries(usedColorPalette)) {
	  	const dr = target[0] - color[0];
	  	const dg = target[1] - color[1];
	  	const db = target[2] - color[2];
	  	const distanceSq = dr * dr + dg * dg + db * db;

		if (distanceSq < colorDistanceThreshold) {
			return Number(key);
		}

	  	if (distanceSq < minDistance) {
			minDistance = distanceSq;
			closestKey = Number(key);
		}
	}

	return closestKey;
}

const socket = new WebSocket("ws://127.0.0.1:" + PORT.toString());

var frameQueue: ArrayBuffer[][] = [];

setInterval(() => {
	if (frameQueue.length > 1 && socket.readyState === WebSocket.OPEN) {
		const frame = frameQueue.shift();
		if (frame === undefined) { return }

		console.log(`Sending frame with ${frame.length} buffers`);
		for (const buffer of frame) {
			socket.send(buffer);
		}
	}
}, 1000 / FRAMERATE);

const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB example limit
let frameBuffer = Buffer.alloc(MAX_BUFFER_SIZE);

let isProcessing = false;
let frameCount = 0;

frameStream.on("data", async (chunk) => {
	try {
		if (socket.readyState !== WebSocket.OPEN) { 
			return;
		}

		//console.log(`Received chunk of size: ${chunk.length}`);
		
		const chunkCopy = Buffer.from(chunk);
		frameBuffer = Buffer.concat([frameBuffer, chunkCopy]);

		//console.log(`Current frame buffer size: ${frameBuffer.length}`);

		while (frameBuffer.includes(Buffer.from("IEND")) && !isProcessing) {
			isProcessing = true;
			const frameEnd = frameBuffer.indexOf(Buffer.from("IEND")) + 8;
			const frame = frameBuffer.subarray(0, frameEnd);
			frameBuffer = frameBuffer.subarray(frameEnd);

			console.log(`Processing frame ${++frameCount}`);

			try {
				const image = await Jimp.read(Buffer.from(frame));
				const pixelData = image.bitmap.data;

				const dataBuffers = createDataBuffers(Array.from(pixelData));
				frameQueue.push(dataBuffers);
				
			} catch (err) {
				console.error("Error processing frame:", err);
			} finally {
				isProcessing = false;
			}
		}
	} catch (err) {
		console.error("Error in frame processing:", err);
		isProcessing = false;
	}
});

frameStream.on("end", () => {
	console.log("Frame stream ended");
	console.log(`frame amount: ${frameQueue.length}`);
});

frameStream.on("error", (err) => {
	console.error("Frame stream error:", err);
});

socket.onopen = () => {
	console.log("WebSocket connection opened");
	socket.onmessage = (event) => {
		let message: string = event.data.toString();
		console.log("MESSAGE: " + message);
		let splitMessage: any[] = message.split("|");
		const command = splitMessage[0];
		console.log(command);
		const args = splitMessage.slice(1);
		switch (command) {
			case "setchalkmode":
				var useModdedChalk = args[0] === "true";
				usedColorPalette = useModdedChalk ? chalksModColorPalette : vanillaColorPalette;
				break;
			case "setcolorthreshold":
				var newThreshold = Math.floor(Number(args[0]));
				colorDistanceThreshold = newThreshold;
				break;
		}
	}

	socket.onclose = () => {
		//clearInterval(frameInterval);
		console.log("WebSocket connection closed");
	};
}
