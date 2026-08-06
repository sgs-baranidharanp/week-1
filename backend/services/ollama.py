import json
import requests


# =========================================================
# OLLAMA CONFIG
# =========================================================

OLLAMA_URL = "http://localhost:11434/api/chat"

MODEL_NAME = "llama3.2"

SYSTEM_PROMPT = """
You are a helpful AI assistant.

Follow these rules:

- Answer the user's question directly.
- Give clear and easy-to-understand answers.
- Keep answers concise unless the user asks for detail.
- Use Markdown formatting when useful.
- Use bullet points for lists.
- For programming questions, provide clean code examples.
- Explain code in simple language.
- Use the previous conversation messages to understand context.
- If you are unsure about something, say so instead of inventing information.
"""

# =========================================================
# STREAM AI RESPONSE
# =========================================================

def stream_ollama(messages: list):
    
    messages_with_system = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        },
        *messages
    ]

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,

            "messages": messages,

            "stream": True,

            "options": {
                "temperature": 0.3,
                "num_predict": 500
            }
        },
        stream=True,
        timeout=120
    )


    response.raise_for_status()


    # Ollama returns one JSON object per line
    for line in response.iter_lines():

        if not line:
            continue


        data = json.loads(
            line.decode("utf-8")
        )


        # /api/chat streaming format
        content = (
            data
            .get("message", {})
            .get("content", "")
        )


        if content:

            yield content


        # Ollama finished generating
        if data.get("done"):

            break


# =========================================================
# GENERATE CONVERSATION TITLE
# =========================================================

def generate_title(message: str):

    # Ask Ollama only for a short conversation title
    title_messages = [
        {
            "role": "system",
            "content": (
                "Generate a short descriptive title "
                "for the user's conversation. "
                "Use maximum 5 words. "
                "Return ONLY the title. "
                "Do not use quotes. "
                "Do not use markdown. "
                "Do not add explanations. "
                "Do not answer the user's question."
            )
        },
        {
            "role": "user",
            "content": message
        }
    ]


    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,

            "messages": title_messages,

            # Title does not need streaming
            "stream": False,

            "options": {
                "temperature": 0.2,
                "num_predict": 20
            }
        },
        timeout=30
    )


    response.raise_for_status()


    data = response.json()


    title = (
        data
        .get("message", {})
        .get("content", "")
        .strip()
    )


    # =====================================================
    # CLEAN TITLE
    # =====================================================

    # Remove quotes if Ollama adds them
    title = title.strip('"').strip("'")


    # Remove markdown-style heading
    title = title.lstrip("#").strip()


    # Remove line breaks
    title = " ".join(
        title.splitlines()
    )


    # =====================================================
    # FALLBACK
    # =====================================================

    if not title:

        title = message.strip()[:40]


    # =====================================================
    # MAXIMUM 5 WORDS
    # =====================================================

    words = title.split()


    if len(words) > 5:

        title = " ".join(
            words[:5]
        )


    # =====================================================
    # MAXIMUM 50 CHARACTERS
    # =====================================================

    if len(title) > 50:

        title = title[:50].rstrip()


    return title