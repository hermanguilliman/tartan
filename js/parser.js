function parseThreadCount(str) {
    str = str.replace(/…|\.\.\./g, "").trim();

    var tokens = [];
    var re = /([A-Z]{1,2})\/(\d+)|([A-Z]{1,2})(\d+)/gi;
    var m;
    while ((m = re.exec(str)) !== null) {
        if (m[1]) {
            tokens.push({
                code: m[1].toUpperCase(),
                count: parseInt(m[2]),
                pivot: true,
            });
        } else {
            tokens.push({
                code: m[3].toUpperCase(),
                count: parseInt(m[4]),
                pivot: false,
            });
        }
    }
    if (tokens.length < 2) return null;

    for (var i = 0; i < tokens.length; i++) {
        if (!PALETTE[tokens[i].code]) return null;
    }
    return tokens;
}

/** Строим развёрнутый паттерн из токенов (симметричный тартан) */
function buildPatternFromTokens(tokens, historical) {
    function getColorForToken(t) {
        return historical ? historicize(getColor(t.code)) : getColor(t.code);
    }

    function expand(toks) {
        var arr = [];
        for (var i = 0; i < toks.length; i++) {
            var col = getColorForToken(toks[i]);
            for (var j = 0; j < toks[i].count; j++) arr.push(col);
        }
        return arr;
    }

    var hasPivots = tokens[0].pivot || tokens[tokens.length - 1].pivot;

    if (hasPivots) {
        var half = [];
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            var col = getColorForToken(t);
            var w = t.pivot ? Math.max(1, Math.round(t.count / 2)) : t.count;
            for (var j = 0; j < w; j++) half.push(col);
        }

        var mirror = half.slice(0, -1).reverse().slice(0, -1);
        return half.concat(mirror);
    } else {
        return expand(tokens);
    }
}

/** Thread count → строка для отображения */
function settToTCString(sett) {
    return sett
        .map(function (t) {
            return t.pivot ? t.code + "/" + t.count : t.code + t.count;
        })
        .join(" ");
}
