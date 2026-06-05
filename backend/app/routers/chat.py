import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models.chat import Conversation, Message
from ..schemas.chat import ChatRequest, ConversationOut, MessageOut
from ..services.ai_tutor import build_system_prompt

router = APIRouter(prefix="/api")


@router.post("/chat")
async def chat(data: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Get or create conversation
    conversation_id = data.conversation_id
    if not conversation_id:
        title = data.message[:80] + ("..." if len(data.message) > 80 else "")
        conv = Conversation(
            user_id=data.user_id,
            lesson_id=data.lesson_id,
            title=title,
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        conversation_id = conv.id
    else:
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = conv_result.scalar_one_or_none()
        if conv:
            conv.updated_at = datetime.now(timezone.utc)
            if data.lesson_id is not None:
                conv.lesson_id = data.lesson_id
            await db.commit()

    # Save user message
    user_msg = Message(
        conversation_id=conversation_id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    await db.commit()

    # Build system prompt
    system_prompt = await build_system_prompt(
        db, data.user_id, data.lesson_id, data.selected_text
    )

    # Get chat history
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(settings.max_chat_history)
    )
    history = list(msgs_result.scalars().all())[::-1]

    anthropic_messages = []
    for m in history:
        anthropic_messages.append({"role": m.role, "content": m.content})

    async def event_stream():
        full_response = ""

        if not settings.anthropic_api_key:
            full_response = "请在 backend/.env 文件中设置 ANTHROPIC_API_KEY 环境变量以启用 AI 导师功能。"
            yield f"data: {json.dumps({'token': full_response})}\n\n"
            yield "data: [DONE]\n\n"
        else:
            try:
                from anthropic import AsyncAnthropic
                client = AsyncAnthropic(api_key=settings.anthropic_api_key)
                async with client.messages.stream(
                    model=settings.model,
                    max_tokens=2000,
                    system=system_prompt,
                    messages=anthropic_messages,
                ) as stream:
                    async for text in stream.text_stream:
                        full_response += text
                        yield f"data: {json.dumps({'token': text})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                error_msg = f"AI 导师暂时不可用: {str(e)}"
                full_response = error_msg
                yield f"data: {json.dumps({'token': error_msg})}\n\n"
                yield "data: [DONE]\n\n"

        # Save assistant message
        assistant_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=full_response,
        )
        db.add(assistant_msg)
        await db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            lesson_id=c.lesson_id,
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        )
        for c in convs
    ]


@router.get("/conversations/{conv_id}", response_model=list[MessageOut])
async def get_messages(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    msgs = result.scalars().all()
    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in msgs
    ]
