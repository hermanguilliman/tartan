(function () {
    "use strict";

    var canvasEl = document.getElementById("canvas");
    var loaderEl = document.getElementById("loader");
    var containerEl = document.getElementById("canvasContainer");
    var previewArea = document.getElementById("previewArea");
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
    var dlBtn = document.getElementById("downloadBtn");

    var currentMode = "pattern";
    var wpPresetW = 1179;
    var wpPresetH = 2556;
    var wpStyle = "fill";
    var wpVignette = true;
    var wpVignetteStrength = 0.5;

    var currentTokens = null;
    var currentHistorical = false;
    var currentSize = 768;
    var HIST_MAX = 12;

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

    function buildPatterns() {
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
        return { warp: pattern, weft: weftPattern };
    }

    function getWallpaperOptions() {
        return {
            mode: wpStyle,
            vignette: wpVignette,
            vignetteStrength: wpVignetteStrength,
        };
    }

    /* ─── Размеры превью ─── */
    function calcPreviewSize() {
        var inner = document.querySelector(".preview-inner");
        if (!inner) return { w: 512, h: 512 };
        var availW = inner.clientWidth - 20;
        var availH = inner.clientHeight - 20;
        availW = Math.max(100, availW);
        availH = Math.max(100, availH);

        if (currentMode === "pattern") {
            var side = Math.min(availW, availH, 800);
            side = Math.max(200, side);
            return { w: side, h: side };
        }

        var ratio = wpPresetW / wpPresetH;
        var pw, ph;
        if (ratio < 1) {
            ph = Math.min(availH, 720);
            pw = Math.round(ph * ratio);
            if (pw > availW) {
                pw = availW;
                ph = Math.round(pw / ratio);
            }
        } else {
            pw = Math.min(availW, 800);
            ph = Math.round(pw / ratio);
            if (ph > availH) {
                ph = availH;
                pw = Math.round(ph * ratio);
            }
        }
        return { w: Math.max(100, pw), h: Math.max(100, ph) };
    }

    /* ─── Рендер ─── */
    function doRender() {
        if (!currentTokens) return;

        var sz = calcPreviewSize();
        canvasEl.width = sz.w;
        canvasEl.height = sz.h;

        /* Класс устройства для рамки */
        containerEl.classList.remove("device-phone", "device-desktop");
        if (currentMode === "wallpaper") {
            var ratio = wpPresetW / wpPresetH;
            containerEl.classList.add(
                ratio < 1 ? "device-phone" : "device-desktop",
            );
        }

        var p = buildPatterns();

        if (currentMode === "pattern") {
            canvasEl.style.imageRendering = "pixelated";
            drawTartan(canvasEl, p.warp, p.weft, textureEl.checked);
        } else {
            canvasEl.style.imageRendering = "auto";
            drawWallpaper(
                canvasEl,
                p.warp,
                p.weft,
                textureEl.checked,
                getWallpaperOptions(),
            );
        }
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

    /* ─── История ─── */
    function makeThumbnail(tokens, historical) {
        var S = 80;
        var mini = document.createElement("canvas");
        mini.width = mini.height = S;
        var pattern = buildPatternFromTokens(tokens, historical);
        drawTartan(mini, pattern, pattern, false);
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

        if (currentTokens) {
            setLoading(true);
            setTimeout(function () {
                doRender();
                setLoading(false);
            }, 30);
        }
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
                wpPresetW + " \u00d7 " + wpPresetH;

            if (currentTokens) {
                setLoading(true);
                setTimeout(function () {
                    doRender();
                    setLoading(false);
                }, 30);
            }
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

            if (currentTokens) {
                setLoading(true);
                setTimeout(function () {
                    doRender();
                    setLoading(false);
                }, 30);
            }
        });
    });

    /* ─── Виньетка ─── */
    var wpVignetteEl = document.getElementById("wpVignette");
    var wpVignetteStrEl = document.getElementById("wpVignetteStrength");
    var wpVignetteLbl = document.getElementById("wpVignetteLabel");

    wpVignetteEl.addEventListener("change", function () {
        wpVignette = this.checked;
        wpVignetteStrEl.disabled = !wpVignette;
        if (currentTokens && currentMode === "wallpaper") {
            setLoading(true);
            setTimeout(function () {
                doRender();
                setLoading(false);
            }, 30);
        }
    });

    wpVignetteStrEl.addEventListener("input", function () {
        wpVignetteStrength = parseFloat(this.value);
        wpVignetteLbl.textContent = wpVignetteStrength.toFixed(2);
        if (currentTokens && currentMode === "wallpaper") doRender();
    });

    /* ─── Параметры ─── */
    textureEl.addEventListener("change", function () {
        if (currentTokens) doRender();
    });
    warpweftEl.addEventListener("change", function () {
        if (currentTokens) doRender();
    });

    sizeEl.addEventListener("input", function () {
        currentSize = parseInt(sizeEl.value);
        sizeLabel.textContent = currentSize;
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

    /* ─── Скачивание ─── */
    dlBtn.addEventListener("click", function () {
        if (!currentTokens) return;

        if (currentMode === "pattern") {
            var tmp = document.createElement("canvas");
            tmp.width = tmp.height = currentSize;
            var p = buildPatterns();
            drawTartan(tmp, p.warp, p.weft, textureEl.checked);
            downloadCanvas(tmp, "tartan_" + Date.now() + ".png");
        } else {
            setLoading(true);
            loaderEl.querySelector("span").textContent = "Генерация обоев...";
            setTimeout(function () {
                var off = document.createElement("canvas");
                off.width = wpPresetW;
                off.height = wpPresetH;
                var p = buildPatterns();
                drawWallpaper(
                    off,
                    p.warp,
                    p.weft,
                    textureEl.checked,
                    getWallpaperOptions(),
                );
                downloadCanvas(
                    off,
                    "tartan_wp_" +
                        wpPresetW +
                        "x" +
                        wpPresetH +
                        "_" +
                        Date.now() +
                        ".png",
                );
                setLoading(false);
                loaderEl.querySelector("span").textContent = "Ткём...";
            }, 50);
        }
    });

    function downloadCanvas(cvs, filename) {
        var a = document.createElement("a");
        a.download = filename;
        a.href = cvs.toDataURL("image/png");
        a.click();
    }

    /* ─── Resize ─── */
    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (currentTokens) doRender();
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

        setLoading(true);
        setTimeout(function () {
            doRender();
            updateUI(currentTokens);
            renderHistory(0);
            setLoading(false);
        }, 100);
    } else {
        generate();
    }
})();
