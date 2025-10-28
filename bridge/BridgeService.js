import crypto from "crypto";
import { LoggerHelper } from "./helpers/LoggerHelper.js";
import { OllamaHelper } from "./helpers/OllamaHelper.js";

/**
 * Bridge Service
 * VSCode and Ollama LLM integration specialized class
 */
export class BridgeService {
  /**
   * @param {object} options
   * @param {string} [options.serviceName] - service name
   */
  constructor(options = {}) {
    this.config = {
      serviceName:
        options.serviceName ||
        process.env.LLM_BRIDGE_SERVICE_NAME ||
        "llm-bridge",
      authKey: options.authKey || process.env.LLM_BRIDGE_AUTH_KEY,
      apiKey: options.apiKey || process.env.LLM_BRIDGE_API_KEY,
    };

    this.logger = new LoggerHelper(this.config.serviceName, {
      level: process.env.LLM_BRIDGE_LOG_LEVEL,
    });
    this.ollama = new OllamaHelper({
      logLevel: process.env.LLM_BRIDGE_LOG_LEVEL,
    });
  }

  /***
   * service initializer
   */
  async init() {
    try {
      this.logger.info(
        `[bridge] ${this.config.serviceName} service initialized`
      );
      if (this.config.apiKey.length === 0) {
        this.config.apiKey = crypto.randomBytes(32).toString("hex");
        this.logger.warn(
          "LLM_BRIDGE_API_KEY not found in this environment. Use this one into your client.",
          { key: this.config.apiKey }
        );
      }
    } catch (err) {
      this.logger.error(
        `[bridge] ${this.config.serviceName} service initialization failed`,
        {
          error: err.message,
        }
      );
      throw err;
    }
    return this;
  }

  /***
   * Authorization middleware
   */
  authMiddleware(req, res, next) {
    const authKey = req.headers.authorization?.replace("Bearer ", "");
    const apiKey = req?.body?.prompt?.apiKey;
    if (!authKey || authKey !== process.env.LLM_BRIDGE_API_KEY) {
      if (!apiKey || apiKey !== process.env.LLM_BRIDGE_API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    next();
  }

  /***
   * Enforce HTTPS middleware
   */
  enforceHttps(req, res, next) {
    const proto = req.headers["x-forwarded-proto"];
    if (proto !== "https" || !req.secure) {
      return res.status(403).json({ error: "HTTPS required" });
    }
    next();
  }

  /**
   * OpenAI compatible chat completions router helper
   */
  async handleChat(req, res) {
    try {
      let helper = this.ollama.getHelperFromRequest(req, res);

      if (helper.answer.model === "OLLAMA_LLM_CHAT") {
        helper.answer.model = process.env.OLLAMA_LLM_CHAT;
      } else if (helper.answer.model === "OLLAMA_LLM_AUTOCOMPLETE") {
        helper.answer.model = process.env.OLLAMA_LLM_AUTOCOMPLETE;
      } else if (helper.answer.model === "OLLAMA_LLM_EMBED") {
        helper.answer.model = process.env.OLLAMA_LLM_EMBED;
      } else if (helper.answer.model === "OLLAMA_DEFAULT_MODEL") {
        helper.answer.model = process.env.OLLAMA_DEFAULT_MODEL;
      }

      await this.ollama.answerChat(helper);
    } catch (err) {
      this.logger.error("[bridge] internal error", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.end();
      }
    }
  }
}

// bridge service router instance
export const bridge = await new BridgeService().init();
