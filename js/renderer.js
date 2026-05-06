function drawTartan(canvas, warpPattern, weftPattern, useTexture) {
    var size = canvas.width;
    var ctx = canvas.getContext("2d");
    var warpLen = warpPattern.length;
    var weftLen = weftPattern.length;
    var img = ctx.createImageData(size, size);
    var data = img.data;

    var scale =
        Math.max(1, Math.floor(size / Math.max(warpLen, weftLen) / 2) * 2) || 1;

    for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {
            var xi = Math.floor(px / scale) % warpLen;
            var yi = Math.floor(py / scale) % weftLen;

            var warpOnTop = (xi + yi) % 4 < 2;

            var warpColor = warpPattern[xi];
            var weftColor = weftPattern[yi];

            var r, g, b;
            if (warpOnTop) {
                r = clamp(warpColor[0] * 0.88 + weftColor[0] * 0.12);
                g = clamp(warpColor[1] * 0.88 + weftColor[1] * 0.12);
                b = clamp(warpColor[2] * 0.88 + weftColor[2] * 0.12);
            } else {
                r = clamp(weftColor[0] * 0.88 + warpColor[0] * 0.12);
                g = clamp(weftColor[1] * 0.88 + warpColor[1] * 0.12);
                b = clamp(weftColor[2] * 0.88 + warpColor[2] * 0.12);
            }

            if (useTexture) {
                var threadX = (px / scale) % 1;
                var threadY = (py / scale) % 1;
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

            var i = (py * size + px) * 4;
            data[i] = r | 0;
            data[i + 1] = g | 0;
            data[i + 2] = b | 0;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
}
