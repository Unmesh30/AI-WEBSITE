// Chatbot Module
// Provides AI-powered chat interface for answering questions about research entries
// NOTE: Chat history is NOT persisted between page reloads or sessions.
// Each page load or new login starts with a fresh, empty chat.

const API_BASE_URL = window.location.origin;

// State
let chatOpen = false;
let chatMessages = [];
let isProcessing = false;

// Extract team member data from the page
function getTeamMemberData() {
  const teamData = {
    members: [],
    totalMembers: 0,
    totalContributions: 0
  };

  try {
    // Ensure team members list is populated
    const teamMembersList = document.getElementById('team-members-list');
    if (teamMembersList && teamMembersList.children.length === 0) {
      // List is empty, populate it first
      if (typeof window.populateTeamMembersList === 'function') {
        window.populateTeamMembersList();
      }
    }

    // Extract team member list from the page
    if (teamMembersList) {
      const memberElements = teamMembersList.querySelectorAll('li');
      memberElements.forEach(el => {
        // Find the name link (could be in <strong> for faculty or plain for students)
        const nameLink = el.querySelector('a');

        // Find the contribution count badge (span with the count number)
        const countBadge = el.querySelector('span[style*="background-color"]');

        if (nameLink && countBadge) {
          // Extract name - strip <strong> tags if present
          const name = nameLink.textContent.trim();

          // Extract count from badge span
          const count = parseInt(countBadge.textContent.trim()) || 0;

          teamData.members.push({
            name: name,
            contributions: count
          });
          teamData.totalContributions += count;
        }
      });
      teamData.totalMembers = teamData.members.length;
    }
  } catch (error) {
    console.error('Error extracting team member data:', error);
  }

  return teamData;
}

// Initialize chatbot
function initChatbot() {
  createChatUI();
  // NOTE: We do NOT load chat history from storage
  // Every page load starts with a fresh chat
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
    // Get relevant entries (increased from 5 to 10 for better context)
    const relevantEntries = window.entriesIndexAPI.getRelevantEntries(message, 10);

    // Prepare entries for API
    const entries = relevantEntries.map(entry => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      snippet: entry.snippet,
      author: entry.author,
    }));

    // Get team member data for questions about contributors
    const teamData = getTeamMemberData();

    // Prepare messages for API
    const apiMessages = chatMessages
      .filter(msg => msg.role !== 'loading')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

    // Call API with entries and team data
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: apiMessages,
        entries: entries,
        teamData: teamData,
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

    // NOTE: We do NOT save chat history to storage anymore
    // Chat is only kept in memory during the current session

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
  // IMPORTANT: Internal entry reference links must open in same tab to preserve
  // topic/subtopic navigation context (e.g., /?topic=X&subtopic=Y#entry-id)
  // External links (research papers, etc.) open in new tab for better UX
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    // Check if link is internal (starts with /, ?, or #) or external (http/https)
    const isInternal = url.startsWith('/') || url.startsWith('?') || url.startsWith('#');
    if (isInternal) {
      // Internal link: open in same tab to navigate to entry without resetting page
      return `<a href="${url}">${linkText}</a>`;
    } else {
      // External link: open in new tab
      return `<a href="${url}" target="_blank" rel="noopener">${linkText}</a>`;
    }
  });

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

// Clear chat history (called on sign-out and page reload)
// This function resets the chat to a fresh state
function clearChatHistory() {
  // Reset messages array to empty
  chatMessages = [];

  // Clear localStorage (if any old history exists)
  try {
    localStorage.removeItem('ai_vip_chat_history');
  } catch (error) {
    console.error('Error clearing chat history from storage:', error);
  }

  // Clear the UI - remove all messages except the welcome message
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) {
    // Keep only the first child (welcome message)
    while (messagesContainer.children.length > 1) {
      messagesContainer.removeChild(messagesContainer.lastChild);
    }
  }

  console.log('Chat history cleared - starting fresh session');
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
  clearChatHistory, // Exported for auth.js to call on sign-out/sign-in
};
