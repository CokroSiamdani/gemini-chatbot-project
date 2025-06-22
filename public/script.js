const form = document.getElementById('chat-form')
const button = form.querySelector('button')
const input = document.getElementById('user-input')
const chatBox = document.getElementById('chat-box')

/**
 * A simple markdown-to-HTML converter for the bot's response.
 * Supports:
 * - Bold: **text** -> <strong>text</strong>
 * - Unordered lists: Lines starting with *
 * - Paragraphs for other lines.
 * @param {string} text The plain text from the bot.
 * @returns {string} The formatted HTML.
 */
function formatBotResponse(text) {
  const lines = text.split('\n')
  let htmlResult = ''
  let inList = false
  let paragraphBuffer = ''
  function applyInlineFormatting(line) {
    return line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }
  function flushParagraph() {
    if (paragraphBuffer) {
      htmlResult += `<p>${paragraphBuffer}</p>`
      paragraphBuffer = ''
    }
  }
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('* ')) {
      flushParagraph() // End any existing paragraph
      if (!inList) {
        htmlResult += '<ul>'
        inList = true
      }
      htmlResult += `<li>${applyInlineFormatting(trimmedLine.substring(2))}</li>`
    } else {
      if (inList) {
        htmlResult += '</ul>'
        inList = false
      }
      paragraphBuffer += (paragraphBuffer ? '\n' : '') + applyInlineFormatting(line)
    }
  }
  if (inList) htmlResult += '</ul>' // Close list if file ends with it
  flushParagraph() // Flush any remaining paragraph content
  return htmlResult
}

function appendMessage(sender, text, isHtml = false) {
  const msg = document.createElement('div')
  msg.classList.add('message', sender)
  if (isHtml) {
    msg.innerHTML = text
  } else {
    msg.textContent = text
  }
  chatBox.appendChild(msg)
  chatBox.scrollTop = chatBox.scrollHeight
  // Return the message element so we can update it later
  return msg
}
// To store the session ID for the conversation
let sessionId = null
form.addEventListener('submit', async function (e) {
  e.preventDefault()
  const userMessage = input.value.trim()
  if (!userMessage) return
  appendMessage('user', userMessage, false) // User messages are plain text
  input.value = ''
  // Disable form while waiting for response
  input.disabled = true
  button.disabled = true
  // Show a "thinking" indicator and keep a reference to it
  const thinkingMessage = appendMessage('bot', '...', false) // "..." is plain text
  thinkingMessage.classList.add('thinking')
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: sessionId, // Will be null for the first message
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      // Use the error message from the API, or a generic one
      throw new Error(data.error || 'An unknown error occurred.')
    }
    // Format the bot's response and update the message element with HTML
    thinkingMessage.innerHTML = formatBotResponse(data.text)
    // Update the session ID for subsequent requests
    sessionId = data.sessionId
  } catch (error) {
    console.error('Chat API Error:', error)
    // Update the "thinking" message with a plain text error message
    thinkingMessage.classList.add('error')
    thinkingMessage.textContent = `Sorry, something went wrong. Please try again. (${error.message})`
  } finally {
    // Clean up the thinking class and ensure the view scrolls down
    input.disabled = false
    button.disabled = false
    input.focus()
    thinkingMessage.classList.remove('thinking')
    chatBox.scrollTop = chatBox.scrollHeight
  }
})
