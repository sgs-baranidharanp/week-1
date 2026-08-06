from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from sqlalchemy.orm import Session

from database.database import SessionLocal

from models.chat import (
    ChatMessage,
    Conversation
)

from services.ollama import (
    stream_ollama,
    generate_title
)

from services.auth import (
    oauth2_scheme,
    verify_token
)


router = APIRouter()


# =========================================================
# DATABASE
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# REQUEST MODELS
# =========================================================

class ChatRequest(BaseModel):

    message: str

    conversation_id: int | None = None


class EditMessageRequest(BaseModel):

    message: str


# =========================================================
# HELPER - BUILD CONTEXT
# =========================================================

def get_context(
    db,
    conversation_id,
    user_id
):

    recent_messages = (
        db.query(ChatMessage)

        .filter(
            ChatMessage.conversation_id ==
                conversation_id,

            ChatMessage.user_id ==
                user_id
        )

        .order_by(
            ChatMessage.created_at.desc()
        )

        .limit(10)

        .all()
    )


    recent_messages.reverse()


    return [

        {
            "role": item.role,
            "content": item.message
        }

        for item in recent_messages
    ]


# =========================================================
# HELPER - STREAM + SAVE AI RESPONSE
# =========================================================

def create_stream(
    ollama_messages,
    conversation_id,
    user_id,
    save_to_db=True
):

    def generate():

        full_reply = ""


        # =================================================
        # SEND CONVERSATION ID TO REACT
        # =================================================

        if conversation_id is None:

            yield (
                "__CONVERSATION_ID__:guest\n"
            )

        else:

            yield (
                f"__CONVERSATION_ID__:"
                f"{conversation_id}\n"
            )


        try:

            # =============================================
            # STREAM OLLAMA RESPONSE
            # =============================================

            for chunk in stream_ollama(
                ollama_messages
            ):

                full_reply += chunk

                yield chunk


            # =============================================
            # SAVE AI RESPONSE
            #
            # ONLY logged-in users
            # =============================================

            if (
                save_to_db
                and user_id is not None
                and conversation_id is not None
                and full_reply.strip()
            ):

                save_db = SessionLocal()

                try:

                    ai_message = ChatMessage(
                        user_id=user_id,
                        conversation_id=
                            conversation_id,
                        role="assistant",
                        message=full_reply
                    )

                    save_db.add(
                        ai_message
                    )

                    save_db.commit()

                finally:

                    save_db.close()


        except Exception as error:

            print(
                "Streaming error:",
                error
            )

            yield (
                f"\nError: {str(error)}"
            )


    return StreamingResponse(
        generate(),

        media_type=
            "text/plain; charset=utf-8",

        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache"
        }
    )


# =========================================================
# GET ALL CONVERSATIONS
# =========================================================

@router.get("/conversations")
def get_conversations(
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    if not token:

        raise HTTPException(
            status_code=401,
            detail="Login required"
        )


    user_id = verify_token(
        token.credentials
    )


    conversations = (
        db.query(Conversation)

        .filter(
            Conversation.user_id ==
                user_id
        )

        .order_by(
            Conversation.created_at.desc()
        )

        .all()
    )


    return [

        {
            "id": conversation.id,

            "title":
                conversation.title,

            "created_at":
                conversation.created_at
        }

        for conversation
        in conversations
    ]


# =========================================================
# GET ONE CONVERSATION
# =========================================================

@router.get(
    "/conversations/{conversation_id}/messages"
)
def get_messages(
    conversation_id: int,
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    if not token:

        raise HTTPException(
            status_code=401,
            detail="Login required"
        )


    user_id = verify_token(
        token.credentials
    )


    # =====================================================
    # CHECK OWNERSHIP
    # =====================================================

    conversation = (
        db.query(Conversation)

        .filter(
            Conversation.id ==
                conversation_id,

            Conversation.user_id ==
                user_id
        )

        .first()
    )


    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )


    # =====================================================
    # GET MESSAGES
    # =====================================================

    messages = (
        db.query(ChatMessage)

        .filter(
            ChatMessage.conversation_id ==
                conversation_id,

            ChatMessage.user_id ==
                user_id
        )

        .order_by(
            ChatMessage.created_at.asc(),
            ChatMessage.id.asc()
        )

        .all()
    )


    return [

        {
            "id": item.id,
            "role": item.role,
            "message": item.message,
            "created_at":
                item.created_at
        }

        for item in messages
    ]
# =========================================================
# DELETE CONVERSATION
# =========================================================

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    user_id = verify_token(
        token.credentials
    )

    # Find conversation and make sure
    # it belongs to logged-in user
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    # Delete all messages first
    (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == user_id
        )
        .delete(
            synchronize_session=False
        )
    )

    # Delete conversation
    db.delete(conversation)

    db.commit()

    return {
        "message": "Conversation deleted successfully"
    }

# =========================================================
# EDIT USER MESSAGE
# =========================================================

