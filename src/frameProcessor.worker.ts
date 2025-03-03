import { parentPort } from "worker_threads";
import { Jimp } from "jimp";
import { deflate } from "pako";


const WIDTH = 200, HEIGHT = 200;
const pixelsPerBuffer = 150 * 150;
let oldPixels = Array(WIDTH * HEIGHT);
let colorDistanceThreshold = 4000;
type ColorPalette = { [key: string]: number[] };
let usedColorPalette: ColorPalette = {}; // Will be set via message from main thread

parentPort?.on("message", async (message) => {
    switch (message.type) {
        case "init":
            usedColorPalette = message.colorPalette;
            break;
        case "frame":
            try {
                const image = await Jimp.read(Buffer.from(message.frameData));
                const pixelData = image.bitmap.data;
                const dataBuffers = createDataBuffers(Array.from(pixelData));
                parentPort?.postMessage({ type: "frameProcessed", dataBuffers });
            } catch (err) {
                parentPort?.postMessage({ type: "error", error: err });
            }
            break;
        case "updatePalette":
            console.log("UPDATED PALETTE")
            usedColorPalette = message.colorPalette;
            console.log(usedColorPalette)
            break;
        case "updateThreshold":
            colorDistanceThreshold = message.threshold;
            break;
    }
});

function createDataBuffers(pixelArray: number[]): Uint8Array[] {
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

    const buffers: Uint8Array[] = [];
    
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