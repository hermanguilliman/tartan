/**
 * Отрисовка тартана — саржевое переплетение twill 2/2.
 * Низкое разрешение → чёткие пиксели.
 * Высокое разрешение → сложная органичная ткань.
 * Бесшовная саржа (absX/absY) — без ряби на стыках.
 */

function drawTartan(canvas, warpPattern, weftPattern, useTexture) {
    var size  = canvas.width;
    var ctx   = canvas.getContext('2d');
    var warpLen = warpPattern.length;
    var weftLen = weftPattern.length;
    var img   = ctx.createImageData(size, size);
    var data  = img.data;

    var scale = Math.max(1, Math.floor(size / Math.max(warpLen, weftLen) / 2) * 2) || 1;

    // Порог: меньше 4 пикселей на нить → чистый пиксель-арт, иначе → ткань
    var crispMode = scale < 4;

    // В пиксельном режиме нити не смешиваются, в тканевом — переплетаются
    var mixTop = crispMode ? 1.0  : 0.88;
    var mixBot = crispMode ? 0.0  : 0.12;

    for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {

            // Абсолютные координаты для бесшовной саржи
            var absX = Math.floor(px / scale);
            var absY = Math.floor(py / scale);

            // Координаты цвета (зацикленные по паттерну)
            var xi = absX % warpLen;
            var yi = absY % weftLen;

            // Саржа без сбоя на стыках
            var warpOnTop = ((absX + absY) % 4) < 2;

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

            // Текстура только в режиме «ткань» (высокое разрешение)
            if (useTexture && !crispMode) {
                var threadX = (px / scale) % 1;
                var threadY = (py / scale) % 1;
                var bump = warpOnTop
                    ? Math.sin(threadX * Math.PI) * 14 - 4
                    : Math.sin(threadY * Math.PI) * 14 - 4;
                var fiber = Math.sin(px * 0.7 + py * 0.3) * 3 + Math.sin(px * 1.3 - py * 0.8) * 2;
                r = clamp(r + bump + fiber);
                g = clamp(g + bump + fiber);
                b = clamp(b + bump + fiber);
            }

            var i = (py * size + px) * 4;
            data[i]     = r | 0;
            data[i + 1] = g | 0;
            data[i + 2] = b | 0;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
}