# Maple Hill screen saver for Windows

`MapleHill-screensaver.html` is the whole Maple Hill scene in one file. It needs no internet connection.
When it runs as a screen saver, it:

- shows the hillside at golden hour, with the sun low behind the CN Tower
- circles the big maple slowly while leaves drift down in a light westerly breeze
- keeps the time, weather and wind fixed, so the view stays the same
- hides every panel, readout and the mouse pointer
- draws about 30 frames a second, to keep fans quiet

Windows can't show a web page as a screen saver by itself. You need
[Lively Wallpaper](https://github.com/rocksdanister/lively), which is free and open source and draws pages with Chromium.

## Set it up

1. **Install Lively Wallpaper** from the Microsoft Store, or from its
   [GitHub releases](https://github.com/rocksdanister/lively/releases).
2. **Copy `MapleHill-screensaver.html`** to a folder that will stay put, such as `Documents\Maple Hill`.
3. **Add it to Lively.** Open Lively and click **Add wallpaper** (the **+** button), or drag the file into the Lively window.
   Choose the file, then select it to make it your wallpaper. Lively runs the scene in its built-in Chromium,
   so 3D works.
4. **Turn on Lively's screen saver.** Download the screen saver file from the
   [Lively wiki](https://github.com/rocksdanister/lively/wiki), extract the zip, then
   right-click `Lively.scr` and choose **Install**. If **Install** doesn't appear, copy the file to `C:\Windows` first.
5. **Pick it in Windows.** In the **Screen Saver Settings** window that opens, choose **Lively**, set how long to wait,
   then click **Apply** and **OK**. You can reopen this window later from
   **Settings → Personalization → Lock screen → Screen saver**.

Lively shows your current wallpaper as the screen saver, so Maple Hill needs to be the selected wallpaper.
Moving the mouse or pressing a key closes it, as with any screen saver.

## Just want to look at it?

Double-click `MapleHill-screensaver.html` to open it in Edge or Chrome, then press **F11** for full screen.

## Rebuilding after changing the scene

The file is generated from `../index.html`. After editing the scene, rebuild it with [Node.js](https://nodejs.org):

```
cd maple-hill/screensaver
npm install
npm run build
```
