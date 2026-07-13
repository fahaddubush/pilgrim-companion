# Liquid glass UI

The browser UI uses CSS glass surfaces plus the WebGL implementation in `static/glass3d.js`.
`static/app.js` initializes it with `initLiquidGlass({ performance: "auto" })` and registers message
bubbles as they are created. If WebGL is unavailable, the CSS surface remains usable.

To add a surface:

```html
<div class="glassy lg-surface lg-card"
     data-glass-surface="card"
     data-refraction="0.18"
     data-distortion="0.022"></div>
```

Use `data-thickness`, `data-edge`, and `data-tint="r,g,b"` only when the defaults are insufficient.
Keep backgrounds mostly transparent and test `prefers-reduced-motion` and low-power devices. For a
forced lower-resolution render, initialize with `performance: "low"`.
