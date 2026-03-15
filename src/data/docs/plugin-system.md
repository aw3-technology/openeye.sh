---
title: Plugin System
---

All components are loaded dynamically via plugin loaders:

| Loader | Purpose |
|--------|---------|
| load_input() | Load sensor plugins (VLM, camera, video) |
| load_llm() | Load LLM providers (OpenAI, Gemini) |
| load_action() | Load action plugins |
| load_simulator() | Load simulators |
| load_background() | Load background tasks |

### Providers (Singletons)

Thread-safe singleton providers manage shared state:

| Provider | Description |
|----------|-------------|
| IOProvider | Input/output buffer with thread-safe access, tick counter, fuser/LLM state |
| SleepTickerProvider | Async sleep with cancellation support |
| ConfigProvider | Runtime configuration |
| EventBus | Pub/sub event system |
