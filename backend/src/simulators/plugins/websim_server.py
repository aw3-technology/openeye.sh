import logging
import os
import threading
from typing import List, Protocol, runtime_checkable

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles


@runtime_checkable
class StateProvider(Protocol):
    """Duck-typed protocol for WebSim state providers."""

    active_connections: List[WebSocket]

    def add_connection(self, ws: WebSocket) -> None: ...
    def remove_connection(self, ws: WebSocket) -> None: ...
    def get_initial_state(self) -> dict: ...


def create_app(state_provider: StateProvider) -> FastAPI:
    """
    Build a FastAPI app with GET / and WS /ws routes.

    Parameters
    ----------
    state_provider : StateProvider
        Object that manages connections and provides initial state.

    Returns
    -------
    FastAPI
        Configured FastAPI application.
    """
    app = FastAPI()

    assets_path = os.path.join(os.path.dirname(__file__), "assets")
    if not os.path.exists(assets_path):
        os.makedirs(assets_path)
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    logo_path = os.path.join(assets_path, "OM_Logo_b_transparent.png")
    if not os.path.exists(logo_path):
        logging.warning(f"Logo not found at {logo_path}")

    template_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    @app.get("/")
    async def get_index():
        return HTMLResponse(html_content)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        state_provider.add_connection(websocket)
        try:
            initial_state = state_provider.get_initial_state()
            await websocket.send_json(initial_state)
            while True:
                await websocket.receive_text()
        except Exception as e:
            logging.error(f"WebSocket error: {e}")
        finally:
            state_provider.remove_connection(websocket)

    return app


def run_server(app: FastAPI, port: int) -> None:
    """
    Run the FastAPI server with uvicorn.

    Parameters
    ----------
    app : FastAPI
        The FastAPI application to serve.
    port : int
        Port number to listen on.
    """
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=port,
        log_level="error",
        server_header=False,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(message)s",
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stderr",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "ERROR"},
                "uvicorn.error": {"level": "ERROR"},
            },
        },
    )
    server = uvicorn.Server(config)
    server.run()


def start_server_thread(app: FastAPI, port: int) -> threading.Thread:
    """
    Start the server in a daemon thread.

    Parameters
    ----------
    app : FastAPI
        The FastAPI application to serve.
    port : int
        Port number to listen on.

    Returns
    -------
    threading.Thread
        The started daemon thread running the server.
    """
    thread = threading.Thread(target=run_server, args=(app, port), daemon=True)
    thread.start()
    return thread
