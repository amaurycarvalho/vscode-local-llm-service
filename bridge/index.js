import express from "express";
import { bridge } from "./BridgeService.js";

const app = express();
app.use(express.json());

app.post("/v1/chat/completions", bridge.authMiddleware, (req, res) =>
  bridge.handleChat(req, res)
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  bridge.logger.info(`[bridge] listening on ${PORT}`);
});
