# vscode-local-llm-service
Local LLM Integration for VSCode via Ollama and Node.js Bridge (HTTPS + Auth Key)

> ⚠️ *Warning*: configure `LLM_BRIDGE_API_KEY` in the `.env` file before deploy it to any production environment.

## 📖 User's Guide

### Introduction

Current paid LLM services are expensive, so it's a good idea to reserve them only for architectural modeling, security code reviews, and sensitive code refactorings (optimizations or fixes). All other needs, such as questions about technical programming doubts, simple code assistance, and autocompletes, can be directed to a free local LLM model.

Additionally, local LLM services like Ollama only expose plain HTTP connections, making them insecure even on a local network.

This project demonstrates how to connect VSCode to a local LLM service running on Ollama via HTTPS, using a Node.js bridge that converts responses into an OpenAI-compatible format and implements the necessary authorization keys for more secure use.

You can easily run this setup locally with Docker and adapt it to your own environment.

> ⚠️ *Warning*: Some LLM models can be very slow on low-spec or cost-effective machines.

---

### ⚡ Quick start

#### ⚙️ Bridge configuration

1. Create a `.env` file in the project root (see the example below);
2. Write a key into `LLM_BRIDGE_API_KEY` to protect your local LLM service;
3. Choose your preferred model for `OLLAMA_LLM_CHAT` environment variable.


```
# Ollama models
LLM_CODER_ULTRA_LIGHT=qwen2.5-coder:0.5b
LLM_CODER_LIGHT=deepseek-coder:1.3b
LLM_CODER_MODERATE=deepseek-coder:6.7b
LLM_CODER_FULL=deepseek-coder-v2:16b
LLM_CHAT_ULTRA_LIGHT=qwen3:0.6b
LLM_CHAT_LIGHT=deepseek-r1:1.5b
LLM_CHAT_MODERATE=deepseek-r1:7b
LLM_CHAT_FULL=deepseek-r1:14b
LLM_EMBED_ULTRA_LIGHT=qwen3-embedding:0.6b
LLM_EMBED_LIGHT=nomic-embed-text:v1.5

# Ollama setup
OLLAMA_HOST=http://ollama:11434
OLLAMA_DEFAULT_MODEL=${LLM_CHAT_ULTRA_LIGHT}
OLLAMA_LLM_CHAT=${LLM_CODER_ULTRA_LIGHT}
OLLAMA_LLM_AUTOCOMPLETE=${LLM_CODER_ULTRA_LIGHT}
OLLAMA_LLM_EMBED=${LLM_EMBED_ULTRA_LIGHT}

# LLM bridge setup
LLM_BRIDGE_SERVICE_NAME=llm-bridge
LLM_BRIDGE_PORT=3001
LLM_BRIDGE_API_KEY=write-here-your-own-bridge-api-key
LLM_BRIDGE_LOG_LEVEL=info
```

> 📌 *Note*:  
> See `.env.example` for a more complete configuration.

#### 🧱 Build containers

```
sudo docker-compose build
```

#### ▶️ Start the stack

```
sudo docker-compose up -d
```

#### 🛑 Stopping the stack

```
sudo docker-compose down
```

---

### 👉 VSCode integration

