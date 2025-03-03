# webfishing realtime video player
### loads a video using ytdl and plays it on a canvas in WEBFISHING

### if you would like to show support for developing this fun project check out [my kofi](https://ko-fi.com/quirkycmd) :3

# how to use
#### Prerequisites to be able to follow this guide (only need to be done once):
* Node.js and Yarn are installed on your pc, any steps including yarn can also be done with npm though
* My mod [FinapseX](https://thunderstore.io/c/webfishing/p/TeamFishnet/FinapseX/) is installed, the "websocket" setting was enabled in the "mods" menu and the game was restarted to make the setting change apply
* The [vscode extension](https://github.com/geringverdien/TeamFishnet/raw/refs/heads/main/Finapse%20X/Finapse%20Xecutor/finapse-xecute/finapse-xecute-0.0.1.vsix) for Finapse was installed to run the .gd file from inside vsc
* This repository was cloned to a local directory so that updates to the code can be synced easily
* You ran `yarn install` in the cloned repo's directory to install all necessary packages

#### Usage:
1. Join a lobby
2. Run the **video client handler.gd** script using Finapse. You can already move around the screen if you want to.
3. Change the `videoURL` variable at the top of the TypeScript file to point to a video from a [supported video site](https://github.com/ytdl-org/youtube-dl/blob/master/docs/supportedsites.md):
    ```ts 
    const videoURL: string = "https://www.youtube.com/watch?v=RHuQqLxmEyg"
    ```
4. Run the `yarn start` command. This will create a nodemon session. Saving changes in the `index.ts` will automatically stop the running code and play the entered video from the beginning.
5. The video should now play on the canvas that was spawned underneath you in step 2.

## screen controls
`I, J, K, L` - move screen forwards, left, backwards, right (direction does not change with your character orientation)

`U, O` - move screen down and up

`arrow keys` - rotate screen

`.` - teleport the screen to your current position

## chat commands (only work in local chat)
## NOTE: chalksmod and colorthreshold commands currently dont work

`abort` - deletes the canvase and stops execution fully.

`clear` - clears the screen canvas. mainly used for debugging

~~`chalksmod [true/false/on/off]` - toggles the [Chalks mod](https://thunderstore.io/c/webfishing/p/hostileonion/chalks/) extended color palette~~

~~`colorthreshold [integer]` - changes the accepted distance between colors to be accepted, 4000 is default~~

`getpresets` - prints a list of saved presets

`savepreset [name]` - saves current screen position to preset of `[name]`

`loadpreset [name]` - loads the chosen preset (if it exists)

`deletepreset [name]` - deletes the preset (if it exists)
