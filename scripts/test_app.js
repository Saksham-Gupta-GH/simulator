const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('src/web/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded");
});
dom.window.addEventListener("error", (event) => {
  console.error("PAGE ERROR:", event.error);
});
setTimeout(() => {
    console.log("Wait complete");
    process.exit(0);
}, 2000);
