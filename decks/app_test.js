"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDom, tapCard, setSingleTapMode, selectDeck } = require("./helpers");

const VOCAB = [
    { type: 1, front: "一", back: "一\nyī\none" },
    { type: 1, front: "二", back: "二\nèr\ntwo" },
    { type: 1, front: "三", back: "三\nsān\nthree" },
    { type: 1, front: "四", back: "四\nsì\nfour" },
    { type: 1, front: "五", back: "五\nwǔ\nfive" }
];

function dom() {
    return buildDom({ "Vocab": VOCAB });
}

// ---------------------------------------------------------------------
// Startup / deck selector
// ---------------------------------------------------------------------

test("loads the first registered deck on startup, showing card 1 on the front", () => {
    const d = dom();
    const doc = d.window.document;

    assert.equal(doc.getElementById("counter").textContent, "Card 1 of 5");
    assert.equal(doc.getElementById("state").textContent, "FRONT");
    assert.equal(doc.getElementById("card").textContent, "一");
    assert.equal(doc.getElementById("card").className, "front");
});

test("populates the deck selector with one option per registered deck, in order", () => {
    const d = buildDom({
        "Deck A": VOCAB,
        "Deck B": VOCAB
    });

    const options = [...d.window.document.querySelectorAll("#deckSelector option")].map(o => o.value);
    assert.deepEqual(options, ["Deck A", "Deck B"]);
});

// ---------------------------------------------------------------------
// Normal mode: two-step flip / advance
// ---------------------------------------------------------------------

test("normal mode: tapping the right side flips the card to its back", () => {
    const d = dom();
    tapCard(d, "right");

    const doc = d.window.document;
    assert.equal(doc.getElementById("state").textContent, "BACK");
    assert.equal(doc.getElementById("card").className, "back");
    assert.equal(doc.getElementById("card").textContent, "一\n\n━━━━━━━━━━\n\n一\nyī\none");
});

test("normal mode: tapping the right side again advances to the next card", () => {
    const d = dom();
    tapCard(d, "right"); // flip to back of card 1
    tapCard(d, "right"); // advance to card 2

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 2 of 5");
    assert.equal(doc.getElementById("state").textContent, "FRONT");
    assert.equal(doc.getElementById("card").textContent, "二");
});

test("normal mode: tapping the left side on the back flips back to the front, same card", () => {
    const d = dom();
    tapCard(d, "right"); // flip to back
    tapCard(d, "left");  // flip back to front

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 1 of 5");
    assert.equal(doc.getElementById("state").textContent, "FRONT");
});

test("normal mode: tapping the left side on the front goes to the previous card's back", () => {
    const d = dom();
    tapCard(d, "right"); tapCard(d, "right"); // now on card 2, front
    tapCard(d, "left");                       // previous card, shown as back

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 1 of 5");
    assert.equal(doc.getElementById("state").textContent, "BACK");
});

test("normal mode: cannot navigate before card 1", () => {
    const d = dom();
    tapCard(d, "left");
    tapCard(d, "left");

    assert.equal(d.window.document.getElementById("counter").textContent, "Card 1 of 5");
});

test("normal mode: wrapping past the last card reshuffles and returns to card 1", () => {
    const d = dom();
    for (let i = 0; i < VOCAB.length; i++) {
        tapCard(d, "right"); // flip
        tapCard(d, "right"); // advance
    }
    assert.equal(d.window.document.getElementById("counter").textContent, "Card 1 of 5");
});

// ---------------------------------------------------------------------
// Single-tap mode
// ---------------------------------------------------------------------

test("single-tap mode: enabling it switches the state label and shows no preview yet", () => {
    const d = dom();
    setSingleTapMode(d, true);

    const doc = d.window.document;
    assert.equal(doc.getElementById("state").textContent, "TAP TO ADVANCE");
    assert.equal(doc.getElementById("card").className, "front");
    assert.equal(doc.getElementById("card").querySelector(".prev-answer"), null);
});

test("single-tap mode: one tap moves to the next card and previews the answer just left", () => {
    const d = dom();
    setSingleTapMode(d, true);
    tapCard(d, "right");

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 2 of 5");

    const prevAnswer = doc.querySelector(".prev-answer");
    const main = doc.querySelector(".card-main");
    assert.ok(prevAnswer, "expected a previous-answer preview to be shown");
    assert.equal(prevAnswer.textContent, "一\nyī\none");
    assert.equal(main.textContent, "二");
});

test("single-tap mode: the preview always matches the card immediately before the one shown, regardless of direction", () => {
    const d = dom();
    setSingleTapMode(d, true);
    const doc = d.window.document;

    tapCard(d, "right"); // -> card 2, previews card 1
    tapCard(d, "right"); // -> card 3, previews card 2
    tapCard(d, "right"); // -> card 4, previews card 3
    tapCard(d, "right"); // -> card 5, previews card 4
    assert.equal(doc.getElementById("counter").textContent, "Card 5 of 5");

    tapCard(d, "left"); // -> card 4, should preview card 3 (NOT card 5 — this is the regression we fixed)
    assert.equal(doc.getElementById("counter").textContent, "Card 4 of 5");
    assert.equal(doc.querySelector(".prev-answer").textContent, "三\nsān\nthree");

    tapCard(d, "left"); // -> card 3, should preview card 2
    assert.equal(doc.getElementById("counter").textContent, "Card 3 of 5");
    assert.equal(doc.querySelector(".prev-answer").textContent, "二\nèr\ntwo");

    tapCard(d, "right"); // -> card 4, should preview card 3 again
    assert.equal(doc.getElementById("counter").textContent, "Card 4 of 5");
    assert.equal(doc.querySelector(".prev-answer").textContent, "三\nsān\nthree");
});

