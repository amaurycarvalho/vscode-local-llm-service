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
        options.serviceName || process.env.BRIDGE_SERVICE_NAME || "llm-bridge",
      apiKey: options.apiKey || process.env.BRIDGE_API_KEY,
    };

    this.logger = new LoggerHelper(this.config.serviceName);
    this.ollama = new OllamaHelper();
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
          "BRIDGE_API_KEY not found in this environment. Use this one into your client.",
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
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token || token !== process.env.BRIDGE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  /**
   * OpenAI compatible chat completions router helper
   */
  async handleChat(req, res) {
    try {
      let helper = this.ollama.getHelperFromRequest(req, res);

      if (helper.answer.model === "default.chat") {
        helper.answer.model = process.env.OLLAMA_LLM_CHAT;
      } else if (helper.answer.model === "default.edit") {
        helper.answer.model = process.env.OLLAMA_LLM_EDIT;
      } else if (helper.answer.model === "default.apply") {
        helper.answer.model = process.env.OLLAMA_LLM_APPLY;
      } else if (helper.answer.model === "default.autocomplete") {
        helper.answer.model = process.env.OLLAMA_LLM_AUTOCOMPLETE;
      } else if (helper.answer.model === "default.embed") {
        helper.answer.model = process.env.OLLAMA_LLM_EMBED;
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
