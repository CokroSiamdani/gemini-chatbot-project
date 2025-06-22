import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config()
const app = express()
const port = process.env.PORT || 3000
// Fail fast if the API key is not provided
if (!process.env.GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not set.")
  process.exit(1)
}
// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static('public'))
// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
// Session configuration
const SESSION_TTL = 30 * 60 * 1000 // 30 minutes in milliseconds
// In-memory store for chat sessions.
// Note: For production, use a more persistent store like Redis or a database.
const chatSessions = {}
app.listen(port, () => {
  console.log(`Gemini Chatbot running on http://localhost:${port}`)
})
app.post('/api/chat', async (req, res) => {
  try {
    // The client should send a `sessionId` to continue a conversation.
    const { message, sessionId } = req.body
    if (!message) {
      return res.status(400).json({ error: "Message is required." })
    }
    let chat
    let currentSessionId = sessionId
    // If a sessionId is provided and exists, use the existing chat session.
    if (sessionId && chatSessions[sessionId]) {
      console.log(`Continuing session: ${sessionId}`)
      // Clear the previous cleanup timer
      clearTimeout(chatSessions[sessionId].timeoutId)
      chat = chatSessions[sessionId].chat
    } else {
      // Otherwise, start a new chat session.
      chat = model.startChat({
        history: [], // Start with an empty history.
      })
      // Generate a new unique ID for the session and store it.
      currentSessionId = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`
      console.log(`Starting new session: ${currentSessionId}`)
    }
    // Use sendMessage for a single, complete response.
    const result = await chat.sendMessage(message)
    const fullText = result.response.text()
    // Set/reset the cleanup timer for the session.
    const timeoutId = setTimeout(() => {
      console.log(`Cleaning up inactive session: ${currentSessionId}`)
      delete chatSessions[currentSessionId]
    }, SESSION_TTL)
    // Store/update the session object and its cleanup timer before sending the response.
    chatSessions[currentSessionId] = { chat, timeoutId }
    // Send the complete response as a single JSON object.
    res.json({
      text: fullText,
      sessionId: currentSessionId
    })
  } catch (err) {
    console.error("Error in /api/chat:", err)
    // Since we haven't sent a response yet, we can safely send a 500 status.
    res.status(500).json({ error: "An internal server error occurred." })
  }
})