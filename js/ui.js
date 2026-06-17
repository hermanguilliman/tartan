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
    var threadStyleEl = document.getElementById("threadStyle");
    var densityEl = document.getElementById("density");
    var densityLabel = document.getElementById("densityLabel");

    var vignetteEl = document.getElementById("vignette");
    var vignetteLabel = document.getElementById("vignetteLabel");

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
    var currentPaletteMap = null;

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

            var col =
                (currentPaletteMap && currentPaletteMap[t.code]) ||
                getColor(t.code, 0);
            var sw = document.createElement("div");
            sw.className = "swatch";
            sw.style.background =
                "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
            paletteRow.appendChild(sw);
        });

        var firstCode = tokens[0].code;
        var firstCol =
            (currentPaletteMap && currentPaletteMap[firstCode]) ||
            getColor(firstCode, 0);
        colorDot.style.background =
            "rgb(" + firstCol[0] + "," + firstCol[1] + "," + firstCol[2] + ")";

        var matchedName = findClanByTokens(tokens);
        if (matchedName) {
            clanName.textContent = matchedName;
            clanName.style.color = "var(--accent2)";
        } else {
            clanName.textContent = "Индивидуальный узор";
            clanName.style.color = "var(--muted)";
        }
    }

    function rebuildPatterns() {
        if (!currentTokens) return;

        currentPaletteMap = generateTartanPalette(
            currentTokens,
            currentHistorical,
        );

        var pattern = buildPatternFromTokens(currentTokens, currentPaletteMap);
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
        var dstCtx = dstCanvas.getContext("2d");
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.imageSmoothingQuality = "high";
        dstCtx.clearRect(0, 0, dstCanvas.width, dstCanvas.height);
        dstCtx.drawImage(
            src,
            0,
            0,
            src.width,
            src.height,
            0,
            0,
            dstCanvas.width,
            dstCanvas.height,
        );
    }

    function doRender() {
        if (!currentTokens || !cachedWarp) return;

        var density = parseFloat(densityEl.value) || 1;
        var thStyle = threadStyleEl ? threadStyleEl.value : "classic";
        var full = getFullResolution();

        offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = full.w;
        offscreenCanvas.height = full.h;

        if (currentMode === "pattern") {
            drawTartan(
                offscreenCanvas,
                cachedWarp,
                cachedWeft,
                textureEl.checked,
                { pixelScale: density, threadStyle: thStyle },
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
                    vignette: vignetteEl ? parseFloat(vignetteEl.value) : 0.4,
                    threadStyle: thStyle,
                },
            );
        }

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
        }, 100);
    }

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

    function makeThumbnail(tokens, historical) {
        var S = 80;
        var mini = document.createElement("canvas");
        mini.width = mini.height = S;

        var miniPalette = generateTartanPalette(tokens, historical);
        var pattern = buildPatternFromTokens(tokens, miniPalette);
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

    textureEl.addEventListener("change", function () {
        renderNow();
    });

    warpweftEl.addEventListener("change", function () {
        rebuildPatterns();
        renderNow();
    });

    if (threadStyleEl) {
        threadStyleEl.addEventListener("change", function () {
            renderNow();
        });
    }

    densityEl.addEventListener("input", function () {
        densityLabel.textContent = this.value + "x";
        renderDebounced();
    });

    if (vignetteEl) {
        vignetteEl.addEventListener("input", function () {
            vignetteLabel.textContent = Math.round(this.value * 100) + "%";
            renderDebounced();
        });
    }

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
        if (threadStyleEl) {
            threadStyleEl.selectedIndex = Math.floor(
                Math.random() * threadStyleEl.options.length,
            );
        }
        if (vignetteEl) {
            vignetteEl.value = rand(0.1, 0.7).toFixed(1);
            vignetteLabel.textContent =
                Math.round(vignetteEl.value * 100) + "%";
        }
        generate();
    });

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
