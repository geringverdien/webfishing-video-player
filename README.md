# webfishing GB integration
uses serverboy on a websocket backend to send screen data to WEBFISHING which renders it using chalk canvases and sends back input data to the emulator

# how to use
0. clone the repository and open it in an ide, i use Visual Studio Code
1. download my mod FinapseX to run the gameboy.gd script, i recommend also getting the vscode extension for easier use (check the thunderstore page)
2. join a lobby
3. run the gameboy.gd script using finapse
4. make sure you installed all the packages needed for the emulator backend
5. place a rom you want to load into a "roms" folder in the root directory and change the romName in the TypeScript file to point to the rom's file name.
6. start up the index.ts file using the yarn run start command, it uses nodemon to live update when making changes to the index file
7. you can now control the screen position using IJKL, arrow keys and bring it to you with `.` 