test("single-tap mode: no preview is shown once back at card 1", () => {
    const d = dom();
    setSingleTapMode(d, true);

    tapCard(d, "right"); // -> card 2
    tapCard(d, "left");  // -> card 1

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 1 of 5");
    assert.equal(doc.querySelector(".prev-answer"), null);
});

test("single-tap mode: turning it off reverts to two-step flip/advance behaviour", () => {
    const d = dom();
    setSingleTapMode(d, true);
    tapCard(d, "right"); // -> card 2 in single-tap mode
    setSingleTapMode(d, false);

    const doc = d.window.document;
    // one tap should now just flip the current card, not advance
    tapCard(d, "right");
    assert.equal(doc.getElementById("state").textContent, "BACK");
    assert.equal(doc.getElementById("counter").textContent, "Card 2 of 5");
});

// ---------------------------------------------------------------------
// getBriefAnswer parsing (exercised indirectly through the preview)
// ---------------------------------------------------------------------

test("single-tap preview: sentence cards show only the first option, not the full options list", () => {
    const d = buildDom({
        "Sentences": [
            {
                type: 4,
                front: "我喜欢吃____。",
                back:
                    "I like eating ____.\n\n我喜欢吃____。\nwǒ xǐ huān chī ____.\n\nOptions:\n\n" +
                    "1. 火锅\nhuǒ guō\nhot pot\n\n2. 苹果\npíng guǒ\napple"
            },
            { type: 1, front: "茶", back: "茶\nchá\ntea" }
        ]
    });

    setSingleTapMode(d, true);
    tapCard(d, "right"); // leave the sentence card, land on 茶

    const preview = d.window.document.querySelector(".prev-answer").textContent;
    assert.equal(preview, "火锅\nhuǒ guō\nhot pot");
    assert.ok(!preview.includes("苹果"), "should not include the second option");
    assert.ok(!preview.includes("I like eating"), "should not include the full sentence");
});

test("single-tap preview: plain vocab cards show their whole (already short) back", () => {
    const d = dom();
    setSingleTapMode(d, true);
    tapCard(d, "right");

    assert.equal(d.window.document.querySelector(".prev-answer").textContent, "一\nyī\none");
});

// ---------------------------------------------------------------------
// Deck switching
// ---------------------------------------------------------------------

test("switching decks resets to card 1 of the newly selected deck", () => {
    const d = buildDom({
        "Deck A": VOCAB,
        "Deck B": [
            { type: 1, front: "甲", back: "甲\njiǎ\nfirst" },
            { type: 1, front: "乙", back: "乙\nyǐ\nsecond" }
        ]
    });

    tapCard(d, "right"); tapCard(d, "right"); // move into Deck A a bit
    selectDeck(d, "Deck B");

    const doc = d.window.document;
    assert.equal(doc.getElementById("counter").textContent, "Card 1 of 2");
    assert.equal(doc.getElementById("state").textContent, "FRONT");
});

test("switching decks while in single-tap mode clears any answer preview", () => {
    const d = buildDom({
        "Deck A": VOCAB,
        "Deck B": [
            { type: 1, front: "甲", back: "甲\njiǎ\nfirst" },
            { type: 1, front: "乙", back: "乙\nyǐ\nsecond" }
        ]
    });

    setSingleTapMode(d, true);
    tapCard(d, "right"); // now showing a preview
    selectDeck(d, "Deck B");

    assert.equal(d.window.document.querySelector(".prev-answer"), null);
});

// ---------------------------------------------------------------------
// Long-content sizing
// ---------------------------------------------------------------------

test("normal mode: the .small class is applied once combined front+back text passes the length threshold", () => {
    const longBack = "汉字\npīn yīn\n" + "a".repeat(130);
    const d = buildDom({ "Long": [{ type: 1, front: "长", back: longBack }] });

    tapCard(d, "right"); // flip to back

    assert.ok(d.window.document.getElementById("card").classList.contains("small"));
});

test("normal mode: short content does not get the .small class", () => {
    const d = dom();
    tapCard(d, "right"); // flip to back of card 1 (short content)

    assert.ok(!d.window.document.getElementById("card").classList.contains("small"));
});

// ---------------------------------------------------------------------
// Overflow handling: scroll instead of clipping long content
// ---------------------------------------------------------------------

test("the card scrolls vertically instead of clipping when content overflows", () => {
    const d = dom();
    const style = d.window.getComputedStyle(d.window.document.getElementById("card"));

    assert.equal(style.overflowY, "auto");
});

test("normal mode: a very long back face is still fully present in the DOM (scrollable), not truncated", () => {
    const longBack = "汉字\npīn yīn\n" + "a".repeat(500);
    const d = buildDom({ "Long": [{ type: 1, front: "长", back: longBack }] });

    tapCard(d, "right"); // flip to back

    const cardMain = d.window.document.querySelector(".card-main");
    assert.equal(cardMain.textContent, "长" + "\n\n━━━━━━━━━━\n\n" + longBack);
});

test("long back content top-aligns rather than vertically centering, so the start of the text is never scrolled out of view", () => {
    const longBack = "汉字\npīn yīn\n" + "a".repeat(500);
    const d = buildDom({ "Long": [{ type: 1, front: "长", back: longBack }] });

    tapCard(d, "right"); // flip to back

    const style = d.window.getComputedStyle(d.window.document.getElementById("card"));
    assert.equal(style.alignItems, "flex-start");
});
