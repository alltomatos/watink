import { createServer, IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";

export function startHttpServer() {
  const port = Number(process.env.PORT || 3334);
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/version") {
      let version = "0.0.0";
      try {
        const pkgPath = path.join(process.cwd(), "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          version = pkg.version || version;
        }
      } catch {}
      const lastUpdated =
        process.env.BUILD_TIMESTAMP ||
        new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          service: "whaileys-engine",
          version,
          lastUpdated,
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
  });
  server.listen(port, () => {});
}

