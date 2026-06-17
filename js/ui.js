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

    var stripBuilderList = document.getElementById("stripBuilderList");
    var addStripBtn = document.getElementById("addStripBtn");
    var toggleFormulaBtn = document.getElementById("toggleFormulaBtn");
    var formulaContainer = document.getElementById("formulaContainer");
    var applyTCBtn = document.getElementById("applyTC");

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
    var historyDebounceTimer = null;

    var history = [];
    try {
        var saved = localStorage.getItem("tartan_history");
        if (saved) history = JSON.parse(saved);
    } catch (e) {
        history = [];
    }

    function deepCopyTokens(tokens) {
        if (!tokens) return [];
        return tokens.map(function (t) {
            return {
                code: t.code,
                count: parseInt(t.count) || 2,
                pivot: !!t.pivot,
            };
        });
    }

    function saveHistoryToStore() {
        try {
            localStorage.setItem("tartan_history", JSON.stringify(history));
        } catch (e) {
            /* quota */
        }
    }

    function setLoading(on) {
        if (loaderEl) loaderEl.classList.toggle("on", on);
        var genBtn = document.getElementById("generateBtn");
        var randBtn = document.getElementById("randomBtn");
        if (genBtn) genBtn.disabled = on;
        if (randBtn) randBtn.disabled = on;
    }

    function updateUI(tokens) {
        if (tcDisplay) tcDisplay.textContent = settToTCString(tokens);

        if (paletteRow) {
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
        }

        if (colorDot && tokens.length > 0) {
            var firstCode = tokens[0].code;
            var firstCol =
                (currentPaletteMap && currentPaletteMap[firstCode]) ||
                getColor(firstCode, 0);
            colorDot.style.background =
                "rgb(" +
                firstCol[0] +
                "," +
                firstCol[1] +
                "," +
                firstCol[2] +
                ")";
        }

        if (clanName) {
            var matchedName = findClanByTokens(tokens);
            if (matchedName) {
                clanName.textContent = matchedName;
                clanName.style.color = "var(--accent2)";
            } else {
                clanName.textContent = "Индивидуальный узор";
                clanName.style.color = "var(--muted)";
            }
        }

        syncBuilderFromTokens(tokens);
    }

    function syncBuilderFromTokens(tokens) {
        if (!stripBuilderList) return;
        stripBuilderList.innerHTML = "";

        tokens.forEach(function (token, idx) {
            var item = createStripItem(token, idx);
            stripBuilderList.appendChild(item);
        });
    }

    function createStripItem(token, idx) {
        var div = document.createElement("div");
        div.className = "strip-item";
        div.dataset.index = idx;

        var col = getColor(token.code, 0);
        var colorBtn = document.createElement("button");
        colorBtn.className = "color-picker-trigger";
        colorBtn.style.background =
            "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
        colorBtn.title = "Изменить цвет (" + token.code + ")";

        colorBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllPopovers();
            openColorPopover(colorBtn, token.code, function (newCode) {
                token.code = newCode;
                rebuildFromBuilder();
                updateUI(currentTokens);
                triggerHistorySaveDebounced();
            });
        });

        var sizeCtrl = document.createElement("div");
        sizeCtrl.className = "strip-size-ctrl";

        var btnMinus = document.createElement("button");
        btnMinus.className = "strip-size-btn";
        btnMinus.textContent = "−";
        btnMinus.type = "button";
        btnMinus.addEventListener("click", function () {
            token.count = Math.max(1, token.count - (token.count > 10 ? 4 : 2));
            sizeInput.value = token.count;
            rebuildFromBuilder();
            triggerHistorySaveDebounced();
        });

        var sizeInput = document.createElement("input");
        sizeInput.className = "strip-size-input";
        sizeInput.type = "text";
        sizeInput.value = token.count;
        sizeInput.addEventListener("change", function () {
            var val = parseInt(this.value) || 2;
            token.count = Math.max(1, val);
            this.value = token.count;
            rebuildFromBuilder();
            triggerHistorySaveDebounced();
        });

        var btnPlus = document.createElement("button");
        btnPlus.className = "strip-size-btn";
        btnPlus.textContent = "+";
        btnPlus.type = "button";
        btnPlus.addEventListener("click", function () {
            token.count = token.count + (token.count >= 10 ? 4 : 2);
            sizeInput.value = token.count;
            rebuildFromBuilder();
            triggerHistorySaveDebounced();
        });

        sizeCtrl.appendChild(btnMinus);
        sizeCtrl.appendChild(sizeInput);
        sizeCtrl.appendChild(btnPlus);

        var pivotBtn = document.createElement("div");
        pivotBtn.className = "pivot-toggle" + (token.pivot ? " active" : "");
        pivotBtn.textContent = "/ Якорь";
        pivotBtn.title = "Определяет точку зеркального отражения";
        pivotBtn.addEventListener("click", function () {
            token.pivot = !token.pivot;
            pivotBtn.classList.toggle("active", token.pivot);
            rebuildFromBuilder();
            triggerHistorySaveDebounced();
        });

        var removeBtn = document.createElement("button");
        removeBtn.className = "strip-remove-btn";
        removeBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        removeBtn.title = "Удалить нить";
        removeBtn.addEventListener("click", function () {
            currentTokens.splice(idx, 1);
            if (currentTokens.length === 0) {
                currentTokens = [{ code: "B", count: 24, pivot: true }];
            }
            rebuildFromBuilder();
            updateUI(currentTokens);
            triggerHistorySaveDebounced();
        });

        div.appendChild(colorBtn);
        div.appendChild(sizeCtrl);
        div.appendChild(pivotBtn);
        div.appendChild(removeBtn);

        return div;
    }

    function closeAllPopovers() {
        document.querySelectorAll(".color-popover").forEach(function (el) {
            el.remove();
        });
    }

    document.addEventListener("click", function () {
        closeAllPopovers();
    });

    function openColorPopover(triggerEl, activeCode, onSelect) {
        var popover = document.createElement("div");
        popover.className = "color-popover";

        popover.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        Object.keys(PALETTE).forEach(function (key) {
            var colorValues = PALETTE[key];
            var col = colorValues[0];

            var swatch = document.createElement("div");
            swatch.className = "color-popover-swatch";
            swatch.style.background =
                "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
            swatch.title = key + " (" + getFriendlyColorName(key) + ")";

            if (key === activeCode) {
                swatch.style.borderColor = "var(--accent)";
                swatch.style.boxShadow = "0 0 5px var(--accent)";
            }

            swatch.addEventListener("click", function (e) {
                e.stopPropagation();
                onSelect(key);
                popover.remove();
            });

            popover.appendChild(swatch);
        });

        document.body.appendChild(popover);

        var rect = triggerEl.getBoundingClientRect();
        var popoverWidth = 220;
        var popoverHeight = 180;

        var top = rect.bottom + 6;
        var left = rect.left;

        if (top + popoverHeight > window.innerHeight) {
            top = rect.top - popoverHeight - 6;
        }

        if (left + popoverWidth > window.innerWidth) {
            left = window.innerWidth - popoverWidth - 16;
        }

        if (left < 16) {
            left = 16;
        }

        popover.style.top = top + "px";
        popover.style.left = left + "px";
    }

    function getFriendlyColorName(code) {
        var names = {
            B: "Синий",
            LB: "Светло-синий",
            DB: "Темно-синий",
            G: "Зеленый",
            LG: "Светло-зеленый",
            DG: "Темно-зеленый",
            K: "Черный",
            N: "Серый",
            LN: "Светло-серый",
            R: "Красный",
            DR: "Темно-красный",
            LR: "Светло-красный",
            T: "Коричневый",
            DT: "Темно-коричневый",
            LT: "Светло-коричневый",
            P: "Фиолетовый",
            LP: "Светло-фиолетовый",
            Y: "Желтый",
            LY: "Светло-желтый",
            W: "Белый",
            O: "Оранжевый",
            LO: "Светло-оранжевый",
            C: "Малиновый",
            DC: "Темно-малиновый",
            LC: "Светло-малиновый",
            M: "Пурпурный",
            DM: "Темно-пурпурный",
            LM: "Светло-пурпурный",
            E: "Бирюзовый",
            DE: "Темно-бирюзовый",
            LE: "Светло-бирюзовый",
            I: "Индиго",
            DI: "Темно-индиго",
            LI: "Светло-индиго",
            S: "Сланцевый",
            DS: "Темно-сланцевый",
            LS: "Светло-сланцевый",
        };
        return names[code] || code;
    }

    function rebuildFromBuilder() {
        if (tcInput) tcInput.value = settToTCString(currentTokens);
        rebuildPatterns();
        renderNow();

        if (tcDisplay) tcDisplay.textContent = settToTCString(currentTokens);
        if (clanName) {
            var matchedName = findClanByTokens(currentTokens);
            if (matchedName) {
                clanName.textContent = matchedName;
                clanName.style.color = "var(--accent2)";
            } else {
                clanName.textContent = "Индивидуальный узор";
                clanName.style.color = "var(--muted)";
            }
        }
    }

    function triggerHistorySaveDebounced() {
        clearTimeout(historyDebounceTimer);
        historyDebounceTimer = setTimeout(function () {
            addToHistory(currentTokens, currentHistorical);
        }, 1000);
    }

    if (addStripBtn) {
        addStripBtn.addEventListener("click", function () {
            var lastToken = (currentTokens &&
                currentTokens[currentTokens.length - 1]) || {
                code: "B",
                count: 24,
                pivot: false,
            };
            currentTokens.push({
                code: lastToken.code,
                count: lastToken.count,
                pivot: false,
            });
            rebuildFromBuilder();
            updateUI(currentTokens);
            triggerHistorySaveDebounced();
        });
    }

    if (toggleFormulaBtn && formulaContainer) {
        toggleFormulaBtn.addEventListener("click", function () {
            if (formulaContainer.style.display === "none") {
                formulaContainer.style.display = "block";
                toggleFormulaBtn.textContent = "Скрыть формулу (Thread Count)";
            } else {
                formulaContainer.style.display = "none";
                toggleFormulaBtn.textContent =
                    "Показать формулу (Thread Count)";
            }
        });
    }

    function rebuildPatterns() {
        if (!currentTokens) return;

        currentPaletteMap = generateTartanPalette(
            currentTokens,
            currentHistorical,
        );

        var pattern = buildPatternFromTokens(currentTokens, currentPaletteMap);
        var weftPattern = pattern;
        if (warpweftEl && warpweftEl.checked) {
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
        if (!dstCanvas) return;
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
        if (!currentTokens || !cachedWarp || !canvasEl) return;

        var density = densityEl ? parseFloat(densityEl.value) : 1;
        var thStyle = threadStyleEl ? threadStyleEl.value : "classic";
        var full = getFullResolution();

        offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = full.w;
        offscreenCanvas.height = full.h;

        var useTex = textureEl ? textureEl.checked : true;

        if (currentMode === "pattern") {
            drawTartan(offscreenCanvas, cachedWarp, cachedWeft, useTex, {
                pixelScale: density,
                threadStyle: thStyle,
            });
        } else {
            drawWallpaper(offscreenCanvas, cachedWarp, cachedWeft, useTex, {
                mode: wpStyle,
                pixelScale: density,
                vignette: vignetteEl ? parseFloat(vignetteEl.value) : 0.4,
                threadStyle: thStyle,
            });
        }

        var sz = calcPreviewSize();
        canvasEl.width = sz.w;
        canvasEl.height = sz.h;

        if (containerEl) {
            containerEl.classList.remove("device-phone", "device-desktop");
            if (currentMode === "wallpaper") {
                var ratio = full.w / full.h;
                containerEl.classList.add(
                    ratio < 1 ? "device-phone" : "device-desktop",
                );
            }
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
        if (sizeEl && sizeLabel) {
            currentSize = parseInt(sizeEl.value);
            sizeLabel.textContent = currentSize;
        }

        var domKey = "any";
        if (dominantEl) {
            domKey =
                dominantEl.value === "any"
                    ? pick(Object.keys(DOM_GROUPS))
                    : dominantEl.value;
        }
        var toneKey = toneEl ? toneEl.value : "any";
        currentHistorical = toneKey === "historical";

        var result = generateSett(domKey, toneKey);
        currentTokens = result.tokens;
        currentHistorical = result.historical;
        if (tcInput) tcInput.value = settToTCString(result.tokens);
        if (tcError) tcError.classList.remove("show");

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
        if (!tcInput) return;
        var str = tcInput.value.trim();
        if (!str) return;
        var tokens = parseThreadCount(str);
        if (!tokens) {
            if (tcError) tcError.classList.add("show");
            return;
        }
        if (tcError) tcError.classList.remove("show");

        currentTokens = tokens;
        currentHistorical = toneEl ? toneEl.value === "historical" : false;

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
        var deepTokens = deepCopyTokens(tokens);
        var thumb = makeThumbnail(deepTokens, historical);

        if (
            history.length > 0 &&
            settToTCString(history[0].tokens) === settToTCString(deepTokens)
        )
            return;

        history.unshift({
            tokens: deepTokens,
            historical: historical,
            thumb: thumb,
            size: currentSize,
        });
        if (history.length > HIST_MAX) history.pop();
        saveHistoryToStore();
        renderHistory(0);
    }

    function renderHistory(activeIdx) {
        if (!histStrip) return;
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
                currentTokens = deepCopyTokens(entry.tokens);
                currentHistorical = entry.historical;
                currentSize = entry.size;
                if (sizeEl && sizeLabel) {
                    sizeEl.value = entry.size;
                    sizeLabel.textContent = entry.size;
                }
                if (tcInput) tcInput.value = settToTCString(currentTokens);

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

        var pControls = document.getElementById("patternControls");
        var wControls = document.getElementById("wallpaperControls");
        var pExport = document.getElementById("patternExport");
        var wExport = document.getElementById("wallpaperExport");

        if (pControls)
            pControls.style.display = mode === "pattern" ? "block" : "none";
        if (wControls)
            wControls.style.display = mode === "wallpaper" ? "block" : "none";
        if (pExport)
            pExport.style.display = mode === "pattern" ? "block" : "none";
        if (wExport)
            wExport.style.display = mode === "wallpaper" ? "block" : "none";

        if (dlBtn) {
            dlBtn.textContent =
                mode === "pattern" ? "Скачать PNG" : "Скачать обои";
            dlBtn.classList.toggle("wp-mode", mode === "wallpaper");
        }

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
            var szInfo = document.getElementById("wpSizeInfo");
            if (szInfo) szInfo.textContent = wpPresetW + " × " + wpPresetH;
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

    if (textureEl) {
        textureEl.addEventListener("change", function () {
            renderNow();
        });
    }

    if (warpweftEl) {
        warpweftEl.addEventListener("change", function () {
            rebuildPatterns();
            renderNow();
        });
    }

    if (threadStyleEl) {
        threadStyleEl.addEventListener("change", function () {
            renderNow();
        });
    }

    if (densityEl) {
        densityEl.addEventListener("input", function () {
            if (densityLabel) densityLabel.textContent = this.value + "x";
            renderDebounced();
        });
    }

    if (vignetteEl) {
        vignetteEl.addEventListener("input", function () {
            if (vignetteLabel)
                vignetteLabel.textContent = Math.round(this.value * 100) + "%";
            renderDebounced();
        });
    }

    if (sizeEl) {
        sizeEl.addEventListener("input", function () {
            currentSize = parseInt(sizeEl.value);
            if (sizeLabel) sizeLabel.textContent = currentSize;
            renderDebounced();
        });
    }

    if (dominantEl) dominantEl.addEventListener("change", generate);
    if (toneEl) toneEl.addEventListener("change", generate);

    var mainGenBtn = document.getElementById("generateBtn");
    if (mainGenBtn) mainGenBtn.addEventListener("click", generate);

    if (applyTCBtn) applyTCBtn.addEventListener("click", applyThreadCount);

    if (tcInput) {
        tcInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                applyThreadCount();
            }
        });
    }

    var mainRandBtn = document.getElementById("randomBtn");
    if (mainRandBtn) {
        mainRandBtn.addEventListener("click", function () {
            if (dominantEl) {
                dominantEl.selectedIndex = Math.floor(
                    Math.random() * dominantEl.options.length,
                );
            }
            if (toneEl) {
                toneEl.selectedIndex = Math.floor(
                    Math.random() * toneEl.options.length,
                );
            }
            if (textureEl) textureEl.checked = Math.random() > 0.25;
            if (warpweftEl) warpweftEl.checked = Math.random() > 0.85;
            if (threadStyleEl) {
                threadStyleEl.selectedIndex = Math.floor(
                    Math.random() * threadStyleEl.options.length,
                );
            }
            if (vignetteEl) {
                vignetteEl.value = rand(0.1, 0.7).toFixed(1);
                if (vignetteLabel) {
                    vignetteLabel.textContent =
                        Math.round(vignetteEl.value * 100) + "%";
                }
            }
            generate();
        });
    }

    if (dlBtn) {
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
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!currentTokens || !offscreenCanvas || !canvasEl) return;
            var sz = calcPreviewSize();
            canvasEl.width = sz.w;
            canvasEl.height = sz.h;
            drawSmooth(offscreenCanvas, canvasEl);
        }, 150);
    });

    if (history.length > 0) {
        var last = history[0];

        currentTokens = deepCopyTokens(last.tokens);
        currentHistorical = last.historical;
        currentSize = last.size || 768;
        if (tcInput) tcInput.value = settToTCString(currentTokens);
        if (sizeEl) sizeEl.value = currentSize;
        if (sizeLabel) sizeLabel.textContent = currentSize;

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
