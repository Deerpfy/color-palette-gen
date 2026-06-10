/* Palette Generator - offline color palette tool.
   Classic script: no ES modules, no imports, no dependencies, no network.
   Public helpers are attached to window.PaletteGenerator for reuse. */
(function () {
  "use strict";

  /* ---- Color math ------------------------------------------------------- */

  function clamp(value, min, max) {
    if (value < min) { return min; }
    if (value > max) { return max; }
    return value;
  }

  // Accepts 3- or 6-digit hex, with or without a leading hash.
  // Returns a normalized "#rrggbb" string (lowercase) or null when invalid.
  function normalizeHex(input) {
    if (typeof input !== "string") { return null; }
    var hex = input.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.charAt(0) + hex.charAt(0) +
            hex.charAt(1) + hex.charAt(1) +
            hex.charAt(2) + hex.charAt(2);
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return "#" + hex.toLowerCase();
    }
    return null;
  }

  function hexToRgb(hex) {
    var normalized = normalizeHex(hex);
    if (!normalized) { return null; }
    var intValue = parseInt(normalized.slice(1), 16);
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  }

  function rgbToHex(r, g, b) {
    function channel(value) {
      var v = Math.round(clamp(value, 0, 255)).toString(16);
      return v.length === 1 ? "0" + v : v;
    }
    return "#" + channel(r) + channel(g) + channel(b);
  }

  function rgbToHsl(r, g, b) {
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var delta = max - min;
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === rn) {
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        h = (bn - rn) / delta + 2;
      } else {
        h = (rn - gn) / delta + 4;
      }
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) { r1 = c; g1 = x; }
    else if (h < 120) { r1 = x; g1 = c; }
    else if (h < 180) { g1 = c; b1 = x; }
    else if (h < 240) { g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  // Relative luminance (WCAG) and a black/white pick for legible overlay text.
  function relativeLuminance(r, g, b) {
    function linear(channel) {
      var c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  }

  function contrastRatio(lumA, lumB) {
    var lighter = Math.max(lumA, lumB);
    var darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Returns black or white, whichever contrasts better against the color.
  function readableTextColor(r, g, b) {
    var lum = relativeLuminance(r, g, b);
    return contrastRatio(lum, 0) >= contrastRatio(lum, 1) ? "#000000" : "#ffffff";
  }

  /* ---- Harmony generators ----------------------------------------------- */

  function rotate(hue, degrees) {
    return ((hue + degrees) % 360 + 360) % 360;
  }

  // Evenly spaced lightness values across [min, max]; always distinct.
  function spreadLightness(min, max, count) {
    if (count <= 1) { return [(min + max) / 2]; }
    var values = [];
    var step = (max - min) / (count - 1);
    for (var i = 0; i < count; i++) {
      values.push(min + step * i);
    }
    return values;
  }

  // Monochromatic window centered on the base lightness, clamped into
  // [8, 92] while preserving a wide spread so swatches never collapse,
  // even when the base lightness sits near 0 or 100.
  function monochromaticLightness(baseL, count, half) {
    var min = baseL - half;
    var max = baseL + half;
    if (min < 8) { max += (8 - min); min = 8; }
    if (max > 92) { min -= (max - 92); max = 92; }
    min = clamp(min, 8, 92);
    max = clamp(max, 8, 92);
    return spreadLightness(min, max, count);
  }

  var HARMONIES = {
    complementary: {
      label: "Complementary",
      note: "The base hue paired with its opposite.",
      generate: function (base) {
        return [
          { h: base.h, s: base.s, l: base.l },
          { h: rotate(base.h, 180), s: base.s, l: base.l }
        ];
      }
    },
    analogous: {
      label: "Analogous",
      note: "Neighbouring hues for a calm, related blend.",
      generate: function (base) {
        return [-40, -20, 0, 20, 40].map(function (offset) {
          return { h: rotate(base.h, offset), s: base.s, l: base.l };
        });
      }
    },
    triadic: {
      label: "Triadic",
      note: "Three hues evenly spaced around the wheel.",
      generate: function (base) {
        return [0, 120, 240].map(function (offset) {
          return { h: rotate(base.h, offset), s: base.s, l: base.l };
        });
      }
    },
    tetradic: {
      label: "Tetradic",
      note: "Four hues forming a balanced square.",
      generate: function (base) {
        return [0, 90, 180, 270].map(function (offset) {
          return { h: rotate(base.h, offset), s: base.s, l: base.l };
        });
      }
    },
    monochromatic: {
      label: "Monochromatic",
      note: "One hue across a range of light and dark.",
      generate: function (base) {
        return monochromaticLightness(base.l, 5, 30).map(function (lightness) {
          return { h: base.h, s: base.s, l: lightness };
        });
      }
    },
    shades: {
      label: "Shades",
      note: "A single hue stepped from light to dark.",
      generate: function (base) {
        return spreadLightness(88, 14, 6).map(function (lightness) {
          return { h: base.h, s: base.s, l: lightness };
        });
      }
    }
  };

  /* ---- Palette assembly ------------------------------------------------- */

  function makeSwatch(rgb, hexValue) {
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return {
      hex: hexValue.toUpperCase(),
      rgb: "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")",
      hsl: "hsl(" + Math.round(hsl.h) + ", " + Math.round(hsl.s) + "%, " + Math.round(hsl.l) + "%)",
      r: rgb.r, g: rgb.g, b: rgb.b
    };
  }

  function generatePalette(baseHex, ruleKey) {
    var baseRgb = hexToRgb(baseHex);
    if (!baseRgb) { return []; }
    var base = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
    var rule = HARMONIES[ruleKey] || HARMONIES.complementary;
    var baseNormalized = normalizeHex(baseHex);
    return rule.generate(base).map(function (color) {
      // Preserve the exact base color where a rule keeps the unrotated hue,
      // avoiding tiny round-trip drift through HSL conversion.
      if (color.h === base.h && color.s === base.s && color.l === base.l) {
        return makeSwatch(baseRgb, baseNormalized);
      }
      var rgb = hslToRgb(color.h, color.s, color.l);
      return makeSwatch(rgb, rgbToHex(rgb.r, rgb.g, rgb.b));
    });
  }

  /* ---- Clipboard -------------------------------------------------------- */

  // Synchronous fallback for environments where the async Clipboard API is
  // unavailable, which includes many browsers on file:// (non-secure context).
  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    try {
      area.setSelectionRange(0, text.length);
    } catch (ignore) { /* some inputs do not support setSelectionRange */ }
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  // Returns a Promise<boolean>. Prefers the async Clipboard API in secure
  // contexts and falls back to a synchronous copy otherwise.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  /* ---- Downloads (Blob + object URL, no network) ------------------------ */

  function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function paletteToJson(palette) {
    var items = palette.map(function (swatch) {
      return { hex: swatch.hex, rgb: swatch.rgb, hsl: swatch.hsl };
    });
    return JSON.stringify(items, null, 2) + "\n";
  }

  function paletteToCss(palette) {
    var lines = [":root {"];
    palette.forEach(function (swatch, index) {
      lines.push("  --color-" + (index + 1) + ": " + swatch.hex + ";");
    });
    lines.push("}");
    return lines.join("\n") + "\n";
  }

  /* ---- Inline icon (single stroke family) ------------------------------- */

  var ICON_CHECK = '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  /* ---- Public API ------------------------------------------------------- */

  window.PaletteGenerator = {
    normalizeHex: normalizeHex,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    readableTextColor: readableTextColor,
    generatePalette: generatePalette,
    paletteToJson: paletteToJson,
    paletteToCss: paletteToCss,
    copyText: copyText,
    currentPalette: []
  };

  /* ---- UI wiring -------------------------------------------------------- */

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var colorInput = document.getElementById("base-color");
    var hexInput = document.getElementById("base-hex");
    var harmonySelect = document.getElementById("harmony");
    var harmonyNote = document.getElementById("harmony-note");
    var randomizeBtn = document.getElementById("randomize");
    var detailsToggle = document.getElementById("toggle-details");
    var paletteList = document.getElementById("palette");
    var countNum = document.getElementById("count-num");
    var countLabel = document.getElementById("count");
    var copyAllBtn = document.getElementById("copy-all");
    var exportJsonBtn = document.getElementById("export-json");
    var exportCssBtn = document.getElementById("export-css");
    var hexError = document.getElementById("hex-error");
    var statusRegion = document.getElementById("status");

    if (!colorInput || !hexInput || !paletteList) { return; }

    var state = {
      baseHex: normalizeHex(colorInput.value) || "#3a7bd5",
      rule: harmonySelect ? harmonySelect.value : "triadic",
      showDetails: false
    };

    var currentPalette = [];
    var statusTimer = null;

    function setStatus(message) {
      if (!statusRegion) { return; }
      statusRegion.textContent = message;
      if (statusTimer) { clearTimeout(statusTimer); }
      statusTimer = setTimeout(function () { statusRegion.textContent = ""; }, 2500);
    }

    function pluralize(count, singular) {
      return count + " " + singular + (count === 1 ? "" : "s");
    }

    function clearHexError() {
      hexInput.setAttribute("aria-invalid", "false");
      if (hexError) { hexError.hidden = true; }
    }

    function showHexError() {
      hexInput.setAttribute("aria-invalid", "true");
      if (hexError) { hexError.hidden = false; }
    }

    function buildSwatchElement(swatch) {
      var item = document.createElement("li");

      var button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.setAttribute("data-hex", swatch.hex);
      button.setAttribute("aria-label", "Copy " + swatch.hex + " to clipboard");

      var colorBlock = document.createElement("span");
      colorBlock.className = "swatch__color";
      colorBlock.style.backgroundColor = swatch.hex;
      colorBlock.style.color = readableTextColor(swatch.r, swatch.g, swatch.b);

      var hexLabel = document.createElement("span");
      hexLabel.className = "swatch__hex";
      hexLabel.textContent = swatch.hex;

      var copied = document.createElement("span");
      copied.className = "swatch__copied";
      copied.innerHTML = ICON_CHECK + "<span>Copied</span>";

      colorBlock.appendChild(hexLabel);
      colorBlock.appendChild(copied);

      var info = document.createElement("span");
      info.className = "swatch__info";
      var rgbLine = document.createElement("span");
      rgbLine.className = "swatch__line";
      rgbLine.textContent = swatch.rgb;
      var hslLine = document.createElement("span");
      hslLine.className = "swatch__line";
      hslLine.textContent = swatch.hsl;
      info.appendChild(rgbLine);
      info.appendChild(hslLine);

      button.appendChild(colorBlock);
      button.appendChild(info);
      item.appendChild(button);
      return item;
    }

    function render() {
      currentPalette = generatePalette(state.baseHex, state.rule);
      window.PaletteGenerator.currentPalette = currentPalette;

      paletteList.innerHTML = "";
      currentPalette.forEach(function (swatch) {
        paletteList.appendChild(buildSwatchElement(swatch));
      });

      paletteList.classList.toggle("show-details", state.showDetails);

      if (countNum) { countNum.textContent = String(currentPalette.length); }
      if (countLabel) {
        countLabel.setAttribute("aria-label", pluralize(currentPalette.length, "swatch") + " in palette");
      }
    }

    function syncInputsFromState() {
      colorInput.value = state.baseHex;             // expects lowercase #rrggbb
      hexInput.value = state.baseHex.toUpperCase();
      clearHexError();
    }

    function updateHarmonyNote() {
      var rule = HARMONIES[state.rule];
      if (harmonyNote && rule) { harmonyNote.textContent = rule.note; }
    }

    function flashButton(button, message) {
      var labelSpan = button.querySelector(".btn__label");
      if (!labelSpan) { return; }
      if (!button._originalLabel) { button._originalLabel = labelSpan.textContent; }
      labelSpan.textContent = message;
      button.classList.add("is-done");
      if (button._timer) { clearTimeout(button._timer); }
      button._timer = setTimeout(function () {
        labelSpan.textContent = button._originalLabel;
        button.classList.remove("is-done");
        button._timer = null;
      }, 1200);
    }

    /* ---- Events --------------------------------------------------------- */

    // Color picker -> hex field (always a valid value here).
    colorInput.addEventListener("input", function () {
      var normalized = normalizeHex(colorInput.value);
      if (!normalized) { return; }
      state.baseHex = normalized;
      hexInput.value = normalized.toUpperCase();
      clearHexError();
      render();
    });

    // Hex field -> color picker. Validate and ignore until valid.
    hexInput.addEventListener("input", function () {
      var normalized = normalizeHex(hexInput.value);
      if (!normalized) {
        showHexError();
        return; // partial/invalid input is ignored without crashing
      }
      clearHexError();
      state.baseHex = normalized;
      colorInput.value = normalized;
      render();
    });

    // Snap the field back to the canonical base when focus leaves it.
    hexInput.addEventListener("blur", function () {
      hexInput.value = state.baseHex.toUpperCase();
      clearHexError();
    });

    if (randomizeBtn) {
      randomizeBtn.addEventListener("click", function () {
        var h = Math.floor(Math.random() * 360);
        var s = 55 + Math.random() * 35;   // 55 - 90
        var l = 42 + Math.random() * 22;   // 42 - 64
        var rgb = hslToRgb(h, s, l);
        state.baseHex = rgbToHex(rgb.r, rgb.g, rgb.b);
        syncInputsFromState();
        render();
        setStatus("New base color " + state.baseHex.toUpperCase());
      });
    }

    if (harmonySelect) {
      harmonySelect.addEventListener("change", function () {
        state.rule = harmonySelect.value;
        updateHarmonyNote();
        render();
      });
    }

    if (detailsToggle) {
      detailsToggle.addEventListener("change", function () {
        state.showDetails = detailsToggle.checked;
        paletteList.classList.toggle("show-details", state.showDetails);
      });
    }

    // Per-swatch copy via event delegation.
    paletteList.addEventListener("click", function (event) {
      var button = event.target.closest(".swatch");
      if (!button) { return; }
      var hex = button.getAttribute("data-hex");
      Promise.resolve(copyText(hex)).then(function (ok) {
        if (!ok) {
          setStatus("Copy failed. Select the value manually.");
          return;
        }
        button.classList.add("is-copied");
        setStatus("Copied " + hex);
        if (button._copyTimer) { clearTimeout(button._copyTimer); }
        button._copyTimer = setTimeout(function () {
          button.classList.remove("is-copied");
          button._copyTimer = null;
        }, 1100);
      });
    });

    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        if (!currentPalette.length) { return; }
        var text = currentPalette.map(function (s) { return s.hex; }).join(", ");
        Promise.resolve(copyText(text)).then(function (ok) {
          if (ok) {
            flashButton(copyAllBtn, "Copied");
            setStatus("Copied " + pluralize(currentPalette.length, "color") + " to clipboard");
          } else {
            setStatus("Copy failed. Try exporting instead.");
          }
        });
      });
    }

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", function () {
        if (!currentPalette.length) { return; }
        downloadFile("palette.json", paletteToJson(currentPalette), "application/json");
        setStatus("Downloaded palette.json");
      });
    }

    if (exportCssBtn) {
      exportCssBtn.addEventListener("click", function () {
        if (!currentPalette.length) { return; }
        downloadFile("palette.css", paletteToCss(currentPalette), "text/css");
        setStatus("Downloaded palette.css");
      });
    }

    // Initial paint.
    syncInputsFromState();
    updateHarmonyNote();
    render();
  });
})();
