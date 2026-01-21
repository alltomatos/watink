"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHttpServer = startHttpServer;
const http_1 = require("http");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function startHttpServer() {
    const port = Number(process.env.PORT || 3334);
    const server = (0, http_1.createServer)(async (req, res) => {
        if (req.method === "GET" && req.url === "/version") {
            let version = "0.0.0";
            try {
                const pkgPath = path_1.default.join(process.cwd(), "package.json");
                if (fs_1.default.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, "utf-8"));
                    version = pkg.version || version;
                }
            }
            catch { }
            const lastUpdated = process.env.BUILD_TIMESTAMP ||
                new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.statusCode = 200;
            res.end(JSON.stringify({
                service: "whaileys-engine",
                version,
                lastUpdated,
            }));
            return;
        }
        res.statusCode = 404;
        res.end("Not Found");
    });
    server.listen(port, () => { });
}
