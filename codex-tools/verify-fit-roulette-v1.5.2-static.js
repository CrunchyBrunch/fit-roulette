const assert = require("assert");
const fs = require("fs");
const path = require("path");

require("./verify-fit-roulette-v1.5.1-static.js");

const css = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");
const labelRule = css.match(/\.segmented-control label\s*\{([\s\S]*?)\}/)?.[1] || "";
const inputRule = css.match(/\.segmented-control input\s*\{([\s\S]*?)\}/)?.[1] || "";
const dialogRule = css.match(/\.item-dialog\s*\{([\s\S]*?)\}/)?.[1] || "";

assert.match(labelRule, /position:\s*relative/, "Segmented labels must contain their native inputs.");
assert.match(inputRule, /position:\s*absolute/, "Segmented native inputs must remain positioned within their labels.");
for (const property of ["width", "min-width", "max-width", "height", "min-height", "max-height"]) {
  assert.match(inputRule, new RegExp(`${property}:\\s*1px`), `Segmented native input ${property} must be explicitly constrained.`);
}
for (const property of ["margin", "padding", "border"]) {
  assert.match(inputRule, new RegExp(`${property}:\\s*0`), `Segmented native input ${property} must not create overflow.`);
}
assert.match(inputRule, /overflow:\s*hidden/, "Segmented native input content must be contained.");
assert.match(inputRule, /clip:\s*rect\(0 0 0 0\)/, "Segmented native inputs must use non-destructive visual clipping.");
assert.match(inputRule, /clip-path:\s*inset\(50%\)/, "Segmented native inputs must retain robust visual clipping.");
assert.match(inputRule, /pointer-events:\s*none/, "Visible labels must remain the pointer target.");
assert.doesNotMatch(inputRule, /display:\s*none|visibility:\s*hidden/, "Native inputs must remain in the accessibility tree.");
assert.doesNotMatch(dialogRule, /overflow-x:\s*hidden/, "The dialog must not conceal horizontal overflow.");
assert.match(css, /@media \(max-width: 359px\)[\s\S]*?\.dialog-header,[\s\S]*?\.dialog-actions\s*\{[\s\S]*?margin-inline:\s*-10px;[\s\S]*?padding-inline:\s*10px;/, "Narrow sticky controls must match the form's responsive inline padding.");

console.log(JSON.stringify({ ok: true, segmentedInputDimensions: "1px", accessibilityTree: true }));
