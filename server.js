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
    const { messages, entries, teamData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Build comprehensive system message with all available context
    let systemMessage = `You are a helpful AI assistant for the AI in Education VIP Research Exchange website. Your role is to answer questions about AI in education research, team members, and the site content.

IMPORTANT CAPABILITIES:
- Answer questions about research entries, team members, contributions, and site content
- Use reasoning and inference to answer questions even if the answer isn't explicitly stated
- Count and aggregate data (e.g., "how many contributions does X have?")
- Compare and analyze information across multiple entries
- Provide insights based on the available data

When answering questions:
1. Provide clear, concise, and accurate information
2. Use the provided data to infer answers even if not explicitly stated
3. For questions about team members, use the team member data provided
4. For questions requiring counting or aggregation, calculate from the available data
5. IMPORTANT: When asked about a specific team member's contributions, ONLY reference entries where that person is listed as the "Author/Contributor"
6. Do NOT include entries where the person's name appears in the content but they are not the author
7. When referencing research entries, mention the title and author, but DO NOT include clickable links
8. Keep responses conversational and informative without URLs or link formatting

`;

    // Add team member information to context
    if (teamData && teamData.members && teamData.members.length > 0) {
      systemMessage += `\nTEAM MEMBER INFORMATION:\n`;
      systemMessage += `Total team members: ${teamData.totalMembers}\n`;
      systemMessage += `Total contributions: ${teamData.totalContributions}\n\n`;
      systemMessage += `Team members and their contributions:\n`;
      teamData.members.forEach((member, idx) => {
        systemMessage += `${idx + 1}. ${member.name}: ${member.contributions} contribution(s)\n`;
      });
      systemMessage += `\n`;
    }

    // Add research entries to context
    if (entries && entries.length > 0) {
      systemMessage += `\nRESEARCH ENTRIES (${entries.length} relevant entries):\n\n`;
      entries.forEach((entry, idx) => {
        systemMessage += `${idx + 1}. Title: ${entry.title}\n`;
        if (entry.author) {
          systemMessage += `   Author/Contributor: ${entry.author}\n`;
        }
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
