import test from "node:test";
import assert from "node:assert/strict";

import { runDemoSmoke } from "../scripts/demo-smoke.mjs";

test("runDemoSmoke validates local API and web demo readiness", async () => {
  const result = await runDemoSmoke();

  assert.match(result.apiUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(result.webUrl, /^http:\/\/127\.0\.0\.1:\d+\/apps\/web\/index\.html$/);
  assert.equal(typeof result.faceResourceCount, "number");
});
