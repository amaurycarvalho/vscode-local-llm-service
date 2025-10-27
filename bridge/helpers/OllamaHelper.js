import crypto from "crypto";
import { Ollama } from "ollama";
import { LoggerHelper } from "./LoggerHelper.js";

/**
 * Ollama Helper class
 */
export class OllamaHelper {
  /**
   * @param {string} [ollamaHost] - Ollama URL
   * @param {string} [logLevel] - log level
   */
  constructor(options = {}) {
    const logLevel = options.logLevel || process.env.LOG_LEVEL || "info";
    const ollamaHost =
      options.ollamaHost || process.env.OLLAMA_HOST || "http://ollama:11434";
    this.logger = new LoggerHelper("Ollama", { level: logLevel });
    this.ollama = new Ollama({ host: ollamaHost });

    this.logger.debug("[ollama] LLM service initialized", {
      host: ollamaHost,
    });
  }

  /***
   * Get helper object from HTTP request
   * @param req HTTP request object
   * @param res HTTP response object
   * @returns helper object
   * helper: { prompt, answer, res }
   * prompt: { model, stream, messages: [ { role: "user", content: "text"} ] }
   * answer: { id, created, stream, model, defaultModel, content }
   */
  getHelperFromRequest(req, res) {
    try {
      const body = req.body;
      const prompt = body.messages
        ? body
        : body.prompt || body.input || JSON.stringify(body);
      const defaultModel = process.env.OLLAMA_LLM_DEFAULT || "deepseek-r1:1.5b";
      let answer = {
        id: "",
        created: 0,
        stream: (prompt.stream || body.stream) === true,
        model: prompt.model || defaultModel,
        defaultModel,
        content: "",
      };

      if (answer.model.trim() === "" || answer.model === "default") {
        answer.model = defaultModel;
      }

      this.logger.debug("[ollama] prompt received", { prompt });

      return { prompt, answer, res };
    } catch (err) {
      this.logger.error("[ollama] internal error", { error: err.message });
      throw err;
    }
  }

  /**
   * LLM caller (Ollama API helper)
   * @param prompt Prompt object { model, messages: [{ role: "user", content: "text" }] }
   * @returns LLM answer text
   */
  async callLLM(prompt) {
    try {
      const response = await this.ollama.chat({
        model: prompt.model,
        messages: prompt.messages,
        stream: false,
      });
      return response?.message?.content || JSON.stringify(response);
    } catch (err) {
      this.logger.error("[ollama] LLM call failed", {
        error: err.message,
        prompt,
      });
      throw err;
    }
  }

  /**
   * OpenAI compatible chat completions router helper
   * @param helper Helper object
   */
  async answerChat(helper) {
    try {
      helper.answer.id = `chatcmpl-${crypto.randomUUID()}`;
      helper.answer.created = Math.floor(Date.now() / 1000);

      if (helper.answer.stream) {
        this.logger.debug(
          "[ollama] response as stream requested by the chat client"
        );
        this.setupStream(helper);
      }

      const response = await this.processPrompt(helper);

      if (!helper.answer.stream) {
        helper.res.json(response);
      }
    } catch (err) {
      this.logger.error("[ollama] internal error", {
        error: err.message,
        answer: helper.answer,
        prompt: helper.prompt,
      });
      if (!helper.res.headersSent) {
        helper.res.status(500).json({ error: err.message });
      } else {
        helper.res.end();
      }
    }
  }

  /**
   * Prompt processor helper
   * @param helper Helper object
   */
  async processPrompt(helper) {
    if (helper.answer.stream) {
      if (!helper.answer.content || helper.answer.content.trim() === "") {
        this.logger.debug("[ollama] asking LLM for a streaming response", {
          model: helper.answer.model,
        });
        helper.answer.content = await this.streamLLMResponse(helper);
      } else {
        this.writeStreamChunk(helper, helper.answer.content);
      }
      this.endStream(helper);
      this.logger.debug("[ollama] LLM answer", {
        message: helper.answer.content,
      });
      return {};
    } else {
      if (!helper.answer.content || helper.answer.content.trim() === "") {
        this.logger.debug("[ollama] asking LLM for a response", {
          model: helper.answer.model,
        });
        helper.answer.content = await this.callLLM({
          model: helper.answer.model,
          messages: helper.prompt.messages,
        });
      }
      this.logger.debug("[ollama] LLM answer", {
        message: helper.answer.content,
      });
      return this.createResponse(helper);
    }
  }

  /***
   * Non streaming chat completion response helper
   * @param helper Helper object
   */
  createResponse(helper) {
    return {
      id: helper.answer.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: helper.answer.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: helper.answer.content },
          finish_reason: "stop",
        },
      ],
      usage: {},
    };
  }

  /**
   * Chat completion streaming header setup (SSE)
   */
  setupStream(helper) {
    helper.res.setHeader("Content-Type", "text/event-stream");
    helper.res.setHeader("Cache-Control", "no-cache");
    helper.res.setHeader("Connection", "keep-alive");
    helper.res.write(
      `data: ${JSON.stringify({
        id: helper.answer.id,
        object: "chat.completion.chunk",
        created: helper.answer.created,
        model: helper.answer.model,
        choices: [{ index: 0, delta: { role: "assistant" } }],
      })}\n\n`
    );
  }

  /**
   * Chat completion streaming chunk writer (SSE)
   */
  writeStreamChunk(helper, content) {
    helper.res.write(
      `data: ${JSON.stringify({
        id: helper.answer.id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: helper.answer.model,
        choices: [{ index: 0, delta: { content } }],
      })}\n\n`
    );
  }

  /**
   * Finalize chat completion streaming (SSE)
   */
  endStream(helper) {
    helper.res.write(
      `data: ${JSON.stringify({
        id: helper.answer.id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: helper.answer.model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`
    );
    helper.res.write("data: [DONE]\n\n");
    helper.res.end();
  }

  /**
   * Chat completion streaming response
   */
  async streamLLMResponse(helper) {
    helper.answer.content = "";

    try {
      for await (const chunk of await this.ollama.chat({
        model: helper.answer.model,
        messages: helper.prompt.messages,
        stream: true,
      })) {
        if (chunk.message?.content) {
          this.writeStreamChunk(helper, chunk.message?.content);
          helper.answer.content += chunk.message?.content;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      helper.answer.content = "[ollama] error in streaming";
      this.logger.error(helper.answer.content, {
        error: err.message,
        answer: helper.answer,
        prompt: helper.prompt,
      });
      this.writeStreamChunk(helper, helper.answer.content);
    }
    return helper.answer.content;
  }
}
