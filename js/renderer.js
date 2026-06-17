var fiberAngleWarpLUT = new Float32Array(40);
var fiberAngleWeftLUT = new Float32Array(40);
for (var i = 0; i < 40; i++) {
    fiberAngleWarpLUT[i] = Math.sin(i * (Math.PI / 20));
    fiberAngleWeftLUT[i] = Math.sin(i * (Math.PI / 20));
}

var sinNoiseLUT = new Float32Array(1000);
for (var i = 0; i < 1000; i++) {
    sinNoiseLUT[i] = Math.sin(i * 1.5) * 1.5;
}

function drawTartan(canvas, warpPattern, weftPattern, useTexture, options) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var warpLen = warpPattern.length;
    var weftLen = weftPattern.length;
    var img = ctx.createImageData(w, h);
    var data = img.data;

    var density = options && options.pixelScale ? options.pixelScale : 1;
    var style = options && options.style ? options.style : "fill";

    var scale;
    if (style === "tile") {
        scale = Math.max(1, Math.round(5 / density)) || 1;
    } else {
        var baseScale =
            Math.max(
                1,
                Math.floor(Math.min(w, h) / Math.max(warpLen, weftLen) / 2) * 2,
            ) || 1;
        scale = baseScale;
    }

    var mixTop = 0.88;
    var mixBot = 0.12;

    var effectivePxPerThread = scale / density;
    var useBump = useTexture && effectivePxPerThread > 2.5;

    for (var py = 0; py < h; py++) {
        for (var px = 0; px < w; px++) {
            var absX = Math.floor((px * density) / scale);
            var absY = Math.floor((py * density) / scale);

            var xi = absX % warpLen;
            var yi = absY % weftLen;
            if (xi < 0) xi += warpLen;
            if (yi < 0) yi += weftLen;

            var warpOnTop = (absX + absY) % 4 < 2;

            var warpColor = warpPattern[xi];
            var weftColor = weftPattern[yi];

            var r, g, b;
            if (warpOnTop) {
                r = warpColor[0] * mixTop + weftColor[0] * mixBot;
                g = warpColor[1] * mixTop + weftColor[1] * mixBot;
                b = warpColor[2] * mixTop + weftColor[2] * mixBot;
            } else {
                r = weftColor[0] * mixTop + warpColor[0] * mixBot;
                g = weftColor[1] * mixTop + warpColor[1] * mixBot;
                b = weftColor[2] * mixTop + warpColor[2] * mixBot;
            }

            if (useBump) {
                var threadX = ((px * density) / scale) % 1;
                var threadY = ((py * density) / scale) % 1;
                if (threadX < 0) threadX += 1;
                if (threadY < 0) threadY += 1;

                var edgeShadow = 1.0;
                var edgeDist = warpOnTop
                    ? Math.min(threadX, 1.0 - threadX)
                    : Math.min(threadY, 1.0 - threadY);
                if (edgeDist < 0.15) {
                    edgeShadow = 0.8 + (edgeDist / 0.15) * 0.2;
                }

                var bump = warpOnTop
                    ? 60 * threadX * (1.0 - threadX) - 4
                    : 60 * threadY * (1.0 - threadY) - 4;

                var fIdx;
                if (warpOnTop) {
                    fIdx = (px * 8 + py * 4) % 40;
                    if (fIdx < 0) fIdx += 40;
                    var fiberAngle = fiberAngleWarpLUT[fIdx];
                } else {
                    fIdx = (px * 4 - py * 8) % 40;
                    if (fIdx < 0) fIdx += 40;
                    var fiberAngle = fiberAngleWeftLUT[fIdx];
                }

                var noiseIdx = (px - py) % 1000;
                if (noiseIdx < 0) noiseIdx += 1000;
                var fiber = fiberAngle * 3.5 + sinNoiseLUT[noiseIdx];

                r = clamp(r * edgeShadow + bump + fiber);
                g = clamp(g * edgeShadow + bump + fiber);
                b = clamp(b * edgeShadow + bump + fiber);
            }

            var i = (py * w + px) * 4;
            data[i] = r | 0;
            data[i + 1] = g | 0;
            data[i + 2] = b | 0;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
}

function drawWallpaper(canvas, warpPattern, weftPattern, useTexture, options) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var mode = options.mode || "fill";
    var density = options.pixelScale || 1;
    var vignetteVal =
        options.vignette !== undefined ? parseFloat(options.vignette) : 0.4;
    var avg = getAverageColor(warpPattern);

    ctx.clearRect(0, 0, w, h);

    drawTartan(canvas, warpPattern, weftPattern, useTexture, {
        pixelScale: density,
        style: mode,
    });

    if (mode === "gradient") {
        var darkC = [
            Math.round(avg[0] * 0.04),
            Math.round(avg[1] * 0.04),
            Math.round(avg[2] * 0.04),
        ];

        var topG = ctx.createLinearGradient(0, 0, 0, h * 0.38);
        topG.addColorStop(
            0,
            "rgba(" + darkC[0] + "," + darkC[1] + "," + darkC[2] + ",0.6)",
        );
        topG.addColorStop(
            1,
            "rgba(" + darkC[0] + "," + darkC[1] + "," + darkC[2] + ",0)",
        );
        ctx.fillStyle = topG;
        ctx.fillRect(0, 0, w, h * 0.38);

        var botG = ctx.createLinearGradient(0, h * 0.62, 0, h);
        botG.addColorStop(
            0,
            "rgba(" + darkC[0] + "," + darkC[1] + "," + darkC[2] + ",0)",
        );
        botG.addColorStop(
            1,
            "rgba(" + darkC[0] + "," + darkC[1] + "," + darkC[2] + ",0.6)",
        );
        ctx.fillStyle = botG;
        ctx.fillRect(0, h * 0.62, w, h * 0.38);
    }

    if (vignetteVal > 0) {
        var radG = ctx.createRadialGradient(
            w / 2,
            h / 2,
            Math.min(w, h) * 0.25,
            w / 2,
            h / 2,
            Math.max(w, h) * 0.8,
        );
        radG.addColorStop(0, "rgba(0, 0, 0, 0)");
        radG.addColorStop(1, "rgba(0, 0, 0, " + vignetteVal * 0.75 + ")");
        ctx.fillStyle = radG;
        ctx.fillRect(0, 0, w, h);
    }
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
