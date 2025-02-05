declare module 'serverboy' {
  class Gameboy {
    constructor();
    loadRom(rom: Buffer, saveData?: Array): void;
    doFrame(): void;
  }

  export = Gameboy; // This allows `import * as Gameboy from 'serverboy'`
}