# OpenClaw Integrations

Skills that give [OpenClaw](https://clawhub.dev) agents access to OpenEye capabilities.

| Skill | Description |
|---|---|
| `openeye-perception` | Hosted inference API at `https://openeye.sh/v1` — object detection, credits and model listing via REST; optional self-hosted fleet queries |
| [`../../openclaw-skill/openeye`](../../openclaw-skill/openeye) | The `openeye` CLI — local models, `openeye serve`, `openeye api`, fleet |

## Local Testing

```bash
# 1. Set environment variables
export OPENEYE_API_KEY="oe_..."                 # from https://openeye.sh/dashboard/settings/api-keys
export OPENEYE_API_URL="https://openeye.sh"     # optional; this is the default
# export OPENEYE_API_URL="http://localhost:8000"  # or a local `openeye serve <model>`

# 2. Run a script directly
python3 integrations/openclaw/openeye-perception/scripts/usage.py models
python3 integrations/openclaw/openeye-perception/scripts/detect.py photo.jpg

# 3. Validate the skill manifest (requires clawhub CLI)
clawhub validate ./integrations/openclaw/openeye-perception
```

## Publishing to ClawHub

```bash
cd integrations/openclaw
clawhub publish ./openeye-perception
```

## Skill Structure

Each skill directory contains:

- `SKILL.md` — Frontmatter metadata + agent-facing instructions
- `scripts/` — Executable tools the agent can invoke (`openeye_api.py` holds the shared HTTP client)
- `references/` — Detailed docs the agent can read for context
