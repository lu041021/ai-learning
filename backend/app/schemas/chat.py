from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_id: int
    lesson_id: int | None = None
    message: str
    selected_text: str | None = None
    conversation_id: int | None = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: int
    title: str
    lesson_id: int | None = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
