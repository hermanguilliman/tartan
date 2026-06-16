function generateSett(domKey, toneKey) {
    var historical = toneKey === "historical";

    var groups = DOM_GROUPS[domKey] || DOM_GROUPS["G"];
    var domCodes = groups[toneKey] || groups["any"];
    var domCode = pick(domCodes);

    var accSet = pick(ACCENT_SETS[domKey] || ACCENT_SETS["G"]);

    var rType = Math.random();
    var tokens = [];

    if (rType < 0.2) {
        var blockW1 = Math.floor(rand(20, 44));
        var blockW2 = Math.floor(rand(16, 36));
        var altCode = accSet[0];
        tokens.push({ code: domCode, count: blockW1, pivot: true });
        tokens.push({ code: altCode, count: blockW2, pivot: true });
    } else if (rType < 0.7) {
        var domW = Math.floor(rand(24, 48));
        var bgW = Math.floor(rand(16, 32));
        var accW = Math.floor(rand(2, 6));

        var bgCode =
            pick(
                ["K", "N", "DS", "DB", "DG"].filter(function (c) {
                    return c !== domCode;
                }),
            ) || accSet[0];
        var accCode = accSet[1 % accSet.length];

        tokens.push({ code: domCode, count: domW, pivot: true });
        tokens.push({ code: "K", count: Math.floor(rand(4, 8)), pivot: false });
        tokens.push({ code: bgCode, count: bgW, pivot: false });
        tokens.push({ code: accCode, count: accW, pivot: false });
        tokens.push({ code: bgCode, count: bgW, pivot: false });
        tokens.push({ code: "K", count: Math.floor(rand(4, 8)), pivot: false });
        tokens.push({ code: domCode, count: domW, pivot: true });
    } else {
        var domW1 = Math.floor(rand(28, 56));
        var domW2 = Math.floor(rand(12, 24));
        var acc1W = Math.floor(rand(4, 8));
        var acc2W = Math.floor(rand(2, 6));
        var midW = accSet.length > 2 ? Math.floor(rand(4, 8)) : 0;

        tokens.push({ code: domCode, count: domW1, pivot: true });
        tokens.push({ code: accSet[0], count: acc1W, pivot: false });

        if (accSet.length > 2 && midW > 0) {
            tokens.push({ code: domCode, count: domW2, pivot: false });
            tokens.push({ code: accSet[2], count: midW, pivot: false });
        } else {
            tokens.push({ code: domCode, count: domW2, pivot: false });
        }

        tokens.push({
            code: accSet[1 % accSet.length],
            count: acc2W,
            pivot: false,
        });

        tokens.push({ code: domCode, count: domW1, pivot: true });
    }

    return { tokens: tokens, historical: historical };
}
