# webfishing GB integration
uses serverboy on a websocket backend to send screen data to WEBFISHING which renders it using chalk canvases and sends back input data to the emulator

if you would like to show support for developing this fun project check out [my kofi](https://ko-fi.com/quirkycmd) :3

# how to use
0. clone the repository and open it in an ide, i use Visual Studio Code
1. download my mod [FinapseX](https://thunderstore.io/c/webfishing/p/TeamFishnet/FinapseX/) to run the gameboy.gd script, i recommend also getting the [vscode extension](https://github.com/geringverdien/TeamFishnet/raw/refs/heads/main/Finapse%20X/Finapse%20Xecutor/finapse-xecute/finapse-xecute-0.0.1.vsix) for easier use (make sure the websocket option is enabled for Finapse X in TackleBox)
2. join a lobby
3. run the gameboy.gd script using finapse
4. make sure you installed all the packages needed for the emulator backend using `yarn install`
5. place a rom you want to load into the "roms" folder in the root directory and change the romName in the TypeScript file to point to the rom's file name.
6. start up the index.ts file using the `yarn start` command, it uses nodemon to live update when making changes to the index file which lets you quickly reload the emulator
7. you can now control the screen position using IJKL for sides and UO for down and up, arrow keys to rotate and bring it (as well as the controller) to you with `.`
8. use the commands in local chat or the controller on the floor to control the emulator

## controls
all commands below except for the regular button commands can only be used by yourself:

`u, d, l, r/up, down, left, right` - dpad 

`a, b, start, select` - self explanatory

## 

`save` - create a save state (must be done after saving ingame!)

`abort` - stops the emulator, deletes the canvases and deletes the GDScript
  
`speed [integer]` - change emulation speed (only positive integers currently) 
  
`holdtime [integer]` - change the button hold duration, 10 is default

`clear` - clears the controller and screen canvas. mainly used for debugging

`chalksmod [true/false/on/off]` - toggles the [Chalks mod](https://thunderstore.io/c/webfishing/p/hostileonion/chalks/) extended color palette

`colorthreshold [integer]` - changes the accepted distance between colors to be accepted, 4000 is default 

`octave [channel 1-3] [integer]` - offsets the notes on the audio channel in half octave steps, e.g. octave 1 -3 to put more sounds into a listenable range

`audio true/false/on/off` - turns audio on or off

`getpresets` - prints a list of saved presets

`savepreset [name]` - saves current controller and screen positions to preset of `[name]`

`loadpreset [name]` - loads the chosen preset (if it exists)

`deletepreset [name]` - deletes the preset (if it exists)
