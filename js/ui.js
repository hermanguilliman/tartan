(function () {
    "use strict";

    var canvasEl = document.getElementById("canvas");
    var loaderEl = document.getElementById("loader");
    var containerEl = document.getElementById("canvasContainer");
    var histStrip = document.getElementById("histStrip");
    var dominantEl = document.getElementById("dominant");
    var toneEl = document.getElementById("tone");
    var textureEl = document.getElementById("texture");
    var warpweftEl = document.getElementById("warpweft");
    var densityEl = document.getElementById("density");
    var densityLabel = document.getElementById("densityLabel");
    var sizeEl = document.getElementById("size");
    var sizeLabel = document.getElementById("sizeLabel");
    var tcInput = document.getElementById("tcInput");
    var tcError = document.getElementById("tcError");
    var tcDisplay = document.getElementById("tcDisplay");
    var paletteRow = document.getElementById("paletteRow");
    var colorDot = document.getElementById("colorDot");
    var clanName = document.getElementById("clanName");
    var dlBtn = document.getElementById("downloadBtn");

    var currentMode = "pattern";
    var wpPresetW = 1920;
    var wpPresetH = 1080;
    var wpStyle = "fill";

    var currentTokens = null;
    var currentHistorical = false;
    var currentSize = 768;
    var HIST_MAX = 12;

    var cachedWarp = null;
    var cachedWeft = null;

    var offscreenCanvas = null;
    var renderTimer = null;

    var history = [];
    try {
        var saved = localStorage.getItem("tartan_history");
        if (saved) history = JSON.parse(saved);
    } catch (e) {
        history = [];
    }

    function saveHistoryToStore() {
        try {
            localStorage.setItem("tartan_history", JSON.stringify(history));
        } catch (e) {
            /* quota */
        }
    }

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
            paletteRow.appendChild(sw);
        });

        var firstCode = tokens[0].code;
        var firstCol = pick(PALETTE[firstCode] || [[128, 128, 128]]);
        colorDot.style.background =
            "rgb(" + firstCol[0] + "," + firstCol[1] + "," + firstCol[2] + ")";

        clanName.textContent = pick(CLANS).name;
    }

    function rebuildPatterns() {
        if (!currentTokens) return;
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
        cachedWarp = pattern;
        cachedWeft = weftPattern;
    }

    function getFullResolution() {
        if (currentMode === "pattern") {
            return { w: currentSize, h: currentSize };
        }
        return { w: wpPresetW, h: wpPresetH };
    }

    function calcPreviewSize() {
        var inner = document.querySelector(".preview-inner");
        if (!inner) return { w: 512, h: 512 };
        var availW = inner.clientWidth - 24;
        var availH = inner.clientHeight - 24;
        availW = Math.max(100, availW);
        availH = Math.max(100, availH);

        var full = getFullResolution();
        var ratio = full.w / full.h;
        var pw, ph;

        if (ratio >= 1) {
            pw = Math.min(availW, 800);
            ph = Math.round(pw / ratio);
            if (ph > availH) {
                ph = availH;
                pw = Math.round(ph * ratio);
            }
        } else {
            ph = Math.min(availH, 720);
            pw = Math.round(ph * ratio);
            if (pw > availW) {
                pw = availW;
                ph = Math.round(pw / ratio);
            }
        }

        return { w: Math.max(80, pw), h: Math.max(80, ph) };
    }

    
    function drawSmooth(src, dstCanvas) {
        var sw = src.width;
        var sh = src.height;
        var dw = dstCanvas.width;
        var dh = dstCanvas.height;

        if (sw === dw && sh === dh) {
            dstCanvas.getContext("2d").drawImage(src, 0, 0);
            return;
        }

        var srcCtx = src.getContext("2d");
        var srcData = srcCtx.getImageData(0, 0, sw, sh).data;

        var dstCtx = dstCanvas.getContext("2d");
        var dstImg = dstCtx.createImageData(dw, dh);
        var dstData = dstImg.data;

        var xRatio = sw / dw;
        var yRatio = sh / dh;

        for (var dy = 0; dy < dh; dy++) {
            var sy1 = Math.floor(dy * yRatio);
            var sy2 = Math.floor((dy + 1) * yRatio);
            if (sy2 >= sh) sy2 = sh - 1;

            for (var dx = 0; dx < dw; dx++) {
                var sx1 = Math.floor(dx * xRatio);
                var sx2 = Math.floor((dx + 1) * xRatio);
                if (sx2 >= sw) sx2 = sw - 1;

                var r = 0,
                    g = 0,
                    b = 0,
                    count = 0;

                for (var y = sy1; y <= sy2; y++) {
                    var rowOffset = y * sw;
                    for (var x = sx1; x <= sx2; x++) {
                        var idx = (rowOffset + x) * 4;
                        r += srcData[idx];
                        g += srcData[idx + 1];
                        b += srcData[idx + 2];
                        count++;
                    }
                }

                var dIdx = (dy * dw + dx) * 4;
                dstData[dIdx] = (r / count + 0.5) | 0;
                dstData[dIdx + 1] = (g / count + 0.5) | 0;
                dstData[dIdx + 2] = (b / count + 0.5) | 0;
                dstData[dIdx + 3] = 255;
            }
        }

        dstCtx.putImageData(dstImg, 0, 0);
    }

    function doRender() {
        if (!currentTokens || !cachedWarp) return;

        var density = parseFloat(densityEl.value) || 1;
        var full = getFullResolution();

        /* Полный рендер для скачивания */
        offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = full.w;
        offscreenCanvas.height = full.h;

        if (currentMode === "pattern") {
            drawTartan(
                offscreenCanvas,
                cachedWarp,
                cachedWeft,
                textureEl.checked,
                { pixelScale: density },
            );
        } else {
            drawWallpaper(
                offscreenCanvas,
                cachedWarp,
                cachedWeft,
                textureEl.checked,
                {
                    mode: wpStyle,
                    pixelScale: density,
                },
            );
        }

        /* Превью с попиксельным усреднением */
        var sz = calcPreviewSize();
        canvasEl.width = sz.w;
        canvasEl.height = sz.h;

        containerEl.classList.remove("device-phone", "device-desktop");
        if (currentMode === "wallpaper") {
            var ratio = full.w / full.h;
            containerEl.classList.add(
                ratio < 1 ? "device-phone" : "device-desktop",
            );
        }

        drawSmooth(offscreenCanvas, canvasEl);
    }

    function renderNow() {
        setLoading(true);
        setTimeout(function () {
            doRender();
            setLoading(false);
        }, 10);
    }

    function renderDebounced() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(function () {
            setTimeout(function () {
                doRender();
            }, 10);
        }, 200);
    }

    /* ─── Генерация ─── */
    function generate() {
        currentSize = parseInt(sizeEl.value);
        sizeLabel.textContent = currentSize;

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

        rebuildPatterns();

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            addToHistory(currentTokens, currentHistorical);
            setLoading(false);
        }, 10);
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

        rebuildPatterns();

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            addToHistory(currentTokens, currentHistorical);
            setLoading(false);
        }, 10);
    }

    /* ─── История ─── */
    function makeThumbnail(tokens, historical) {
        var S = 80;
        var mini = document.createElement("canvas");
        mini.width = mini.height = S;
        var pattern = buildPatternFromTokens(tokens, historical);
        drawTartan(mini, pattern, pattern, false, { pixelScale: 1 });
        return mini.toDataURL();
    }

    function addToHistory(tokens, historical) {
        var thumb = makeThumbnail(tokens, historical);
        if (
            history.length > 0 &&
            settToTCString(history[0].tokens) === settToTCString(tokens)
        )
            return;

        history.unshift({
            tokens: tokens.slice(),
            historical: historical,
            thumb: thumb,
            size: currentSize,
        });
        if (history.length > HIST_MAX) history.pop();
        saveHistoryToStore();
        renderHistory(0);
    }

    function renderHistory(activeIdx) {
        histStrip.innerHTML = "";
        if (!history.length) {
            histStrip.innerHTML =
                '<span class="hist-empty">История пуста</span>';
            return;
        }
        history.forEach(function (entry, idx) {
            var wrap = document.createElement("div");
            wrap.className =
                "hist-thumb" + (idx === activeIdx ? " active" : "");
            wrap.title = settToTCString(entry.tokens);

            var img = document.createElement("img");
            img.src = entry.thumb;
            wrap.appendChild(img);

            wrap.addEventListener("click", function () {
                currentTokens = entry.tokens;
                currentHistorical = entry.historical;
                currentSize = entry.size;
                sizeEl.value = entry.size;
                sizeLabel.textContent = entry.size;
                tcInput.value = settToTCString(entry.tokens);

                rebuildPatterns();

                setLoading(true);
                setTimeout(function () {
                    doRender();
                    updateUI(currentTokens);
                    setLoading(false);
                    renderHistory(idx);
                }, 10);
            });

            histStrip.appendChild(wrap);
        });
    }

    /* ─── Табы ─── */
    document.querySelectorAll(".mode-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
            switchMode(this.dataset.mode);
        });
    });

    function switchMode(mode) {
        currentMode = mode;
        document.querySelectorAll(".mode-tab").forEach(function (t) {
            t.classList.toggle("active", t.dataset.mode === mode);
        });
        document.getElementById("patternControls").style.display =
            mode === "pattern" ? "block" : "none";
        document.getElementById("wallpaperControls").style.display =
            mode === "wallpaper" ? "block" : "none";
        document.getElementById("patternExport").style.display =
            mode === "pattern" ? "block" : "none";
        document.getElementById("wallpaperExport").style.display =
            mode === "wallpaper" ? "block" : "none";
        dlBtn.textContent = mode === "pattern" ? "Скачать PNG" : "Скачать обои";
        dlBtn.classList.toggle("wp-mode", mode === "wallpaper");

        renderNow();
    }

    /* ─── Пресеты ─── */
    document.querySelectorAll(".preset-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".preset-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");
            wpPresetW = parseInt(this.dataset.w);
            wpPresetH = parseInt(this.dataset.h);
            document.getElementById("wpSizeInfo").textContent =
                wpPresetW + " × " + wpPresetH;
            renderNow();
        });
    });

    /* ─── Стили ─── */
    document.querySelectorAll(".style-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".style-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");
            wpStyle = this.dataset.style;
            renderNow();
        });
    });

    /* ─── Параметры ─── */
    textureEl.addEventListener("change", function () {
        renderNow();
    });

    warpweftEl.addEventListener("change", function () {
        rebuildPatterns();
        renderNow();
    });

    densityEl.addEventListener("input", function () {
        densityLabel.textContent = this.value + "x";
        renderDebounced();
    });

    sizeEl.addEventListener("input", function () {
        currentSize = parseInt(sizeEl.value);
        sizeLabel.textContent = currentSize;
        renderDebounced();
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

    /* ─── Скачивание ─── */
    dlBtn.addEventListener("click", function () {
        if (!currentTokens) return;

        if (!offscreenCanvas) {
            doRender();
        }

        var filename;
        if (currentMode === "pattern") {
            filename = "tartan_" + Date.now() + ".png";
        } else {
            filename =
                "tartan_wp_" +
                wpPresetW +
                "x" +
                wpPresetH +
                "_" +
                Date.now() +
                ".png";
        }

        var a = document.createElement("a");
        a.download = filename;
        a.href = offscreenCanvas.toDataURL("image/png");
        a.click();
    });

    /* ─── Resize ─── */
    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!currentTokens || !offscreenCanvas) return;
            var sz = calcPreviewSize();
            canvasEl.width = sz.w;
            canvasEl.height = sz.h;
            drawSmooth(offscreenCanvas, canvasEl);
        }, 150);
    });

    /* ─── Инициализация ─── */
    if (history.length > 0) {
        var last = history[0];
        currentTokens = last.tokens;
        currentHistorical = last.historical;
        currentSize = last.size || 768;
        tcInput.value = settToTCString(currentTokens);
        sizeEl.value = currentSize;
        sizeLabel.textContent = currentSize;

        rebuildPatterns();

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            renderHistory(0);
            setLoading(false);
        }, 10);
    } else {
        generate();
    }
})();
