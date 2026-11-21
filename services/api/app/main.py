from fastapi import FastAPI

from app.routers import health, route


def create_app() -> FastAPI:
    app = FastAPI(title="Mamsha API", version="0.1.0")
    app.include_router(health.router)
    app.include_router(route.router)
    return app


app = create_app()
