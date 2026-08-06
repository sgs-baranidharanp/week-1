import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Login from "./Login";

import {
  Search,
  Plus,
  Send,
  MessageSquare,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ChatBox() {

  // =========================================================
  // STATE
  // =========================================================

  const [history, setHistory] = useState([]);

  const [conversationId, setConversationId] =
    useState(null);

  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello 👋 How can I help you today?",
    },
  ]);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [search, setSearch] = useState("");


  // =========================================================
  // REFS
  // =========================================================

  const messagesEndRef = useRef(null);

  const textareaRef = useRef(null);


  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [messages, loading]);


  // =========================================================
  // LOAD HISTORY WHEN PAGE OPENS
  // =========================================================

  useEffect(() => {

    loadHistory();

  }, []);


  // =========================================================
  // LOAD HISTORY
  // =========================================================

  const loadHistory = async () => {

    const token =
      localStorage.getItem("token");


    if (!token) {

      setHistory([]);

      return;
    }


    try {

      setHistoryLoading(true);


      const response = await fetch(
        "http://localhost:8000/conversations",
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );


      if (!response.ok) {

        if (response.status === 401) {

          localStorage.removeItem("token");

          setHistory([]);

          return;
        }


        throw new Error(
          "Failed to load chat history."
        );
      }


      const data =
        await response.json();


      setHistory(data);


    } catch (error) {

      console.error(
        "History error:",
        error
      );


    } finally {

      setHistoryLoading(false);

    }
  };


  // =========================================================
  // LOAD ONE CONVERSATION
  // =========================================================

  const loadConversation = async (id) => {

    if (loading) {
      return;
    }


    const token =
      localStorage.getItem("token");


    if (!token) {

      console.error(
        "Please login first."
      );

      return;
    }


    try {

      setLoading(true);


      const response = await fetch(
        `http://localhost:8000/conversations/${id}/messages`,
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );


      if (!response.ok) {

        if (response.status === 401) {

          localStorage.removeItem("token");

          throw new Error(
            "Login expired. Please login again."
          );
        }


        throw new Error(
          "Failed to load conversation."
        );
      }


      const data =
        await response.json();


      const formattedMessages =
        data.map((item) => ({

          type:
            item.role === "assistant"
              ? "ai"
              : "user",

          text: item.message,

        }));


      setMessages(
        formattedMessages
      );


      setConversationId(id);


    } catch (error) {

      console.error(
        "Conversation error:",
        error
      );


    } finally {

      setLoading(false);

    }
  };


  // =========================================================
  // AUTO EXPAND TEXTAREA
  // =========================================================

  const handleMessageChange = (event) => {

    setMessage(
      event.target.value
    );


    const textarea =
      event.target;


    textarea.style.height =
      "auto";


    textarea.style.height =
      Math.min(
        textarea.scrollHeight,
        160
      ) + "px";
  };


  // =========================================================
  // RESET TEXTAREA
  // =========================================================

  const resetTextarea = () => {

    if (textareaRef.current) {

      textareaRef.current.style.height =
        "auto";
    }
  };


  // =========================================================
// SEND MESSAGE + STREAM RESPONSE
// =========================================================

