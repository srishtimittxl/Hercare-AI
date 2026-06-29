# 🌸 HerCare — Personalized Ayurvedic Cycle Companion

**HerCare** is a modern, compassionate, and beautiful menstrual health companion application built with Expo (React Native). It blends modern cycle tracking with time-tested **Ayurvedic wellness** and personalized **AI-driven advice** to help women understand, nurture, and align with their bodies.

---

## ✨ Features

*   **🌸 Dynamic Cycle Path Timeline:** Visual horizontal timeline tracker representing the 4 monthly phases (Menstrual, Follicular, Ovulatory, Luteal) showing a cute flower icon pointer (🌸) over the active phase.
*   **🧘 Ayurvedic Element Details:** Tracks active phase Doshas (Vata, Pitta, Kapha) and detailing temperature, energy, and digestion cycles.
*   **📊 Interactive Hormone Bars:** Elegant visual bar gauges showing the active relative levels of Estrogen, Progesterone, and Luteinizing Hormone (LH) in the body.
*   **🌿 Smart Log Recommendations:** Automatically scans user mood and symptom logs from the last 7 days to suggest tailored Ayurvedic home remedies (e.g., cumin-coriander-fennel tea for bloating, warm sesame oil massages).
*   **🏆 Daily Wellness Challenges:** Phase-appropriate daily challenges with custom persistence across page reloads.
*   **🔔 Personalized Reminders:** Smart daily hydration alerts and cycle prediction warnings scheduled directly on the device with an easy settings toggle card.
*   **🤖 Multi-Model AI Chat:** Compassionate, conversational AI support powered by **Groq (Llama-3.3-70B)**, Google Gemini, or OpenAI to answer health queries for free.

---

## 🛠️ Technology Stack

*   **Frontend Mobile App:** React Native, Expo, Expo Router, TypeScript, Expo Notifications.
*   **Backend Server:** Node.js, Express, TypeScript, Server-Sent Events (SSE) streaming proxy.
*   **AI Integration:** Multi-provider API wrapper supporting Groq, Google Gemini, and OpenAI.

---

## 🚀 How to Set Up & Run Local

This project is set up as a monorepo using `pnpm` workspaces. 

### Prerequisite:
Make sure you have Node.js and `pnpm` installed on your machine.

### 1. Install Dependencies
Run this in the root project folder:
```bash
pnpm install
```

### 2. Obtain a Free AI Key
Sign up for a free developer account at [console.groq.com](https://console.groq.com/) and generate an API key starting with `gsk_...`.

### 3. Run the Backend API Server
Provide your API key and start the server:
```bash
PORT=5001 GROQ_API_KEY="gsk_YOUR-KEY-HERE" pnpm --filter @workspace/api-server dev
```
*(Alternatively, you can run using `OPENAI_API_KEY="sk-..."` or `GEMINI_API_KEY="AQ..."`).*

### 4. Run the Expo Mobile App
In a new terminal window, start the Expo bundler:
```bash
pnpm --filter @workspace/hercare dev
```
Scan the QR code printed in the terminal using the **Expo Go** app on your iOS or Android phone to test the app live!
