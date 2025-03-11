import { WebSocket } from "ws";
import path from "path";
import ytdl from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PassThrough } from "stream";
import { Worker } from "worker_threads";

const FRAMERATE = 20; // video target fps, doesnt have to match real video fps
const videoURL: string = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const PORT = 24897;
const WIDTH = 200, HEIGHT = 200; // 200,200 for 1 canvas, 400,400 for 2 canvases

// TODO: make commands actually work, data stream event is blocking the event loop for receiving messages
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


//const __filename = fileURLToPath(__dirname);
//const __dirname = path.dirname(__filename);

var usedColorPalette = useChalksColorPalette ? chalksModColorPalette : vanillaColorPalette;

const socket = new WebSocket("ws://127.0.0.1:" + PORT.toString());
console.log("downloading video...")
const videoStream = ytdl(videoURL, { quality: "lowestvideo" });
console.log("video downloaded")
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const frameStream = new PassThrough();
const frameProcessor = new Worker(path.join(__dirname,"/frameProcessor.worker.ts"));
var frameQueue: ArrayBuffer[][] = [];


ffmpeg(videoStream)
    .on("start", () => console.log("Processing video..."))
    .on("error", (err) => console.error("Error:", err))
    .on("end", () => console.log("Video processing finished."))
    .outputOptions([
        "-preset", "ultrafast",
        "-vf", `fps=${FRAMERATE},scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease`,
        "-r", `${FRAMERATE}`,
        "-f", "image2pipe",
        "-c:v", "png",
    ])
    .output(frameStream)
    .run();
	
	frameProcessor.postMessage({
		type: "init",
		colorPalette: usedColorPalette
	});

	frameProcessor.on("message", (message) => {
		switch (message.type) {
        case "frameProcessed":
            frameQueue.push(message.dataBuffers);
            break;
        case "error":
            console.error("Worker error:", message.error);
            break;
    }
});


let lastSendTime = Date.now();
const SEND_INTERVAL = 1000 / FRAMERATE;
const sendFrame = async () => {
    const now = Date.now();
    if (now - lastSendTime < SEND_INTERVAL) {
        return;
    }

    if (frameQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
        const frame = frameQueue.shift();
        if (!frame) return;

        try {
            for (const buffer of frame) {
                await new Promise<void>((resolve, reject) => {
                    socket.send(buffer, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
            }
            lastSendTime = now;
        } catch (err) {
            console.error("Error sending frame:", err);
        }
    }
};

const tick = () => {
    sendFrame().catch(console.error);
    setTimeout(tick, SEND_INTERVAL / 2);
};

const MAX_BUFFER_SIZE = 10 * 1024 * 1024;
let frameBuffer = Buffer.alloc(MAX_BUFFER_SIZE);

let isProcessing = false;

frameStream.on("data", async (chunk) => {
    try {
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }

        const chunkCopy = Buffer.from(chunk);
        frameBuffer = Buffer.concat([frameBuffer, chunkCopy]);

        while (frameBuffer.includes(Buffer.from("IEND")) && !isProcessing) {
            isProcessing = true;
            const frameEnd = frameBuffer.indexOf(Buffer.from("IEND")) + 8;
            const frame = frameBuffer.subarray(0, frameEnd);
            frameBuffer = frameBuffer.subarray(frameEnd);

            frameProcessor.postMessage({
                type: "frame",
                frameData: frame
            });

            isProcessing = false;
        }
    } catch (err) {
        console.error("Error in frame processing:", err);
        isProcessing = false;
    }
});

frameStream.on("end", () => {
	console.log("Frame stream ended");
});

frameStream.on("error", (err) => {
	console.error("Frame stream error:", err);
});

socket.onopen = () => {
	console.log("WebSocket connection opened");
	tick();
	socket.onmessage = (event) => {
		let message: string = event.data.toString();
		let splitMessage: any[] = message.split("|");
		const command = splitMessage[0];
		const args = splitMessage.slice(1);
		switch (command) {
			case "setchalkmode":
				var useModdedChalk = args[0] === "true";
				usedColorPalette = useModdedChalk ? chalksModColorPalette : vanillaColorPalette;
				frameProcessor.postMessage({
					type: "updatePalette",
					colorPalette: usedColorPalette
				});
				break;
			case "setcolorthreshold":
				var newThreshold = Math.floor(Number(args[0]));
				colorDistanceThreshold = newThreshold;
				frameProcessor.postMessage({
					type: "updateThreshold",
					threshold: newThreshold
				});
				break;
		}
	}

	socket.onclose = () => {
		frameProcessor.terminate();
		console.log("WebSocket connection closed");
	}
}