import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.WEB_PORT ?? 4318);

export function createStaticWebServer(baseDirectory = root) {
  const resolvedBaseDirectory = resolve(baseDirectory);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
      const pathname =
        url.pathname === "/" ? "/apps/web/index.html" : url.pathname;
      const filePath = resolve(
        resolvedBaseDirectory,
        normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, ""),
      );

      if (!filePath.startsWith(resolvedBaseDirectory)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const fileStat = await stat(filePath);

      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": getContentType(filePath),
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/serve-web.mjs")) {
  createStaticWebServer().listen(port, () => {
    console.log(`PickMeMaybe web preview: http://localhost:${port}/apps/web/index.html`);
  });
}
