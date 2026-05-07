function drawTartan(canvas, warpPattern, weftPattern, useTexture, options) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var warpLen = warpPattern.length;
    var weftLen = weftPattern.length;
    var img = ctx.createImageData(w, h);
    var data = img.data;

    var density = options && options.pixelScale ? options.pixelScale : 1;

    var baseScale =
        Math.max(
            1,
            Math.floor(Math.min(w, h) / Math.max(warpLen, weftLen) / 2) * 2,
        ) || 1;
    var scale = baseScale;

    var effectivePxPerThread = scale / density;
    var crispMode = effectivePxPerThread < 4;
    var mixTop = crispMode ? 1.0 : 0.88;
    var mixBot = crispMode ? 0.0 : 0.12;

    for (var py = 0; py < h; py++) {
        for (var px = 0; px < w; px++) {
            var absX = Math.floor((px * density) / scale);
            var absY = Math.floor((py * density) / scale);

            var xi = absX % warpLen;
            var yi = absY % weftLen;

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

            if (useTexture && !crispMode) {
                var threadX = ((px * density) / scale) % 1;
                var threadY = ((py * density) / scale) % 1;
                var bump = warpOnTop
                    ? Math.sin(threadX * Math.PI) * 14 - 4
                    : Math.sin(threadY * Math.PI) * 14 - 4;
                var fiber =
                    Math.sin(px * 0.7 + py * 0.3) * 3 +
                    Math.sin(px * 1.3 - py * 0.8) * 2;
                r = clamp(r + bump + fiber);
                g = clamp(g + bump + fiber);
                b = clamp(b + bump + fiber);
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

/* ─── Обои ─── */

function drawWallpaper(canvas, warpPattern, weftPattern, useTexture, options) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var mode = options.mode || "fill";
    var density = options.pixelScale || 1;
    var avg = getAverageColor(warpPattern);

    ctx.clearRect(0, 0, w, h);

    if (mode === "tile") {
        var baseTileSize = Math.round(Math.min(w, h) / 4);
        var tileSize = Math.max(32, Math.round(baseTileSize / density));

        var tile = document.createElement("canvas");
        tile.width = tile.height = tileSize;
        drawTartan(tile, warpPattern, weftPattern, useTexture, {
            pixelScale: 1,
        });

        var pat = ctx.createPattern(tile, "repeat");
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
    } else if (mode === "gradient") {
        drawTartan(canvas, warpPattern, weftPattern, useTexture, {
            pixelScale: density,
        });

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
    } else {
        drawTartan(canvas, warpPattern, weftPattern, useTexture, {
            pixelScale: density,
        });
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
