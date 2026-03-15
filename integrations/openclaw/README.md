# OpenClaw Integrations

Skills that give [OpenClaw](https://clawhub.dev) agents access to OpenEye capabilities.

| Skill | Description |
|---|---|
| `openeye-perception` | Hosted Inference API — object detection, depth estimation, scene description via REST |

## Local Testing

```bash
# 1. Set environment variables
export OPENEYE_API_KEY="oe_test_xxx"
export OPENEYE_API_URL="https://api.openeye.ai"  # optional, defaults to this

# 2. Run a script directly
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
- `scripts/` — Executable tools the agent can invoke
- `references/` — Detailed docs the agent can read for context
