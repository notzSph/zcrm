import os
from pydantic import BaseModel


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


class Settings(BaseModel):
    project_name: str = "zCRM API"
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg://zcrm:zcrm@localhost:5432/zcrm")
    cors_origins: list[str] = _csv(os.getenv("CORS_ORIGINS", "http://localhost:3200"))
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    cookie_samesite: str = os.getenv("COOKIE_SAMESITE", "lax")


settings = Settings()
