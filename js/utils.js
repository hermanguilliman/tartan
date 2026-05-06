function rand(a, b) {
    return Math.random() * (b - a) + a;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v) {
    return Math.max(0, Math.min(255, v));
}

/** Получить RGB-массив по коду из палитры с небольшим джиттером */
function getColor(code, jitter) {
    if (jitter === undefined) jitter = 8;
    var v = PALETTE[code];
    if (!v) return [128, 128, 128];
    var c = pick(v);
    return c.map(function (ch) {
        return clamp(ch + Math.round(rand(-jitter, jitter)));
    });
}

/** Приглушение для исторического тона */
function historicize(rgb) {
    var avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return [
        clamp(Math.round(rgb[0] * 0.68 + avg * 0.32)),
        clamp(Math.round(rgb[1] * 0.68 + avg * 0.32)),
        clamp(Math.round(rgb[2] * 0.68 + avg * 0.32)),
    ];
}
