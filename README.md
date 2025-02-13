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
8. use the commands in local chat to control the emulator

## controls
all commands below except for the regular button commands can only be used by yourself:

`u, d, l, r/up, down, left, right` - dpad 

`a, b, start, select` - self explanatory

`save` - create a save state (must be done after saving ingame!)

`abort` - stops the emulator and deletes the canvases, use the trashcan button in the finapse internal ui to fully clear the script "cache"
  
`speed [integer]` - change emulation speed
  
`holdtime [integer]` - change the button hold duration, 10 is default

`clear` - clears the controller and screen canvas. mainly used for debugging
