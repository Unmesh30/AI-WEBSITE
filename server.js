require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, entries } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Build system message with entry context
    let systemMessage = `You are a helpful AI assistant for the AI in Education VIP Research Exchange website. Your role is to answer questions about AI in education research and help users find relevant resources.

When answering questions:
1. Provide clear, concise, and accurate information
2. Always include a "Relevant entries on this site:" section at the end with links to specific entries
3. Format links as: • [Entry Title](ENTRY_URL)
4. Only reference entries that are actually relevant to the user's question
5. If no entries are relevant, say so clearly

`;

    if (entries && entries.length > 0) {
      systemMessage += `\nHere are potentially relevant entries from the site:\n\n`;
      entries.forEach((entry, idx) => {
        systemMessage += `${idx + 1}. Title: ${entry.title}\n`;
        systemMessage += `   URL: ${entry.url}\n`;
        if (entry.snippet) {
          systemMessage += `   Summary: ${entry.snippet}\n`;
        }
        systemMessage += `\n`;
      });
    }

    // Call Claude API
    // Try multiple model versions/aliases in case one is not available
    const modelsToTry = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet-latest',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 2048,
          system: systemMessage,
          messages: messages,
        });

        // Extract text from response
        const assistantMessage = response.content[0].text;

        return res.json({
          message: assistantMessage,
          usage: response.usage,
          modelUsed: modelName
        });
      } catch (err) {
        console.error(`Failed with model ${modelName}:`, err.message);
        lastError = err;
        continue;
      }
    }

    // If all models fail, throw the last error
    throw lastError || new Error('No models available');

  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({
      error: 'Failed to get response from AI',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📚 AI Education VIP Research Exchange\n`);
});