@router.put(
    "/messages/{message_id}"
)
def edit_message(
    message_id: int,
    request: EditMessageRequest,
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    if not token:

        raise HTTPException(
            status_code=401,
            detail="Login required"
        )


    user_id = verify_token(
        token.credentials
    )


    text = request.message.strip()


    if not text:

        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )


    # =====================================================
    # FIND USER MESSAGE
    # =====================================================

    user_message = (
        db.query(ChatMessage)

        .filter(
            ChatMessage.id ==
                message_id,

            ChatMessage.user_id ==
                user_id,

            ChatMessage.role ==
                "user"
        )

        .first()
    )


    if not user_message:

        raise HTTPException(
            status_code=404,
            detail="Message not found"
        )


    conversation_id = (
        user_message.conversation_id
    )


    # =====================================================
    # DELETE EVERYTHING AFTER EDITED MESSAGE
    # =====================================================

    (
        db.query(ChatMessage)

        .filter(
            ChatMessage.conversation_id ==
                conversation_id,

            ChatMessage.user_id ==
                user_id,

            ChatMessage.id >
                user_message.id
        )

        .delete(
            synchronize_session=False
        )
    )


    # =====================================================
    # UPDATE USER MESSAGE
    # =====================================================

    user_message.message = text

    db.commit()


    # =====================================================
    # BUILD NEW CONTEXT
    # =====================================================

    ollama_messages = get_context(
        db,
        conversation_id,
        user_id
    )


    # =====================================================
    # GENERATE NEW AI RESPONSE
    # =====================================================

    return create_stream(
        ollama_messages,
        conversation_id,
        user_id,
        save_to_db=True
    )


# =========================================================
# REGENERATE AI MESSAGE
# =========================================================

@router.post(
    "/messages/{message_id}/regenerate"
)
def regenerate_message(
    message_id: int,
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    if not token:

        raise HTTPException(
            status_code=401,
            detail="Login required"
        )


    user_id = verify_token(
        token.credentials
    )


    # =====================================================
    # FIND AI MESSAGE
    # =====================================================

    ai_message = (
        db.query(ChatMessage)

        .filter(
            ChatMessage.id ==
                message_id,

            ChatMessage.user_id ==
                user_id,

            ChatMessage.role ==
                "assistant"
        )

        .first()
    )


    if not ai_message:

        raise HTTPException(
            status_code=404,
            detail="AI message not found"
        )


    conversation_id = (
        ai_message.conversation_id
    )


    # =====================================================
    # FIND PREVIOUS USER MESSAGE
    # =====================================================

    previous_user = (
        db.query(ChatMessage)

        .filter(
            ChatMessage.conversation_id ==
                conversation_id,

            ChatMessage.user_id ==
                user_id,

            ChatMessage.role ==
                "user",

            ChatMessage.id <
                ai_message.id
        )

        .order_by(
            ChatMessage.id.desc()
        )

        .first()
    )


    if not previous_user:

        raise HTTPException(
            status_code=404,
            detail="Previous user message not found"
        )


    # =====================================================
    # DELETE OLD AI RESPONSE + EVERYTHING AFTER
    # =====================================================

    (
        db.query(ChatMessage)

        .filter(
            ChatMessage.conversation_id ==
                conversation_id,

            ChatMessage.user_id ==
                user_id,

            ChatMessage.id >
                previous_user.id
        )

        .delete(
            synchronize_session=False
        )
    )


    db.commit()


    # =====================================================
    # BUILD CONTEXT
    # =====================================================

    ollama_messages = get_context(
        db,
        conversation_id,
        user_id
    )


    # =====================================================
    # GENERATE NEW RESPONSE
    # =====================================================

    return create_stream(
        ollama_messages,
        conversation_id,
        user_id,
        save_to_db=True
    )


# =========================================================
# NORMAL CHAT
# =========================================================

@router.post("/chat")
def chat(
    request: ChatRequest,
    token=Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    # =====================================================
    # MESSAGE
    # =====================================================

    text = request.message.strip()


    if not text:

        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )


    # =====================================================
    # CHECK LOGIN
    # =====================================================

    if token:

        user_id = verify_token(
            token.credentials
        )

    else:

        user_id = None


    # =====================================================
    # GUEST USER
    #
    # AI works
    # NO database storage
    # =====================================================

    if user_id is None:

        guest_messages = [

            {
                "role": "user",
                "content": text
            }

        ]


        return create_stream(
            guest_messages,
            None,
            None,
            save_to_db=False
        )


    # =====================================================
    # LOGGED-IN USER
    # =====================================================


    # =====================================================
    # EXISTING CONVERSATION
    # =====================================================

    if request.conversation_id is not None:

        conversation = (
            db.query(Conversation)

            .filter(
                Conversation.id ==
                    request.conversation_id,

                Conversation.user_id ==
                    user_id
            )

            .first()
        )


        if not conversation:

            raise HTTPException(
                status_code=404,
                detail="Conversation not found"
            )


    # =====================================================
    # NEW CONVERSATION
    # =====================================================

    else:

        # -------------------------------------------------
        # GENERATE SHORT AI TITLE
        # -------------------------------------------------

        try:

            title = generate_title(
                text
            )


            print(
                "Generated title:",
                title
            )


        except Exception as error:

            print(
                "Title generation failed:",
                error
            )


            # ---------------------------------------------
            # FALLBACK TITLE
            # ---------------------------------------------

            title = text[:40]


        # -------------------------------------------------
        # CREATE CONVERSATION
        # -------------------------------------------------

        conversation = Conversation(
            user_id=user_id,
            title=title
        )


        db.add(
            conversation
        )


        db.commit()


        db.refresh(
            conversation
        )


    # =====================================================
    # GET CONVERSATION ID
    #
    # IMPORTANT:
    # Outside the if/else because both new and existing
    # conversations need this.
    # =====================================================

    conversation_id = (
        conversation.id
    )


    # =====================================================
    # SAVE USER MESSAGE
    # =====================================================

    user_message = ChatMessage(
        user_id=user_id,

        conversation_id=
            conversation_id,

        role="user",

        message=text
    )


    db.add(
        user_message
    )


    db.commit()


    # =====================================================
    # GET LAST 10 MESSAGES
    # =====================================================

    ollama_messages = get_context(
        db,
        conversation_id,
        user_id
    )


    # =====================================================
    # STREAM AI RESPONSE
    # =====================================================

    return create_stream(
        ollama_messages,
        conversation_id,
        user_id,
        save_to_db=True
    )