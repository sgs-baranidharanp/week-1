# 🤖 AI Chatbot using React, FastAPI, PostgreSQL & Ollama

## Overview

An AI chatbot built using React.js, FastAPI, PostgreSQL, and Ollama (Llama 3.2). It supports JWT authentication, chat history, conversation management, and AI-powered responses.

---

## Features

- User Registration & Login
- JWT Authentication
- AI Chat using Ollama (Llama 3.2)
- Conversation History
- PostgreSQL Database
- Responsive React UI
- FastAPI Backend
- Chat Context (Previous Messages)

---

## Tech Stack

Frontend
- React.js
- Tailwind CSS

Backend
- FastAPI
- SQLAlchemy
- JWT Authentication
- Ollama

Database
- PostgreSQL

AI Model
- Llama 3.2

---

## Project Structure

frontend/
backend/
models/
routers/
services/
database/

---

## Installation

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

                    AI CHATBOT SYSTEM

+---------------------+
|      User           |
+----------+----------+
           |
           |
           v
+---------------------+
| React.js Frontend   |
| - Login             |
| - Chat UI           |
| - History           |
+----------+----------+
           |
      HTTP / REST API
           |
           v
+----------------------+
| FastAPI Backend      |
|----------------------|
| Authentication (JWT) |
| Chat Router          |
| Conversation Router  |
| Ollama Service       |
+-----+-----------+----+
      |           |
      |           |
      |           |
      v           v

+-------------+   +----------------+
| PostgreSQL  |   | Ollama Server  |
|-------------|   |----------------|
| Users       |   | Llama 3.2      |
| Conversation|   | AI Model       |
| Messages    |   +----------------+
+-------------+