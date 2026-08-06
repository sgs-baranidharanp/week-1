import { useState } from "react";

import api from "../services/api";

import {
  LogIn,
  X,
  LogOut,
} from "lucide-react";


function Login({
  onLoginSuccess,
  onLogoutSuccess,
}) {

  const [showLogin, setShowLogin] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [isLoggedIn, setIsLoggedIn] =
    useState(
      !!localStorage.getItem("token")
    );


  // =====================================================
  // LOGIN
  // =====================================================

  async function handleLogin(event) {

    event.preventDefault();


    // Prevent double login request
    if (loading) {
      return;
    }


    // ===================================================
    // VALIDATION
    // ===================================================

    if (
      !email.trim() ||
      !password.trim()
    ) {

      alert(
        "Enter email and password"
      );

      return;
    }


    try {

      setLoading(true);


      // =================================================
      // LOGIN REQUEST
      // =================================================

      const response =
        await api.post(
          "/login",
          {
            email: email.trim(),
            password: password,
          }
        );


      // =================================================
      // GET TOKEN
      // =================================================

      const token =
        response.data?.access_token;


      if (!token) {

        throw new Error(
          response.data?.detail ||
          response.data?.error ||
          "Token not returned from server"
        );

      }


      // =================================================
      // REMOVE OLD TOKEN
      // =================================================

      localStorage.removeItem(
        "token"
      );


      // =================================================
      // SAVE NEW TOKEN
      // =================================================

      localStorage.setItem(
        "token",
        token
      );


      // =================================================
      // UPDATE LOGIN UI
      // =================================================

      setIsLoggedIn(true);


      // =================================================
      // CLOSE LOGIN MODAL
      // =================================================

      setShowLogin(false);


      // =================================================
      // CLEAR LOGIN FORM
      // =================================================

      setEmail("");

      setPassword("");


      // =================================================
      // TELL CHATBOX LOGIN SUCCESS
      // =================================================
      //
      // IMPORTANT:
      // ONLY ONE onLoginSuccess() CALL.
      //
      // ChatBox should:
      //
      // 1. Clear guest messages
      // 2. Reset conversationId
      // 3. Show fresh chat
      // 4. Load logged-in history
      //
      // =================================================

      if (onLoginSuccess) {

        await onLoginSuccess();

      }


      alert(
        "Login successful"
      );


    } catch (error) {

      console.error(
        "Login error:",
        error
      );


      // =================================================
      // ERROR MESSAGE
      // =================================================

      let errorMessage =
        "Login failed";


      // FastAPI returned error
      if (
        error.response?.data?.detail
      ) {

        errorMessage =
          error.response.data.detail;

      }

      else if (
        error.response?.data?.error
      ) {

        errorMessage =
          error.response.data.error;

      }

      // FastAPI not running / network problem
      else if (
        error.message === "Network Error"
      ) {

        errorMessage =
          "Cannot connect to the server.";

      }

      else if (
        error.message
      ) {

        errorMessage =
          error.message;

      }


      alert(
        errorMessage
      );


    } finally {

      setLoading(false);

    }

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {

    // ===================================================
    // REMOVE TOKEN
    // ===================================================

    localStorage.removeItem(
      "token"
    );


    // ===================================================
    // UPDATE UI
    // ===================================================

    setIsLoggedIn(false);


    // ===================================================
    // CLOSE LOGIN MODAL
    // ===================================================

    setShowLogin(false);


    // ===================================================
    // CLEAR FORM
    // ===================================================

    setEmail("");

    setPassword("");


    // ===================================================
    // TELL CHATBOX LOGOUT SUCCESS
    // ===================================================
    //
    // ChatBox should:
    //
    // 1. Clear logged-in messages
    // 2. Clear history
    // 3. Reset conversationId
    // 4. Return to guest mode
    //
    // ===================================================

    if (onLogoutSuccess) {

      onLogoutSuccess();

    }

  }


  // =====================================================
  // UI
  // =====================================================

  return (

    <>

      {/* =================================================
          LOGIN / LOGOUT BUTTON
      ================================================== */}

      {isLoggedIn ? (

        <button
          type="button"

          onClick={
            handleLogout
          }

          className="
            flex
            items-center
            gap-2
            bg-[#1E293B]
            hover:bg-red-500/20
            text-gray-200
            hover:text-red-400
            border
            border-white/10
            px-4
            py-2.5
            rounded-xl
            transition
          "
        >

          <LogOut
            size={18}
          />

          Logout

        </button>

      ) : (

        <button
          type="button"

          onClick={() =>
            setShowLogin(true)
          }

          className="
            flex
            items-center
            gap-2
            bg-cyan-500
            hover:bg-cyan-600
            text-white
            font-medium
            px-5
            py-2.5
            rounded-xl
            transition
            shadow-lg
            shadow-cyan-500/10
          "
        >

          <LogIn
            size={18}
          />

          Login

        </button>

      )}


      {/* =================================================
          LOGIN MODAL
      ================================================== */}

      {
        showLogin &&
        !isLoggedIn && (

          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/60
              backdrop-blur-sm
              p-4
            "

            onMouseDown={() =>
              setShowLogin(false)
            }
          >

            {/* ===========================================
                MODAL BOX
            ============================================ */}

            <div
              onMouseDown={(event) =>
                event.stopPropagation()
              }

              className="
                relative
                w-full
                max-w-md
                bg-[#111827]
                border
                border-white/10
                rounded-3xl
                shadow-2xl
                p-7
              "
            >

              {/* =========================================
                  CLOSE
              ========================================== */}

              <button
                type="button"

                onClick={() =>
                  setShowLogin(false)
                }

                disabled={
                  loading
                }

                className="
                  absolute
                  top-5
                  right-5
                  h-9
                  w-9
                  rounded-xl
                  flex
                  items-center
                  justify-center
                  text-gray-400
                  hover:text-white
                  hover:bg-white/10
                  transition
                  disabled:opacity-50
                "
              >

                <X
                  size={20}
                />

              </button>


              {/* =========================================
                  TITLE
              ========================================== */}

              <div
                className="mb-7"
              >

                <div
                  className="
                    h-12
                    w-12
                    bg-cyan-500/10
                    text-cyan-400
                    rounded-2xl
                    flex
                    items-center
                    justify-center
                    mb-4
                  "
                >

                  <LogIn
                    size={23}
                  />

                </div>


                <h2
                  className="
                    text-2xl
                    font-bold
                    text-white
                  "
                >

                  Welcome back

                </h2>


                <p
                  className="
                    text-gray-400
                    text-sm
                    mt-2
                  "
                >

                  Login to save your chat history.

                </p>

              </div>


              {/* =========================================
                  LOGIN FORM
              ========================================== */}

              <form
                onSubmit={
                  handleLogin
                }

                className="
                  space-y-5
                "
              >

                {/* =======================================
                    EMAIL
                ======================================== */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      text-gray-300
                      mb-2
                    "
                  >

                    Email

                  </label>


                  <input
                    type="email"

                    value={
                      email
                    }

                    autoFocus

                    autoComplete="email"

                    placeholder="you@example.com"

                    disabled={
                      loading
                    }

                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }

                    className="
                      w-full
                      bg-[#1F2937]
                      border
                      border-white/10
                      rounded-xl
                      px-4
                      py-3
                      text-white
                      placeholder:text-gray-500
                      outline-none
                      focus:border-cyan-500
                      focus:ring-2
                      focus:ring-cyan-500/10
                      transition
                      disabled:opacity-60
                    "
                  />

                </div>


                {/* =======================================
                    PASSWORD
                ======================================== */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      text-gray-300
                      mb-2
                    "
                  >

                    Password

                  </label>


                  <input
                    type="password"

                    value={
                      password
                    }

                    autoComplete=
                      "current-password"

                    placeholder=
                      "Enter password"

                    disabled={
                      loading
                    }

                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }

                    className="
                      w-full
                      bg-[#1F2937]
                      border
                      border-white/10
                      rounded-xl
                      px-4
                      py-3
                      text-white
                      placeholder:text-gray-500
                      outline-none
                      focus:border-cyan-500
                      focus:ring-2
                      focus:ring-cyan-500/10
                      transition
                      disabled:opacity-60
                    "
                  />

                </div>


                {/* =======================================
                    SUBMIT
                ======================================== */}

                <button
                  type="submit"

                  disabled={
                    loading
                  }

                  className="
                    w-full
                    bg-cyan-500
                    hover:bg-cyan-600
                    text-white
                    font-semibold
                    rounded-xl
                    py-3
                    transition
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                  "
                >

                  {
                    loading
                      ? "Logging in..."
                      : "Login"
                  }

                </button>

              </form>

            </div>

          </div>

        )
      }

    </>

  );

}


export default Login;