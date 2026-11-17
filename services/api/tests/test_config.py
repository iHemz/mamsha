import pytest
from pydantic import ValidationError

from app.config import Settings


def test_defaults_need_no_keys() -> None:
    settings = Settings(_env_file=None)
    assert settings.gemini_api_key is None
    assert settings.groq_stt_model == "whisper-large-v3-turbo"


def test_keys_are_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret")
    settings = Settings(_env_file=None)
    assert settings.gemini_api_key is not None
    assert "super-secret" not in repr(settings)
    assert settings.gemini_api_key.get_secret_value() == "super-secret"


@pytest.mark.parametrize(
    ("name", "value"), [("LIVE_TOKEN_TTL_SECONDS", "5"), ("RATE_LIMIT_PER_MIN", "0")]
)
def test_out_of_range_values_fail_at_startup(
    monkeypatch: pytest.MonkeyPatch, name: str, value: str
) -> None:
    monkeypatch.setenv(name, value)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
