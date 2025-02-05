import Gameboy from "serverboy";
import { readFileSync } from "fs";
import "ws";
import * as path from "path";

const gameboy = new Gameboy();
const romName = "pokecrystal.gbc"
const romPath = path.join(__dirname, "..", "roms", romName);
const rom = readFileSync(romPath)

const WIDTH = 160, HEIGHT = 144

gameboy.loadRom(rom)

gameboy.doFrame()
var screencap = gameboy.getScreen()
console.log(screencap);