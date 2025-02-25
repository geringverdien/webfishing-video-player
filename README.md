# webfishing GB integration
uses serverboy on a websocket backend to send screen data to WEBFISHING which renders it using chalk canvases and sends back input data to the emulator

if you would like to show support for developing this fun project check out [my kofi](https://ko-fi.com/quirkycmd) :3

# how to use
#### Prerequisites to be able to follow this guide (only need to be done once):
* Node.js and Yarn are installed on your pc, any steps including yarn can also be done with npm though
* My mod [FinapseX](https://thunderstore.io/c/webfishing/p/TeamFishnet/FinapseX/) is installed, the "websocket" setting was enabled in the "mods" menu and the game was restarted to make the setting change apply
* The [vscode extension](https://github.com/geringverdien/TeamFishnet/raw/refs/heads/main/Finapse%20X/Finapse%20Xecutor/finapse-xecute/finapse-xecute-0.0.1.vsix) for Finapse was installed to run the .gd file from inside vsc

#### Usage:
1. join a lobby
2. run the gameboy.gd script using finapse. You can already move around the screen if you want to
3. make sure you installed all the packages needed for the emulator backend using `yarn install`
4. place a rom you want to load into the "roms" folder in the root directory and change the romName variable at the top of the TypeScript file to point to the rom's file name (e.g. `const romName: string = "pokemoncrystal.gbc"`).
5. run the `yarn start` command. This will create a nodemon session. Saving changes in the `index.ts` will automatically stop the running code and reboot the emulator
6. the controller image and gameboy screen output should now load on the canvases that were spawned underneath you in step 2

## screen controls
`I, J, K, L` - move screen forwards, left, backwards, right (direction does not change with your character orientation)

`U, O` - move screen down and up

`arrow keys` - rotate screen

`.` - teleport the controller and screen to your current position

## chat commands (only work in local chat)
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

`lockinput true/false/on/off` - disables all input from other players, useful if you want to save progress while people are running over the gamepad
