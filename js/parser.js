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

function buildPatternFromTokens(tokens, paletteMap) {
    function getColorForToken(t) {
        return paletteMap[t.code] || [128, 128, 128];
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

function settToTCString(sett) {
    return sett
        .map(function (t) {
            return t.pivot ? t.code + "/" + t.count : t.code + t.count;
        })
        .join(" ");
}

function getGCD(a, b) {
    while (b) {
        var t = b;
        b = a % b;
        a = t;
    }
    return a;
}

function normalizeTokens(tokens) {
    if (!tokens || tokens.length === 0) return [];
    var gcd = tokens[0].count;
    for (var i = 1; i < tokens.length; i++) {
        gcd = getGCD(gcd, tokens[i].count);
    }
    if (gcd < 1) gcd = 1;
    return tokens.map(function (t) {
        return {
            code: t.code.toUpperCase(),
            count: Math.round(t.count / gcd),
            pivot: !!t.pivot,
        };
    });
}

function areTokensEqual(tokensA, tokensB) {
    if (tokensA.length !== tokensB.length) return false;

    var directMatch = true;
    for (var i = 0; i < tokensA.length; i++) {
        if (
            tokensA[i].code !== tokensB[i].code ||
            tokensA[i].count !== tokensB[i].count ||
            tokensA[i].pivot !== tokensB[i].pivot
        ) {
            directMatch = false;
            break;
        }
    }
    if (directMatch) return true;

    var reverseMatch = true;
    var len = tokensA.length;
    for (var i = 0; i < len; i++) {
        var b = tokensB[len - 1 - i];
        if (
            tokensA[i].code !== b.code ||
            tokensA[i].count !== b.count ||
            tokensA[i].pivot !== b.pivot
        ) {
            reverseMatch = false;
            break;
        }
    }
    return reverseMatch;
}

function findClanByTokens(tokens) {
    if (!tokens || tokens.length === 0) return null;
    var normA = normalizeTokens(tokens);

    for (var i = 0; i < CLANS.length; i++) {
        var clanTokens = parseThreadCount(CLANS[i].tc);
        if (!clanTokens) continue;
        var normB = normalizeTokens(clanTokens);

        if (areTokensEqual(normA, normB)) {
            return CLANS[i].name;
        }
    }
    return null;
}