#### ⚙️ Setting Up the Local Assistant in VSCode with Continue plugin
1. Install and enable the [Continue - open-source AI code agent](https://continue.dev/) extension in VSCode;
2. Click on the *Continue* icon in the left-hand toolbar;
3. In the Continue *Chat* tab, click the *Open Settings* icon (⚙️);
4. Select the *Configs* paper icon in the left-hand new toolbar and click the *Local Config* icon (⚙️);
5. Add the following to your `.continue/config.yaml` file and save it.

```
name: Local Assistant
version: 1.0.0
schema: v1
models:
  - name: Local Chat Model
    provider: openai
    model: OLLAMA_LLM_CHAT
    apiBase: https://localhost:3001/v1
    apiKey: write-here-your-own-bridge-api-key
    roles:
      - chat
      - edit
      - apply
    requestOptions:
      verifySsl: false

  - name: Local Autocomplete Model
    provider: openai
    model: OLLAMA_LLM_AUTOCOMPLETE
    apiBase: https://localhost:3001/v1
    apiKey: write-here-your-own-bridge-api-key
    roles:
      - autocomplete
    requestOptions:
      verifySsl: false

  - name: Local Embed Model
    provider: openai
    model: OLLAMA_LLM_EMBED
    apiBase: https://localhost:3001/v1
    apiKey: write-here-your-own-bridge-api-key
    roles:
      - embed
    requestOptions:
      verifySsl: false

context:
  - provider: code
  - provider: docs
  - provider: diff
  - provider: terminal
  - provider: problems
  - provider: folder
  - provider: codebase

defaultModel:
  chat: Local Chat Model
  edit: Local Chat Model
  apply: Local Chat Model
  autocomplete: Local Autocomplete Model
  embed: Local Embed Model

```

> 📌 *Note*:  
> 1. Change `apiKey` to the same `LLM_BRIDGE_API_KEY` value key you put in the `.env` file;  
> 2. See `config.yaml.example` in the project repository for a more complete configuration.

#### ✅ Testing

1. Select the model:  
   In the Chat section, choose *Local Chat Model* and click *Back*.
2. Test the assistant:  
   Type *Hello* in the chat and wait for the response from your local LLM model.

Inside VSCode, try prompts like:

- "Hello!"
- "What do you know about Node.js?"


## 🧑‍💻 Developer Guide

### 🧩 Stack Overview:

| Name | Description | URL |
|---|---|---|
| Ollama | Local LLM server | - |
| Nginx | HTTPS proxy reverse | - |
| Bridge | Node.js OpenAI-like proxy | https://localhost:3001/v1 |

---

### 🪵 Logs

#### Container logs

```
sudo docker-compose logs | grep 'bridge[[:space:]]*|'
```

> 📌 *Note*: change `.env` LOG_LEVEL environment variable to see more logs.

---

### ⚙️ Operations

#### Restart all containers

```
sudo docker-compose restart
```

#### Manual testing

```
curl -X POST https://localhost:3001/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $LLM_BRIDGE_API_KEY" --insecure -d '{"messages": [{ "role": "user", "content": "Hello" }]}'
```

#### Want to run it on a centered server?

1. Run the container on the server;
2. Configure `apiBase` in the user's `.continue/config.yaml` to point to your server URL. Example: `https://yourserver:3001/v1`.

#### Want to run a different Ollama's LLM model?

For all users:

1. Change the `OLLAMA_LLM_CHAT` value in the `.env` file on the server, either to a valid Ollama model name or to one of the predefined environment variables;
2. Restart the container.

For a group of users:

1. Change `OLLAMA_DEFAULT_MODEL` in the `.env` file;
2. Restart the container;
3. Change the `model` value in the user's `.continue/config.yaml` file, pointing to `OLLAMA_DEFAULT_MODEL`.

For a specific user only:

1. Manually download the new model to the server (see below) or change `docker-compose.yml` inserting a new `ollama pull` in the `ollama-init` service and restart the container;
2. Change the `model` value in the user's `.continue/config.yaml` file, pointing to the correct model name.

##### Downloading and testing a new LLM model:

```
sudo docker exec -it ollama sh
ollama pull deepseek-r1:1.5b
ollama list
ollama run deepseek-r1:1.5b "Hello"
exit
```

---

### 📌 Additional Notes

- All components are pulled from the latest Docker images. If upstream versions change, review and update `docker-compose.yml` and related configs to maintain compatibility.

---

## 📚 References & Further Reading

### 🔗 [Ollama](https://ollama.com/)
- [Deepseek R1](https://ollama.com/library/deepseek-r1) LLM model.

### 🔗 [VSCode](https://code.visualstudio.com/)
- [Continue - open-source AI code agent](https://continue.dev/) extension.

