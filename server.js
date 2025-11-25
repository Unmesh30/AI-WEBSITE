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

// Rate limiting store (in-memory, resets on server restart)
const rateLimitStore = new Map();
const RATE_LIMIT = 10; // Maximum requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const userEmail = req.body.userEmail;

  if (!userEmail) {
    return res.status(401).json({ error: 'User email required for rate limiting' });
  }

  const now = Date.now();
  const userRecord = rateLimitStore.get(userEmail) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  // Reset if window has passed
  if (now > userRecord.resetTime) {
    userRecord.count = 0;
    userRecord.resetTime = now + RATE_LIMIT_WINDOW;
  }

  // Check if limit exceeded
  if (userRecord.count >= RATE_LIMIT) {
    const timeRemaining = Math.ceil((userRecord.resetTime - now) / 60000); // minutes
    return res.status(429).json({
      error: `Rate limit exceeded. You can send ${RATE_LIMIT} messages per hour. Please try again in ${timeRemaining} minute(s).`
    });
  }

  // Increment count
  userRecord.count++;
  rateLimitStore.set(userEmail, userRecord);

  next();
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '500kb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Chat endpoint
app.post('/api/chat', rateLimitMiddleware, async (req, res) => {
  try {
    const { messages, entries, teamData, userEmail } = req.body;

    // Verify NYU email
    if (!userEmail || !userEmail.endsWith('@nyu.edu')) {
      return res.status(403).json({ error: 'Chat is only available to verified NYU community members' });
    }

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
5. IMPORTANT: When asked about a specific VIP team member's contributions, ONLY reference entries where that person is listed as the "VIP Contributor"
6. When referencing research papers, cite the "Paper Author(s)" NOT the "VIP Contributor"
7. The Paper Author(s) are the original researchers who wrote the paper
8. The VIP Contributor is the NYU team member who annotated/curated the entry
9. Always include a "Relevant entries on this site:" section at the end with links to specific entries (when applicable)
10. Format links as: • [Paper Title by Author](ENTRY_URL) - use the exact URL provided in the entry data
11. Only reference entries that are actually relevant to the user's question
12. If no entries are relevant, you can omit the "Relevant entries" section

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
        if (entry.paperAuthor) {
          systemMessage += `   Paper Author(s): ${entry.paperAuthor}\n`;
        }
        if (entry.contributor) {
          systemMessage += `   VIP Contributor: ${entry.contributor}\n`;
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
    // Haiku is prioritized for cost-effectiveness and speed
    const modelsToTry = [
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-sonnet-20240229',
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
