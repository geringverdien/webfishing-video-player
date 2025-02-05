import { EnumType } from "typescript";

declare module 'serverboy' {
  class Gameboy {
    constructor();
    loadRom(rom: Buffer, saveData?: Array): void;
    doFrame(): void;
    getSaveData(): Array;
    pressKey(key: KEYMAP): void;
    pressKeys(keys: Array): void;
    getScreen(): Array;
    
  }
  export enum KEYMAP {
    A,
    B,
    START,
    SELECT,
    UP,
    DOWN,
    LEFT,
    RIGHT
  }
  export = Gameboy; // This allows `import * as Gameboy from 'serverboy'`
}