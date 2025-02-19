declare class Gameboy {
	constructor();
	loadRom(rom: Buffer, saveData?: number[]): void;
	doFrame(): void;
	getSaveData(): number[];
	pressKey(key: KEYMAP): void;
	pressKeys(keys: KEYMAP[]): void;
	getScreen(): number[];
	getAudio(): number[][];
  }
  
  declare enum KEYMAP {
	A,
	B,
	START,
	SELECT,
	UP,
	DOWN,
	LEFT,
	RIGHT,
  }
  
  export default Gameboy; // Default export
  export { KEYMAP }; // Named export