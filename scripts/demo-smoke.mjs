import { createApiServer } from "../dist/apps/api/src/index.js";
import { createStaticWebServer } from "./serve-web.mjs";

export async function runDemoSmoke({
  apiServer = createApiServer(),
  webServer = createStaticWebServer(process.cwd()),
} = {}) {
  await listen(apiServer);
  await listen(webServer);

  try {
    const apiPort = getPort(apiServer);
    const webPort = getPort(webServer);

    const health = await fetch(`http://127.0.0.1:${apiPort}/health`);
    const healthPayload = await health.json();
    assertStatus(health, 200, "API health");

    if (healthPayload.status !== "ok") {
      throw new Error("API health response is not ok.");
    }

    const web = await fetch(`http://127.0.0.1:${webPort}/apps/web/index.html`);
    const html = await web.text();
    assertStatus(web, 200, "Web page");

    for (const marker of [
      "PickMeMaybe Manual Preview",
      "Face resources",
      "Asset matches",
      "Render outputs",
      "Render job history",
    ]) {
      if (!html.includes(marker)) {
        throw new Error(`Web page does not include marker: ${marker}`);
      }
    }

    const resources = await fetch(`http://127.0.0.1:${apiPort}/api/resources/faces`);
    const resourcesPayload = await resources.json();
    assertStatus(resources, 200, "Face resources");

    if (!Array.isArray(resourcesPayload.resources)) {
      throw new Error("Face resources response is invalid.");
    }

    return {
      apiUrl: `http://127.0.0.1:${apiPort}`,
      webUrl: `http://127.0.0.1:${webPort}/apps/web/index.html`,
      faceResourceCount: resourcesPayload.resources.length,
    };
  } finally {
    await close(apiServer);
    await close(webServer);
  }
}

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

function getPort(server) {
  const address = server.address();

  if (!address || typeof address !== "object") {
    throw new Error("Server did not expose a TCP address.");
  }

  return address.port;
}

function assertStatus(response, expectedStatus, label) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/demo-smoke.mjs")) {
  runDemoSmoke()
    .then((result) => {
      console.log("PickMeMaybe demo smoke passed.");
      console.log(`API: ${result.apiUrl}`);
      console.log(`Web: ${result.webUrl}`);
      console.log(`Face resources: ${result.faceResourceCount}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
