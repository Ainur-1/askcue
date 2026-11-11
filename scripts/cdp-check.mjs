import WebSocket from "ws";

const list = await fetch("http://127.0.0.1:9222/json/list").then((r) => r.json());
const pages = list.filter((t) => t.type === "page" && String(t.url).includes("5180"));
console.log(
  "PAGES",
  pages.map((p) => p.url)
);

async function inspect(page) {
  return new Promise((resolve) => {
    const logs = [];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const timer = setTimeout(() => {
      ws.close();
      resolve({ url: page.url, timeout: true, logs });
    }, 8000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Console.enable" }));
      ws.send(JSON.stringify({ id: 3, method: "Network.enable" }));
      ws.send(
        JSON.stringify({
          id: 4,
          method: "Runtime.evaluate",
          params: {
            expression: `({
              title: document.title,
              ready: document.readyState,
              root: !!document.getElementById('root'),
              children: document.getElementById('root')?.childElementCount ?? -1,
              bodyText: (document.body?.innerText || '').slice(0,120),
              bodyHTML: (document.body?.innerHTML || '').slice(0,300),
              platform: document.documentElement.getAttribute('data-platform'),
              theme: document.documentElement.getAttribute('data-theme'),
              scriptCount: document.scripts.length,
            })`,
            returnByValue: true,
          },
        })
      );
    });

    ws.on("message", (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.method === "Runtime.exceptionThrown") {
        const e = msg.params.exceptionDetails;
        logs.push("EX: " + (e.exception?.description || e.text));
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        logs.push(
          msg.params.type +
            ": " +
            msg.params.args.map((a) => a.value ?? a.description).join(" ")
        );
      }
      if (msg.id === 4) {
        clearTimeout(timer);
        setTimeout(() => {
          ws.close();
          resolve({
            url: page.url,
            state: msg.result?.result?.value,
            evalErr: msg.result?.exceptionDetails || null,
            logs: logs.slice(0, 20),
          });
        }, 500);
      }
    });
  });
}

for (const p of pages) {
  const r = await inspect(p);
  console.log(JSON.stringify(r, null, 2));
}
