"""Settings, validated at startup. Values come from the environment or the repo-root `.env`."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Literal["development", "test", "production"] = "development"
    allowed_origin: str = "http://localhost:5173"
    route_data_path: Path = REPO_ROOT / "data" / "route.json"

    # Provider keys stay on the server. They are optional so the API can run in scripted mode.
    gemini_api_key: SecretStr | None = None
    gemini_live_model: str | None = None
    gemini_text_model: str | None = None
    groq_api_key: SecretStr | None = None
    groq_stt_model: str = "whisper-large-v3-turbo"
    groq_llm_model: str | None = None

    rate_limit_per_min: int = Field(default=20, ge=1)
    live_token_ttl_seconds: int = Field(default=300, ge=30, le=1800)


@lru_cache
def get_settings() -> Settings:
    return Settings()
