import WebSocket from "ws";

const list = await fetch("http://127.0.0.1:9222/json/list").then((r) => r.json());
const page = list.find((t) => t.type === "page" && String(t.url).includes("window=launcher"));
if (!page) {
  console.log("NO_PAGE", list.map((t) => t.url));
  process.exit(1);
}
console.log("PAGE", page.url);

const failed = [];
const exceptions = [];
const logs = [];

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("open timeout")), 5000);
  ws.on("open", () => {
    clearTimeout(t);
    resolve();
  });
  ws.on("error", reject);
});

ws.on("message", (d) => {
  const msg = JSON.parse(d.toString());
  if (msg.method === "Network.responseReceived") {
    const r = msg.params.response;
    if (r.status >= 400) failed.push(`${r.status} ${r.url}`);
  }
  if (msg.method === "Network.loadingFailed") {
    failed.push(`LOADFAIL ${msg.params.errorText}`);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    exceptions.push(
      msg.params.exceptionDetails.exception?.description ||
        msg.params.exceptionDetails.text
    );
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description).join(" ");
    logs.push(`${msg.params.type}: ${text}`);
    if (msg.params.type === "error") exceptions.push(text);
  }
  if (msg.id === 99) {
    console.log("STATE", JSON.stringify(msg.result?.result?.value, null, 2));
    console.log("FAILED", failed);
    console.log("EXC", exceptions);
    console.log("LOGS", logs.slice(-40));
    ws.close();
    process.exit(0);
  }
});

ws.send(JSON.stringify({ id: 1, method: "Network.enable" }));
ws.send(JSON.stringify({ id: 2, method: "Runtime.enable" }));
ws.send(JSON.stringify({ id: 3, method: "Console.enable" }));
ws.send(JSON.stringify({ id: 4, method: "Page.reload", params: { ignoreCache: true } }));

setTimeout(() => {
  ws.send(
    JSON.stringify({
      id: 99,
      method: "Runtime.evaluate",
      params: {
        expression: `({
          ready: document.readyState,
          children: document.getElementById('root')?.childElementCount ?? -1,
          platform: document.documentElement.getAttribute('data-platform'),
          scripts: [...document.scripts].map(s => s.src || 'inline')
        })`,
        returnByValue: true,
      },
    })
  );
}, 25000);

setTimeout(() => {
  console.log("TIMEOUT");
  console.log({ failed, exceptions, logs: logs.slice(-50) });
  process.exit(1);
}, 40000);
