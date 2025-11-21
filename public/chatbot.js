// Chatbot Module
// Provides AI-powered chat interface for answering questions about research entries

const API_BASE_URL = window.location.origin;

// State
let chatOpen = false;
let chatMessages = [];
let isProcessing = false;

// Initialize chatbot
function initChatbot() {
  createChatUI();
  loadChatHistory();
}

// Create chat UI elements
function createChatUI() {
  // Create chat button
  const chatButton = document.createElement('button');
  chatButton.id = 'chat-button';
  chatButton.className = 'chat-button';
  chatButton.innerHTML = '<i class="fas fa-comments"></i>';
  chatButton.title = 'Ask AI about research';
  chatButton.onclick = toggleChat;
  document.body.appendChild(chatButton);

  // Create chat panel
  const chatPanel = document.createElement('div');
  chatPanel.id = 'chat-panel';
  chatPanel.className = 'chat-panel';
  chatPanel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-content">
        <i class="fas fa-robot"></i>
        <span>AI Research Assistant</span>
      </div>
      <button class="chat-close-btn" onclick="toggleChat()">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-message bot-message">
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <p>Hello! I'm your AI research assistant. I can help you find relevant research entries and answer questions about AI in education.</p>
          <p>Try asking me something like:</p>
          <ul>
            <li>"What research is available on student attitudes toward AI?"</li>
            <li>"Tell me about AI ethics in education"</li>
            <li>"What tools are used for evaluating AI?"</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="chat-input-container">
      <textarea
        id="chat-input"
        class="chat-input"
        placeholder="Ask me about AI in education research..."
        rows="1"
      ></textarea>
      <button id="chat-send-btn" class="chat-send-btn" onclick="sendMessage()">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;
  document.body.appendChild(chatPanel);

  // Add auto-resize to textarea
  const textarea = document.getElementById('chat-input');
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Add Enter to send (Shift+Enter for new line)
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Toggle chat panel
function toggleChat() {
  chatOpen = !chatOpen;
  const chatPanel = document.getElementById('chat-panel');
  const chatButton = document.getElementById('chat-button');

  if (chatOpen) {
    chatPanel.classList.add('open');
    chatButton.classList.add('hidden');
    document.getElementById('chat-input').focus();
  } else {
    chatPanel.classList.remove('open');
    chatButton.classList.remove('hidden');
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message || isProcessing) return;

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Add user message to chat
  addMessage('user', message);

  // Show loading indicator
  isProcessing = true;
  const loadingId = addLoadingMessage();

  try {
    // Get relevant entries
    const relevantEntries = window.entriesIndexAPI.getRelevantEntries(message, 5);

    // Prepare entries for API
    const entries = relevantEntries.map(entry => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      snippet: entry.snippet,
    }));

    // Prepare messages for API
    const apiMessages = chatMessages
      .filter(msg => msg.role !== 'loading')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

    // Call API
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: apiMessages,
        entries: entries,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Remove loading indicator
    removeMessage(loadingId);

    // Add bot response
    addMessage('assistant', data.message);

    // Save chat history
    saveChatHistory();

  } catch (error) {
    console.error('Chat error:', error);
    removeMessage(loadingId);
    addMessage('assistant', 'Sorry, I encountered an error. Please try again later.');
  } finally {
    isProcessing = false;
  }
}

// Add message to chat
function addMessage(role, content) {
  const messageId = `msg-${Date.now()}-${Math.random()}`;
  const message = { id: messageId, role, content, timestamp: Date.now() };
  chatMessages.push(message);

  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `chat-message ${role === 'user' ? 'user-message' : 'bot-message'}`;

  const avatar = role === 'user'
    ? '<i class="fas fa-user"></i>'
    : '<i class="fas fa-robot"></i>';

  // Render message content (with markdown for bot)
  let renderedContent = content;
  if (role === 'assistant') {
    renderedContent = renderMarkdown(content);
  } else {
    renderedContent = escapeHtml(content);
  }

  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${renderedContent}</div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return messageId;
}

// Add loading message
function addLoadingMessage() {
  const messageId = `loading-${Date.now()}`;
  chatMessages.push({ id: messageId, role: 'loading', content: '...', timestamp: Date.now() });

  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = 'chat-message bot-message loading-message';
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return messageId;
}

// Remove message
function removeMessage(messageId) {
  const index = chatMessages.findIndex(msg => msg.id === messageId);
  if (index > -1) {
    chatMessages.splice(index, 1);
  }

  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    messageElement.remove();
  }
}

// Simple markdown renderer
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers: ## text
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Lists: - item or • item
  html = html.replace(/^[•\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<[uh][1-4lL]>)/g, '$1');
  html = html.replace(/(<\/[uh][1-4lL]>)<\/p>/g, '$1');

  return html;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Save chat history to localStorage
function saveChatHistory() {
  try {
    const historyToSave = chatMessages
      .filter(msg => msg.role !== 'loading')
      .slice(-20); // Keep last 20 messages
    localStorage.setItem('ai_vip_chat_history', JSON.stringify(historyToSave));
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

// Load chat history from localStorage
function loadChatHistory() {
  try {
    const saved = localStorage.getItem('ai_vip_chat_history');
    if (saved) {
      const history = JSON.parse(saved);
      // Only restore if it's recent (within 24 hours)
      const latestTimestamp = history[history.length - 1]?.timestamp || 0;
      const hoursSince = (Date.now() - latestTimestamp) / (1000 * 60 * 60);

      if (hoursSince < 24) {
        chatMessages = history;
        // Re-render messages
        const messagesContainer = document.getElementById('chat-messages');
        history.forEach(msg => {
          if (msg.role !== 'loading') {
            const messageDiv = document.createElement('div');
            messageDiv.id = msg.id;
            messageDiv.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`;

            const avatar = msg.role === 'user'
              ? '<i class="fas fa-user"></i>'
              : '<i class="fas fa-robot"></i>';

            const renderedContent = msg.role === 'assistant'
              ? renderMarkdown(msg.content)
              : escapeHtml(msg.content);

            messageDiv.innerHTML = `
              <div class="message-avatar">${avatar}</div>
              <div class="message-content">${renderedContent}</div>
            `;

            messagesContainer.appendChild(messageDiv);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}

// Export for global access
window.chatbot = {
  toggleChat,
  sendMessage,
};
