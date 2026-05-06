(function () {
    "use strict";

    var canvasEl = document.getElementById("canvas");
    var loaderEl = document.getElementById("loader");
    var histStrip = document.getElementById("histStrip");
    var dominantEl = document.getElementById("dominant");
    var toneEl = document.getElementById("tone");
    var textureEl = document.getElementById("texture");
    var warpweftEl = document.getElementById("warpweft");
    var sizeEl = document.getElementById("size");
    var sizeLabel = document.getElementById("sizeLabel");
    var tcInput = document.getElementById("tcInput");
    var tcError = document.getElementById("tcError");
    var tcDisplay = document.getElementById("tcDisplay");
    var paletteRow = document.getElementById("paletteRow");
    var colorDot = document.getElementById("colorDot");
    var clanName = document.getElementById("clanName");

    var currentTokens = null;
    var currentHistorical = false;
    var currentSize = 768;
    var HIST_MAX = 10;
    var history = [];

    function setLoading(on) {
        loaderEl.classList.toggle("on", on);
        document.getElementById("generateBtn").disabled = on;
        document.getElementById("randomBtn").disabled = on;
    }

    function updateUI(tokens) {
        tcDisplay.textContent = settToTCString(tokens);

        paletteRow.innerHTML = "";
        var seen = {};
        tokens.forEach(function (t) {
            if (seen[t.code]) return;
            seen[t.code] = true;
            var col = pick(PALETTE[t.code] || [[128, 128, 128]]);
            var sw = document.createElement("div");
            sw.className = "swatch";
            sw.style.background =
                "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
            sw.title =
                t.code + " — rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
            paletteRow.appendChild(sw);
        });

        var firstCode = tokens[0].code;
        var firstCol = pick(PALETTE[firstCode] || [[128, 128, 128]]);
        colorDot.style.background =
            "rgb(" + firstCol[0] + "," + firstCol[1] + "," + firstCol[2] + ")";

        var clan = pick(CLANS);
        clanName.textContent = clan.name;
    }

    function doRender() {
        if (!currentTokens) return;
        canvasEl.width = canvasEl.height = currentSize;

        var pattern = buildPatternFromTokens(currentTokens, currentHistorical);

        var weftPattern = pattern;
        if (warpweftEl.checked) {
            var offset = Math.floor(
                rand(pattern.length * 0.2, pattern.length * 0.5),
            );
            weftPattern = pattern
                .slice(offset)
                .concat(pattern.slice(0, offset));
        }

        drawTartan(canvasEl, pattern, weftPattern, textureEl.checked);
    }

    function generate() {
        currentSize = parseInt(sizeEl.value);
        sizeLabel.textContent = currentSize + " px";

        var domKey =
            dominantEl.value === "any"
                ? pick(Object.keys(DOM_GROUPS))
                : dominantEl.value;
        var toneKey = toneEl.value;
        currentHistorical = toneKey === "historical";

        var result = generateSett(domKey, toneKey);
        currentTokens = result.tokens;
        currentHistorical = result.historical;
        tcInput.value = settToTCString(result.tokens);
        tcError.classList.remove("show");

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            addToHistory(currentTokens, currentHistorical);
            setLoading(false);
        }, 30);
    }

    function applyThreadCount() {
        var str = tcInput.value.trim();
        if (!str) return;

        var tokens = parseThreadCount(str);
        if (!tokens) {
            tcError.classList.add("show");
            return;
        }
        tcError.classList.remove("show");

        currentTokens = tokens;
        currentHistorical = toneEl.value === "historical";

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            addToHistory(currentTokens, currentHistorical);
            setLoading(false);
        }, 30);
    }

    function makeThumbnail(tokens, historical) {
        var S = 120;
        var mini = document.createElement("canvas");
        mini.width = mini.height = S;
        var pattern = buildPatternFromTokens(tokens, historical);
        drawTartan(mini, pattern, pattern, false);
        return mini.toDataURL();
    }

    function addToHistory(tokens, historical) {
        var thumb = makeThumbnail(tokens, historical);
        history.unshift({
            tokens: tokens.slice(),
            historical: historical,
            thumb: thumb,
            size: currentSize,
        });
        if (history.length > HIST_MAX) history.pop();
        renderHistory(0);
    }

    function renderHistory(activeIdx) {
        histStrip.innerHTML = "";
        if (!history.length) {
            histStrip.innerHTML =
                '<span class="hist-empty">Паттерны появятся здесь</span>';
            return;
        }
        history.forEach(function (entry, idx) {
            var wrap = document.createElement("div");
            wrap.className =
                "hist-thumb" + (idx === activeIdx ? " active" : "");
            wrap.title = "Восстановить · " + settToTCString(entry.tokens);

            var img = document.createElement("img");
            img.src = entry.thumb;
            wrap.appendChild(img);

            wrap.addEventListener("click", function () {
                currentTokens = entry.tokens;
                currentHistorical = entry.historical;
                currentSize = entry.size;
                sizeEl.value = entry.size;
                sizeLabel.textContent = entry.size + " px";
                tcInput.value = settToTCString(entry.tokens);

                setLoading(true);
                setTimeout(function () {
                    doRender();
                    updateUI(currentTokens);
                    setLoading(false);
                    renderHistory(idx);
                }, 20);
            });

            histStrip.appendChild(wrap);
        });
    }

    textureEl.addEventListener("change", function () {
        if (currentTokens) doRender();
    });
    warpweftEl.addEventListener("change", function () {
        if (currentTokens) doRender();
    });

    sizeEl.addEventListener("input", function () {
        currentSize = parseInt(sizeEl.value);
        sizeLabel.textContent = currentSize + " px";
        if (!currentTokens) return;
        setLoading(true);
        setTimeout(function () {
            doRender();
            setLoading(false);
        }, 30);
    });

    dominantEl.addEventListener("change", generate);
    toneEl.addEventListener("change", generate);

    document.getElementById("generateBtn").addEventListener("click", generate);

    document
        .getElementById("applyTC")
        .addEventListener("click", applyThreadCount);
    tcInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            applyThreadCount();
        }
    });

    document.getElementById("randomBtn").addEventListener("click", function () {
        dominantEl.selectedIndex = Math.floor(
            Math.random() * dominantEl.options.length,
        );
        toneEl.selectedIndex = Math.floor(
            Math.random() * toneEl.options.length,
        );
        textureEl.checked = Math.random() > 0.25;
        warpweftEl.checked = Math.random() > 0.85;
        generate();
    });

    document
        .getElementById("downloadBtn")
        .addEventListener("click", function () {
            var a = document.createElement("a");
            a.download = "tartan_" + Date.now() + ".png";
            a.href = canvasEl.toDataURL("image/png");
            a.click();
        });

    generate();
})();
