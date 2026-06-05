from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./learning_platform.db"
    anthropic_api_key: str = ""
    model: str = "claude-sonnet-4-20250514"
    max_chat_history: int = 20

    class Config:
        env_file = ".env"


settings = Settings()
