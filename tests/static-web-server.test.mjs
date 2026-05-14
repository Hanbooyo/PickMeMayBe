import test from "node:test";
import assert from "node:assert/strict";

import { createStaticWebServer } from "../scripts/serve-web.mjs";

test("static web server serves the manual preview page", async () => {
  const server = createStaticWebServer(process.cwd());
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/apps/web/index.html`,
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /PickMeMaybe Manual Preview/);
    assert.match(body, /입력 관리/);
    assert.match(body, /추첨 방송/);
    assert.match(body, /연출 시간/);
    assert.match(body, /Face resources/);
    assert.match(body, /Asset matches/);
    assert.match(body, /Running race/);
    assert.match(body, /Render outputs/);
    assert.match(body, /Render job history/);
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
