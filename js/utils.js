function rand(a, b) {
    return Math.random() * (b - a) + a;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v) {
    return Math.max(0, Math.min(255, v));
}

function getColor(code, jitter) {
    if (jitter === undefined) jitter = 8;
    var v = PALETTE[code];
    if (!v) return [128, 128, 128];
    var c = pick(v);
    return c.map(function (ch) {
        return clamp(ch + Math.round(rand(-jitter, jitter)));
    });
}

function historicize(rgb) {
    var avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return [
        clamp(Math.round(rgb[0] * 0.68 + avg * 0.32)),
        clamp(Math.round(rgb[1] * 0.68 + avg * 0.32)),
        clamp(Math.round(rgb[2] * 0.68 + avg * 0.32)),
    ];
}

function getAverageColor(pattern) {
    var r = 0,
        g = 0,
        b = 0;
    var len = pattern.length;
    for (var i = 0; i < len; i++) {
        r += pattern[i][0];
        g += pattern[i][1];
        b += pattern[i][2];
    }
    return [Math.round(r / len), Math.round(g / len), Math.round(b / len)];
}

function generateTartanPalette(tokens, historical) {
    var map = {};
    tokens.forEach(function (t) {
        if (map[t.code]) return;
        var baseColor = getColor(t.code, 5);
        if (historical) {
            baseColor = historicize(baseColor);
        }
        map[t.code] = baseColor;
    });
    return map;
}
