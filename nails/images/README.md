# Product photos

Drop your photos in this folder, then point each product at them in `js/designs.js`.
Nothing is required: a product without photos is drawn by the shop itself.

```js
{ id: '01', name: 'Milk Bath', price: 18, /* ...existing fields... */
  photo:     'images/milk-bath-set.jpg',   // the whole set, shown inside the clear case on the wall
  nailImage: 'images/milk-bath-nail.png',  // ONE nail, wrapped onto the 3D nails in the try-on
},
```

## `photo` — the set (wall + open case)

- A top-down photo of the nails laid out, like a product shot of the set in its case.
- Any shape works (it is cropped to fill the case, which is roughly square, about 86 x 92 mm), so keep the nails
  in the middle and leave a little margin. 4:3 or 1:1 and about 1000 px wide is plenty.
- A plain, even background (white or soft grey) looks best. `.jpg`, `.png` or `.webp`.
- It replaces the generated nails on the floor of the case, on the wall and when the case is opened in the try-on.

## `nailImage` — one nail (try-on)

- A single nail photographed (or rendered) straight on, with the **cuticle at the bottom** and the free edge at the top.
- Tall and narrow, e.g. 256 x 512 px or 512 x 1024. Crop tight to the nail so the art fills the picture.
- It is wrapped onto every nail on the hand, and the shape you choose (almond, coffin, ...) trims it. Per-finger
  photos are not supported yet: every finger uses the same image.

## Notes

- Paths are relative to `index.html`. Files in this folder always work. Photos hosted on another website only
  work if that site allows cross-origin image loading (CORS).
- If an image can't be loaded the shop quietly falls back to the generated look and logs a warning in the console.
- Refresh the page after changing files; images are cached by the browser.
