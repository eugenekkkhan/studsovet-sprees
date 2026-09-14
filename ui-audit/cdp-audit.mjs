import { writeFile } from "node:fs/promises";

const pages = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const page = pages.find((entry) => entry.type === "page");
if (!page) throw new Error("No Chrome page target");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error ? handler.reject(message.error) : handler.resolve(message.result);
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.argv[2] ?? "http://127.0.0.1:5175/quiz";
const clickLabels = process.argv[3]?.split("|").filter(Boolean) ?? [];
const output = process.argv[4] ?? "ui-audit/screen.png";
const [viewportWidth, viewportHeight] = (process.argv[5] ?? "1440x1200")
  .split("x")
  .map(Number);

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url });
await sleep(800);

for (const clickLabel of clickLabels) {
  await evaluate(`(() => {
    const element = [...document.querySelectorAll('button, summary, a')]
      .find((node) => node.textContent.trim().includes(${JSON.stringify(clickLabel)}));
    if (!element) throw new Error('Element not found: ' + ${JSON.stringify(clickLabel)});
    element.click();
  })()`);
  await sleep(350);
}

const audit = await evaluate(`(() => [...document.querySelectorAll('.ui-card')].map((card, cardIndex) => {
  const cardStyle = getComputedStyle(card);
  const cardRect = card.getBoundingClientRect();
  const controls = [...card.querySelectorAll('.ui-button, .ui-card-control')]
    .filter((control) => control.closest('.ui-card') === card)
    .map((control) => {
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return {
        tag: control.tagName.toLowerCase(),
        text: control.textContent.trim().slice(0, 45),
        radius: style.borderTopLeftRadius,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
  return {
    cardIndex,
    text: card.textContent.trim().replace(/\\s+/g, ' ').slice(0, 70),
    radius: cardStyle.borderTopLeftRadius,
    padding: cardStyle.paddingTop,
    width: Math.round(cardRect.width),
    controls,
  };
}))()`);

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
});
await writeFile(output, Buffer.from(screenshot.data, "base64"));
await writeFile(output.replace(/\.png$/, ".json"), JSON.stringify(audit, null, 2));
socket.close();
