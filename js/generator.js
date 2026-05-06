function generateSett(domKey, toneKey) {
    var historical = toneKey === "historical";

    var groups = DOM_GROUPS[domKey] || DOM_GROUPS["G"];
    var domCodes = groups[toneKey] || groups["any"];
    var domCode = pick(domCodes);

    var accSet = pick(ACCENT_SETS[domKey] || ACCENT_SETS["G"]);

    var domW1 = Math.floor(rand(40, 100));
    var domW2 = Math.floor(rand(18, 44));
    var acc1W = Math.floor(rand(4, 16));
    var acc2W = Math.floor(rand(2, 8));
    var midW = accSet.length > 2 ? Math.floor(rand(6, 14)) : 0;

    var tokens = [];

    tokens.push({ code: domCode, count: domW1, pivot: true });

    tokens.push({ code: accSet[0], count: acc1W, pivot: false });

    if (accSet.length > 2 && midW > 0) {
        tokens.push({ code: domCode, count: domW2, pivot: false });
        tokens.push({ code: accSet[2], count: midW, pivot: false });
    }

    tokens.push({ code: domCode, count: domW2, pivot: false });
    tokens.push({
        code: accSet[1 % accSet.length],
        count: acc2W,
        pivot: false,
    });

    tokens.push({ code: domCode, count: domW1, pivot: true });

    return { tokens: tokens, historical: historical };
}
