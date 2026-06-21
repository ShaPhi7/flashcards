"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const INDEX_HTML_PATH = path.join(__dirname, "..", "index.html");

function extractInlineScripts(html) {
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    return matches.map(m => m[1]);
}

function extractBodyMarkupBeforeScripts(html) {
    const bodyStart = html.indexOf("<body>");
    const firstScript = html.indexOf("<script", bodyStart);
    return html.slice(bodyStart + "<body>".length, firstScript);
}

/**
 * Builds a fresh jsdom document that runs the *real* index.html logic,
 * read straight from the source file on every call, against a controlled
 * set of synthetic decks. This means:
 *
 *   - Tests automatically track the real app — if you change render()
 *     or the click handler in index.html, the next test run exercises
 *     the new code, with no separate copy of the logic to keep in sync.
 *   - Tests never depend on your real (untracked-by-this-repo) deck
 *     files in decks/ — every test supplies its own tiny, predictable
 *     deck instead, so results are deterministic.
 */
function buildDom(testDecks) {
    const html = fs.readFileSync(INDEX_HTML_PATH, "utf8");

    const inlineScripts = extractInlineScripts(html);
    if (inlineScripts.length !== 2) {
        throw new Error(
            `Expected exactly 2 inline <script> blocks in index.html, found ${inlineScripts.length}. ` +
            `If you've restructured the file, update tests/helpers.js to match.`
        );
    }

    const [registerDeckShim, mainAppScript] = inlineScripts;
    const staticMarkup = extractBodyMarkupBeforeScripts(html);

    const deckRegistrations = Object.entries(testDecks)
        .map(([name, cards]) => `registerDeck(${JSON.stringify(name)}, ${JSON.stringify(cards)});`)
        .join("\n");

    const testHtml = `<!doctype html>
<html>
<body>
${staticMarkup}
<script>${registerDeckShim}</script>
<script>${deckRegistrations}</script>
<script>${mainAppScript}</script>
</body>
</html>`;

    const dom = new JSDOM(testHtml, {
        runScripts: "dangerously",
        url: "http://localhost/",
        beforeParse(window) {
            // The app shuffles every deck on load (by design). For tests we
            // want a predictable card order, so we make shuffle() a no-op:
            // with random pinned just under 1, Math.floor(random*(i+1))
            // always equals i, so every Fisher-Yates swap is array[i]<->array[i].
            // This must happen in beforeParse — patching window.Math.random
            // after construction would be too late, since inline scripts
            // (including the initial loadDeck() call) have already run by
            // the time `new JSDOM()` returns.
            window.Math.random = () => 0.999999;
        }
    });

    // jsdom doesn't perform real layout, so getBoundingClientRect() always
    // returns a zero-size rect. The app's tap zones (left half / right half
    // of the card) depend on a real width, so we mock a fixed 400px card.
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
        return { x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600 };
    };

    return dom;
}

// Simulates a real tap on the left or right half of the card.
function tapCard(dom, side) {
    const card = dom.window.document.getElementById("card");
    const clientX = side === "left" ? 100 : 300; // mock card is 400px wide
    const event = new dom.window.MouseEvent("click", { bubbles: true, clientX });
    card.dispatchEvent(event);
}

// Simulates checking/unchecking the "Single tap" toggle.
function setSingleTapMode(dom, enabled) {
    const checkbox = dom.window.document.getElementById("singleTapCheckbox");
    checkbox.checked = enabled;
    checkbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

// Simulates picking a different deck from the dropdown.
function selectDeck(dom, name) {
    const select = dom.window.document.getElementById("deckSelector");
    select.value = name;
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

module.exports = { buildDom, tapCard, setSingleTapMode, selectDeck };
