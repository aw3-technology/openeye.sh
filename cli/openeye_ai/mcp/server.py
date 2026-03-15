"""OpenEye MCP server — desktop vision tools via stdio transport."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _parse_region(region_str: str | None) -> tuple[int, int, int, int] | None:
    """Parse 'left,top,width,height' into a tuple, or return None."""
    if not region_str:
        return None
    parts = [int(x.strip()) for x in region_str.split(",")]
    if len(parts) != 4:
        raise ValueError(f"Invalid region: {region_str}")
    return tuple(parts)  # type: ignore[return-value]


async def run_mcp_server(monitor: int = 1, vlm_model: str | None = None) -> None:
    """Start the MCP server on stdio transport."""
    import os

    if vlm_model:
        os.environ["NEBIUS_MODEL"] = vlm_model

    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import TextContent, ImageContent, Tool

    server = Server("openeye-desktop")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="capture_screen",
                description=(
                    "Capture a screenshot of the desktop. Returns the image as base64 JPEG. "
                    "Use this to see what's currently on screen."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "monitor": {
                            "type": "integer",
                            "description": "Monitor index (1=primary, 2+=secondary). Default: 1",
                            "default": 1,
                        },
                        "region": {
                            "type": "string",
                            "description": "Optional capture region as 'left,top,width,height' in pixels",
                        },
                    },
                },
            ),
            Tool(
                name="describe_screen",
                description=(
                    "Capture a screenshot and analyze it with a VLM to identify the active window, "
                    "UI elements (buttons, inputs, menus, etc.), text regions, and overall layout. "
                    "Returns structured JSON with element positions as screen percentages (0-1)."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "monitor": {
                            "type": "integer",
                            "description": "Monitor index (1=primary). Default: 1",
                            "default": 1,
                        },
                        "region": {
                            "type": "string",
                            "description": "Optional capture region as 'left,top,width,height'",
                        },
                    },
                },
            ),
            Tool(
                name="find_element",
                description=(
                    "Find a specific UI element on screen by natural language description. "
                    "For example: 'the submit button', 'search bar', 'file menu'. "
                    "Returns the element's type, text, bounding box, and state."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Natural language description of the element to find",
                        },
                        "monitor": {
                            "type": "integer",
                            "description": "Monitor index. Default: 1",
                            "default": 1,
                        },
                        "region": {
                            "type": "string",
                            "description": "Optional capture region as 'left,top,width,height'",
                        },
                    },
                    "required": ["query"],
                },
            ),
            Tool(
                name="read_text",
                description=(
                    "Extract all readable text from the screen, organized by visual regions "
                    "(title bar, sidebar, main content, etc.). Useful for OCR and understanding "
                    "what text is visible on screen."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "monitor": {
                            "type": "integer",
                            "description": "Monitor index. Default: 1",
                            "default": 1,
                        },
                        "region": {
                            "type": "string",
                            "description": "Optional capture region as 'left,top,width,height'",
                        },
                    },
                },
            ),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent | ImageContent]:
        from openeye_ai.mcp import tools

        mon = arguments.get("monitor", monitor)
        region = _parse_region(arguments.get("region"))

        if name == "capture_screen":
            result = await tools.capture_screen(monitor=mon, region=region)
            image_b64 = result.pop("image_base64", "")
            return [
                ImageContent(
                    type="image",
                    data=image_b64,
                    mimeType="image/jpeg",
                ),
                TextContent(
                    type="text",
                    text=json.dumps(
                        {"width": result.get("width"), "height": result.get("height")},
                    ),
                ),
            ]

        elif name == "describe_screen":
            result = await tools.describe_screen(monitor=mon, region=region)
            return [
                TextContent(type="text", text=json.dumps(result, indent=2)),
            ]

        elif name == "find_element":
            query = arguments.get("query", "")
            if not query:
                return [TextContent(type="text", text='{"error": "query is required"}')]
            result = await tools.find_element(query=query, monitor=mon, region=region)
            return [
                TextContent(type="text", text=json.dumps(result, indent=2)),
            ]

        elif name == "read_text":
            result = await tools.read_text(monitor=mon, region=region)
            return [
                TextContent(type="text", text=json.dumps(result, indent=2)),
            ]

        else:
            return [
                TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"})),
            ]

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
