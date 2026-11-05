---
title: openeye config
---

Store and read key/value settings in ~/.openeye/config.yaml.

```bash
openeye config set default-device gpu
openeye config get default-device
```

| Command | Description |
|---------|-------------|
| config set KEY VALUE | Save VALUE under KEY (stored as a string) |
| config get KEY | Print KEY = value; exits with code 1 if KEY is not set |

Keys are free-form; the file is plain YAML, so you can also edit it by hand. The built-in commands don't read any of these keys yet, so settings such as default-device are for your own scripts for now.

### Related settings

- Model weights live in ~/.openeye/models/
- Server URLs and keys come from environment variables (OPENEYE_SERVER_URL, OPENEYE_API_URL, OPENEYE_API_KEY, OPENEYE_FLEET_URL, OPENEYE_TOKEN) — see Environment Variables
- A running server's runtime config is separate: use openeye server-config-get and openeye server-config-set <key> <value>
- MLOps state (registry, promotions, A/B tests, exports, ...) is stored as YAML files in ~/.openeye/
