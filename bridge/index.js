import express from "express";
import { bridge } from "./BridgeService.js";

const app = express();

app.set("trust proxy", "loopback, linklocal, uniquelocal");

app.use(express.json());
app.use(bridge.enforceHttps);
app.use(bridge.authMiddleware);

app.post("/v1/chat/completions", (req, res) => bridge.handleChat(req, res));

const PORT = process.env.LLM_BRIDGE_PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  bridge.logger.info(`[bridge] listening on ${PORT}`);
});
