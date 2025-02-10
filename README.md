# webfishing GB integration
uses serverboy on a websocket backend to send screen data to WEBFISHING which renders it using chalk canvases and sends back input data to the emulator

# how to use
0. clone the repository and open it in an ide, i use Visual Studio Code
1. download my mod FinapseX to run the gameboy.gd script, i recommend also getting the vscode extension for easier use (check the thunderstore page)
2. join a lobby
3. run the gameboy.gd script using finapse
4. make sure you installed all the packages needed for the emulator backend using `yarn install`
5. place a rom you want to load into the "roms" folder in the root directory and change the romName in the TypeScript file to point to the rom's file name.
6. start up the index.ts file using the `yarn start` command, it uses nodemon to live update when making changes to the index file
7. you can now control the screen position using IJKL for sides and UO for down and up, arrow keys to rotate and bring it to you with `.`
8. use the commands `u, d, l, r, a, b, start, select` to control the game. type `save` to create a save state (must be done after saving ingame!). type `abort` to stop the emulator. type `speed [number:int]` to change emulation speed. type `holdtime [number:int]` to change the button hold duration