const sendMessage = async () => {

  const text = message.trim();

  if (!text || loading) {
    return;
  }
  setError("");


  // Remember conversation before request
  const currentConversationId =
    conversationId;


  // =====================================================
  // ADD USER MESSAGE
  // =====================================================

  setMessages((previous) => [
    ...previous,
    {
      type: "user",
      text: text,
    },
  ]);


  // Clear textarea
  setMessage("");

  resetTextarea();

  // This makes your WAITING DOTS appear
  setLoading(true);


  try {

    // ===================================================
    // TOKEN
    // ===================================================

    const token =
      localStorage.getItem("token");


    const headers = {
      "Content-Type": "application/json",
    };


    if (token) {

      headers.Authorization =
        `Bearer ${token}`;

    }


    // ===================================================
    // REQUEST
    // ===================================================

    const response = await fetch(
      "http://localhost:8000/chat",
      {
        method: "POST",

        headers: headers,

        body: JSON.stringify({
          message: text,

          conversation_id:
            token
              ? currentConversationId
              : null,
        }),
      }
    );


    // ===================================================
    // HTTP ERROR
    // ===================================================

    if (!response.ok) {

      let errorMessage =
        "Failed to get AI response.";


      try {

        const errorData =
          await response.json();


        if (errorData.detail) {

          if (
            typeof errorData.detail ===
            "string"
          ) {

            errorMessage =
              errorData.detail;

          } else {

            errorMessage =
              JSON.stringify(
                errorData.detail
              );

          }
        }

      } catch {

        errorMessage =
          `Request failed: ${response.status}`;

      }


      if (response.status === 401) {

        localStorage.removeItem(
          "token"
        );

      }


      throw new Error(
        errorMessage
      );
    }


    // ===================================================
    // CHECK STREAM
    // ===================================================

    if (!response.body) {

      throw new Error(
        "Streaming response not available."
      );

    }


    // ===================================================
    // IMPORTANT
    //
    // DO NOT CREATE EMPTY AI MESSAGE HERE.
    //
    // Your waiting dots remain visible because the
    // last message is still the user's message.
    // ===================================================


    // ===================================================
    // STREAM READER
    // ===================================================

    const reader =
      response.body.getReader();


    const decoder =
      new TextDecoder("utf-8");


    let aiText = "";

    let firstLineBuffer = "";

    let conversationIdReceived =
      false;

    let aiMessageCreated =
      false;


    // ===================================================
    // UPDATE / CREATE AI MESSAGE
    // ===================================================

    const updateAIMessage = (newText) => {

  if (!newText) {
    return;
  }

  setMessages((previous) => {

    // Check whether last message is already AI
    const lastMessage =
      previous[previous.length - 1];


    // AI bubble already exists
    // Only update that AI bubble
    if (
      lastMessage &&
      lastMessage.type === "ai"
    ) {

      return previous.map(
        (item, index) => {

          if (
            index === previous.length - 1
          ) {

            return {
              ...item,
              text: newText,
            };

          }

          return item;

        }
      );

    }


    // Last message is USER.
    // Keep user message and ADD new AI message.
    return [
      ...previous,
      {
        type: "ai",
        text: newText,
      },
    ];

  });

};


    // ===================================================
    // READ STREAM
    // ===================================================

    while (true) {

      const {
        value,
        done,
      } = await reader.read();


      if (done) {
        break;
      }


      const chunk =
        decoder.decode(
          value,
          {
            stream: true,
          }
        );


      // =================================================
      // FIRST LINE = CONVERSATION ID
      // =================================================

      if (!conversationIdReceived) {

        firstLineBuffer += chunk;


        const newlineIndex =
          firstLineBuffer.indexOf(
            "\n"
          );


        // We haven't received the complete
        // conversation-ID line yet.
        if (newlineIndex === -1) {

          continue;

        }


        const firstLine =
          firstLineBuffer.slice(
            0,
            newlineIndex
          );


        const remainingText =
          firstLineBuffer.slice(
            newlineIndex + 1
          );


        // ===============================================
        // GET CONVERSATION ID
        // ===============================================

        if (
          firstLine.startsWith(
            "__CONVERSATION_ID__:"
          )
        ) {

          const idText =
            firstLine.replace(
              "__CONVERSATION_ID__:",
              ""
            );


          // Guest response may contain:
          //
          // __CONVERSATION_ID__:guest

          if (idText !== "guest") {

            const newConversationId =
              Number(idText);


            if (
              !Number.isNaN(
                newConversationId
              )
            ) {

              setConversationId(
                newConversationId
              );

            }

          }

        }


        conversationIdReceived =
          true;


        firstLineBuffer = "";


        // ===============================================
        // FIRST AI TEXT MAY BE IN SAME CHUNK
        // ===============================================

        if (remainingText) {

          aiText += remainingText;


          updateAIMessage(
            aiText
          );

        }


        continue;
      }


      // =================================================
      // NORMAL STREAMING
      // =================================================

      if (chunk) {

        aiText += chunk;


        updateAIMessage(
          aiText
        );

      }

    }


    // ===================================================
    // FLUSH DECODER
    // ===================================================

    const finalChunk =
      decoder.decode();


    if (finalChunk) {

      aiText += finalChunk;


      updateAIMessage(
        aiText
      );

    }


    // ===================================================
    // EMPTY RESPONSE SAFETY
    // ===================================================

    if (!aiText.trim()) {

      setMessages((previous) => [
        ...previous,

        {
          type: "ai",

          text:
            "No response received from AI.",
        },
      ]);

    }


    // ===================================================
    // REFRESH SIDEBAR
    //
    // Only logged-in users have DB history.
    // ===================================================

    if (token) {

      await loadHistory();

    }


  }  catch (error) {

  console.error(
    "Chat error:",
    error
  );


  let errorMessage =
    "Something went wrong. Please try again.";


  // FastAPI stopped / network problem
  if (
    error.message === "Failed to fetch" ||
    error.message === "Network Error"
  ) {

    errorMessage =
      "Cannot connect to the server. Please try again.";

  }

  // Other backend errors
  else if (error.message) {

    errorMessage =
      error.message;

  }


  // IMPORTANT:
  // Show error separately.
  // Do NOT add it to messages.
  setError(errorMessage);


} finally {

  setLoading(false);
  }
};



  // =========================================================
  // ENTER KEY
  // =========================================================

  const handleKeyDown = (event) => {

    // Enter = Send
    // Shift + Enter = New line

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();

    }
  };


  // =========================================================
  // NEW CHAT
  // =========================================================

  const handleNewChat = () => {

    if (loading) {
      return;
    }


    setConversationId(null);


    setMessages([
      {
        type: "ai",
        text:
          "Hello 👋 How can I help you today?",
      },
    ]);


    setMessage("");


    resetTextarea();

  };


  // =========================================================
  // LOGIN SUCCESS
  // =========================================================

  const handleLoginSuccess = async () => {

  // Remove guest conversation
  setMessages([
    {
      type: "ai",
      text: "Hello 👋 How can I help you today?",
    },
  ]);


  // No conversation selected yet
  setConversationId(null);


  // Clear input
  setMessage("");


  // Reset textarea height
  resetTextarea();


  // Load logged-in user's DB history
  await loadHistory();

};
const handleLogoutSuccess = () => {

  // Remove logged-in user's conversation history
  setHistory([]);

  // Remove currently opened logged-in conversation
  setConversationId(null);

  // Clear input
  setMessage("");

  // Show fresh guest chat
  setMessages([
    {
      type: "ai",
      text: "Hello 👋 How can I help you today?",
    },
  ]);

  // Reset textarea
  resetTextarea();
};


  // =========================================================
  // SEARCH HISTORY
  // =========================================================

  const filteredHistory =
    history.filter((item) => {

      const title =
        item.title || "";


      return title
        .toLowerCase()
        .includes(
          search.toLowerCase()
        );

    });
    const handleDeleteConversation = async (id) => {

  const token =
    localStorage.getItem("token");

  if (!token) {
    return;
  }

  const confirmed =
    window.confirm(
      "Delete this conversation?"
    );

  if (!confirmed) {
    return;
  }

  try {

    setError("");

    const response = await fetch(
      `http://127.0.0.1:8000/conversations/${id}`,
      {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );


    if (!response.ok) {

      let errorMessage =
        "Failed to delete conversation.";

      try {

        const data =
          await response.json();

        errorMessage =
          data.detail ||
          errorMessage;

      } catch {
        // Ignore JSON parsing error
      }

      throw new Error(
        errorMessage
      );
    }


    // =============================================
    // REMOVE FROM SIDEBAR
    // =============================================

    setHistory((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );


    // =============================================
    // IF CURRENT CHAT WAS DELETED
    // =============================================

    if (conversationId === id) {

      setConversationId(null);

      setMessages([
        {
          type: "ai",
          text: "Hello 👋 How can I help you today?",
        },
      ]);

      setMessage("");
    }


  } catch (error) {

    console.error(
      "Delete conversation error:",
      error
    );

    setError(
      error.message ||
      "Failed to delete conversation."
    );

  }

};




  // =========================================================
  // UI
  // =========================================================

  return (

    <div
      className="
        flex
        h-screen
        bg-[#0B1120]
        text-white
        overflow-hidden
      "
    >


      {/* ===================================================
          SIDEBAR
      ==================================================== */}

      <aside
        className="
          w-80
          shrink-0
          border-r
          border-white/10
          bg-[#111827]
          flex
          flex-col
        "
      >


        {/* NEW CHAT */}

        <div className="p-4">

          <button

            onClick={
              handleNewChat
            }

            disabled={loading}

            className="
              w-full
              rounded-xl
              bg-cyan-500
              hover:bg-cyan-600
              transition
              p-3
              font-semibold
              flex
              items-center
              justify-center
              gap-2
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >

            <Plus size={18} />

            New Chat

          </button>

        </div>


        {/* SEARCH */}

        <div className="px-4">

          <div className="relative">

            <Search
              size={18}

              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />


            <input

              value={search}

              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }

              placeholder="Search..."

              className="
                w-full
                bg-[#1F2937]
                rounded-xl
                pl-11
                pr-4
                py-3
                outline-none
                border
                border-transparent
                focus:border-cyan-500
                transition
              "
            />

          </div>

        </div>


        {/* =================================================
            HISTORY
        ================================================== */}

        <div
          className="
            flex-1
            min-h-0
            overflow-y-auto
            px-4
            py-5
            [&::-webkit-scrollbar]:hidden
            [scrollbar-width:none]
            [-ms-overflow-style:none]
          "
        >

          <h2
            className="
              text-gray-400
              text-sm
              mb-3
            "
          >

            Recent Chats

          </h2>


          {/* HISTORY LOADING */}

          {historyLoading && (

            <p
              className="
                text-sm
                text-gray-500
                px-2
                py-2
              "
            >

              Loading...

            </p>

          )}


          {/* EMPTY HISTORY */}

          {!historyLoading &&
            filteredHistory.length === 0 && (

              <p
                className="
                  text-sm
                  text-gray-500
                  px-2
                  py-2
                "
              >

                No chats yet

              </p>

            )}


          {/* =================================================
    HISTORY LIST
================================================== */}

<div className="space-y-2">

  {filteredHistory.map((item) => (

    <div
      key={item.id}
      className={`
        group
        w-full
        rounded-xl
        transition
        flex
        items-center

        ${
          conversationId === item.id

            ? `
                bg-cyan-500/20
                text-cyan-300
              `

            : `
                bg-white/5
                hover:bg-cyan-500/10
              `
        }
      `}
    >

      {/* =============================================
          OPEN CONVERSATION
      ============================================== */}

      <button
        type="button"
        disabled={loading}
        onClick={() =>
          loadConversation(item.id)
        }
        className="
          flex
          items-center
          gap-3
          flex-1
          min-w-0
          text-left
          p-3
          disabled:cursor-not-allowed
        "
      >

        <MessageSquare
          size={17}
          className="shrink-0"
        />


        <span
          className="
            truncate
            flex-1
          "
        >
          {item.title}
        </span>

      </button>


      {/* =============================================
          DELETE CONVERSATION
      ============================================== */}

      <button
        type="button"
        disabled={loading}
        onClick={(event) => {

          event.stopPropagation();

          handleDeleteConversation(
            item.id
          );

        }}
        title="Delete conversation"
        className="
          shrink-0
          mr-2
          p-2
          rounded-lg

          text-gray-400

          opacity-0
          group-hover:opacity-100

          hover:text-red-400
          hover:bg-red-500/10

          transition

          disabled:cursor-not-allowed
        "
      >

        <Trash2 size={17} />

      </button>

    </div>

  ))}

</div>

                  

          

        </div>

      </aside>


      {/* ===================================================
          MAIN CHAT
      ==================================================== */}

      <main
        className="
          flex-1
          min-w-0
          min-h-0
          flex
          flex-col
        "
      >


        {/* =================================================
            HEADER
        ================================================== */}

        <header
          className="
            shrink-0
            border-b
            border-white/10
            px-8
            py-5
            bg-[#0B1120]
            flex
            items-center
            justify-between
            gap-6
          "
        >

          <div>

            <h2
              className="
                font-bold
                text-2xl
              "
            >

              AI Chat

            </h2>


          </div>


          {/* LOGIN */}

          <Login
  onLoginSuccess={handleLoginSuccess}
  onLogoutSuccess={handleLogoutSuccess}
/>

        </header>


        {/* =================================================
            MESSAGES
        ================================================== */}

        <section
          className="
            flex-1
            min-h-0
            overflow-y-auto
            px-4
            py-5
            [&::-webkit-scrollbar]:hidden
            [scrollbar-width:none]
            [-ms-overflow-style:none]
          "
        >

          <div
            className="
              w-full
              max-w-5xl
              mx-auto
              px-6
              md:px-10
              py-8
            "
          >

            <div className="space-y-4">


              {/* MESSAGES */}

              {messages.map(
                (msg, index) => (

                  <div

                    key={index}

                    className={`flex w-full ${
                      msg.type === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >

                    <div
                      className={`
                        break-words
                        whitespace-pre-wrap
                        leading-7

                        ${
                          msg.type === "user"

                            ? `
                                max-w-[75%]
                                bg-cyan-500
                                text-white
                                rounded-3xl
                                rounded-br-lg
                                px-5
                                py-3
                              `

                            : `
                                w-auto
                                max-w-[90%]
                                bg-[#1E293B]
                                text-gray-100
                                rounded-3xl
                                rounded-bl-lg
                                px-6
                                py-5
                                shadow-lg
                              `
                        }
                      `}
                    >

                      {/* AI stream cursor */}

                      {msg.type === "ai" ? (

  <ReactMarkdown
    remarkPlugins={[remarkGfm]}

    components={{

      // TABLE
      table: ({ children }) => (
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-gray-600">
            {children}
          </table>
        </div>
      ),

      // TABLE HEADER
      thead: ({ children }) => (
        <thead className="bg-white/10">
          {children}
        </thead>
      ),

      // HEADER CELL
      th: ({ children }) => (
        <th className="border border-gray-600 px-4 py-3 text-left font-semibold">
          {children}
        </th>
      ),

      // NORMAL CELL
      td: ({ children }) => (
        <td className="border border-gray-600 px-4 py-3">
          {children}
        </td>
      ),

      // PARAGRAPH
      p: ({ children }) => (
        <p className="mb-2 text-sm leading-6">
          {children}
        </p>
      ),

      // BULLET LIST
      ul: ({ children }) => (
        <ul className="list-disc ml-5 mb-2 space-y-1 text-sm">
          {children}
        </ul>
      ),

      // NUMBER LIST
      ol: ({ children }) => (
        <ol className="list-decimal ml-5 mb-2 space-y-1 text-sm">
          {children}
        </ol>
      ),

      // HEADINGS
      h1: ({ children }) => (
        <h1 className="text-2xl font-bold mt-5 mb-3">
          {children}
        </h1>
      ),

      h2: ({ children }) => (
        <h2 className="text-xl font-bold mt-5 mb-3">
          {children}
        </h2>
      ),

      h3: ({ children }) => (
        <h3 className="text-lg font-semibold mt-4 mb-2">
          {children}
        </h3>
      ),

      // INLINE CODE
      code: ({ children }) => (
        <code className="bg-black/40 px-2 py-1 rounded text-cyan-300">
          {children}
        </code>
      ),

      // CODE BLOCK
      pre: ({ children }) => (
        <pre className="bg-[#0B1120] p-4 rounded-xl overflow-x-auto my-4">
          {children}
        </pre>
      ),

    }}
  >

    {msg.text}

  </ReactMarkdown>

) : (

  msg.text

)}

                      {
                        loading &&
                        msg.type === "ai" &&
                        index === messages.length - 1 &&
                        msg.text !== "" && (

                <></>

                        )
                      }

                    </div>

                  </div>

                )
              )}


              {/* =================================================
                  WAITING DOTS

                  Only show BEFORE first AI chunk arrives.
              ================================================== */}

              {
                loading &&
                (
                  messages.length === 0 ||
                  messages[
                    messages.length - 1
                  ].type === "user"
                ) && (

                  <div className="flex justify-start">

                    <div
                      className="
                        bg-[#1E293B]
                        rounded-3xl
                        rounded-bl-lg
                        px-6
                        py-4
                        text-gray-400
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <span
                          className="
                            w-2
                            h-2
                            rounded-full
                            bg-gray-400
                            animate-bounce
                          "
                        />

                        <span
                          className="
                            w-2
                            h-2
                            rounded-full
                            bg-gray-400
                            animate-bounce
                            [animation-delay:150ms]
                          "
                        />

                        <span
                          className="
                            w-2
                            h-2
                            rounded-full
                            bg-gray-400
                            animate-bounce
                            [animation-delay:300ms]
                          "
                        />

                      </div>

                    </div>

                  </div>

                )
              }


              {/* AUTO SCROLL */}

              <div
                ref={
                  messagesEndRef
                }

                className="h-1"
              />

            </div>

          </div>

        </section>


        {/* =================================================
            INPUT
        ================================================== */}

        <footer
          className="
            shrink-0
            border-t
            border-white/10
            bg-[#0B1120]
            px-6
            py-4
          "
        >

          <div
            className="
              max-w-5xl
              mx-auto
            "
          >

            <div
              className="
                bg-[#111827]
                border
                border-white/10
                rounded-3xl
                shadow-2xl
                px-4
                py-2
                focus-within:border-cyan-500/50
                transition
              "
            >

              <div
                className="
                  flex
                  items-end
                  gap-3
                "
              >


                {/* TEXTAREA */}

                <textarea

                  ref={
                    textareaRef
                  }

                  rows={1}

                  value={
                    message
                  }

                  placeholder={
                    loading
                      ? "AI is responding..."
                      : "Message AI..."
                  }

                  onChange={
                    handleMessageChange
                  }

                  onKeyDown={
                    handleKeyDown
                  }

                  disabled={
                    loading
                  }

                  className="
                    flex-1
                    min-h-[48px]
                    max-h-40
                    resize-none
                    overflow-y-auto
                    bg-transparent
                    outline-none
                    border-none
                    px-2
                    py-3
                    text-[16px]
                    leading-6
                    text-white
                    placeholder:text-gray-500
                    disabled:opacity-60
                    [&::-webkit-scrollbar]:hidden
                    [scrollbar-width:none]
                  "
                />


                {/* SEND */}

                <button

                  onClick={
                    sendMessage
                  }

                  disabled={
                    loading ||
                    !message.trim()
                  }

                  className="
                    shrink-0
                    h-12
                    w-12
                    rounded-2xl
                    bg-cyan-500
                    hover:bg-cyan-600
                    transition
                    flex
                    items-center
                    justify-center
                    disabled:opacity-40
                    disabled:cursor-not-allowed
                  "
                >

                  <Send size={20} />

                </button>

              </div>

            </div>


          </div>
{/* =================================================
    ERROR DISPLAY
================================================== */}

{error && (

  <div
    className="
      shrink-0
      px-6
      pt-3
      bg-[#0B1120]
    "
  >

    <div
      className="
        max-w-5xl
        mx-auto
        px-4
        py-3
        rounded-xl
        bg-red-500/10
        border
        border-red-500/20
        text-red-400
        text-sm
        flex
        items-center
        justify-between
        gap-3
      "
    >

      <span>
        {error}
      </span>


      <button
        type="button"
        onClick={() =>
          setError("")
        }
        className="
          text-red-300
          hover:text-white
          text-xl
          leading-none
        "
      >
        ×
      </button>

    </div>

  </div>

)}

        </footer>

      </main>

    </div>
  );
}


export default ChatBox;