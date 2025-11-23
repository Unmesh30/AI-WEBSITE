// Entries Index Module
// Builds and maintains an index of all research entries for chatbot reference

let entriesIndex = [];
let indexReady = false;

// Build the entries index from the DOM
function buildEntriesIndex() {
  entriesIndex = [];

  // Find all bibliography entries
  const bibEntries = document.querySelectorAll('.bib-entry');

  bibEntries.forEach((entry, index) => {
    try {
      // Get or create a unique ID
      let entryId = entry.id;
      if (!entryId) {
        // Generate ID from citation or use index
        const citation = entry.querySelector('.bib-citation');
        if (citation) {
          const sourceTitle = citation.getAttribute('data-source-title') || '';
          // Create a slug from the title
          entryId = sourceTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50) || `entry-${index}`;
        } else {
          entryId = `entry-${index}`;
        }
        entry.id = entryId;
      }

      // Extract citation information
      const citation = entry.querySelector('.bib-citation');
      if (!citation) return;

      const sourceUrl = citation.getAttribute('data-source-url') || '';
      const sourceTitle = citation.getAttribute('data-source-title') || '';
      const citationText = citation.textContent || '';

      // Extract annotation text
      const annotation = entry.querySelector('.annotation-text');
      const annotationText = annotation ? annotation.textContent.trim() : '';

      // Extract author from annotation-author div
      const authorDiv = entry.querySelector('.annotation-author');
      const authorText = authorDiv ? authorDiv.textContent.trim() : '';
      // Extract just the name (before the date)
      const authorName = authorText.split(/\d/)[0].trim();

      // Extract tags
      const tags = entry.getAttribute('data-tags') || '';

      // Find the parent topic/subtopic where this entry actually exists
      let context = '';
      let topicId = '';
      let subtopicId = '';

      // Find the closest parent with an id (could be topic or subtopic page)
      const parentPage = entry.closest('[id]');
      if (parentPage) {
        const pageId = parentPage.id;

        // Get the page title for context
        const header = parentPage.querySelector('.topic-page-header h1');
        if (header) {
          context = header.textContent.trim();
        }

        // Determine if this is a topic or subtopic page
        // Subtopic pages typically have format: topic-subtopic (with dash in middle)
        // Topic pages have format: topic-name
        // We need to check if this page has a parent topic

        // Check if there's a subtopic indicator by looking for onclick attributes in subtopic cards
        const allSubtopicCards = document.querySelectorAll('.subtopic-card[onclick]');
        let isSubtopic = false;

        allSubtopicCards.forEach(card => {
          const onclick = card.getAttribute('onclick');
          if (onclick && onclick.includes(`'${pageId}'`)) {
            // This page is referenced as a subtopic
            isSubtopic = true;
            // Extract parent topic from onclick: showSubtopicPage('parent-topic', 'subtopic')
            const match = onclick.match(/showSubtopicPage\('([^']+)',\s*'([^']+)'\)/);
            if (match) {
              topicId = match[1];
              subtopicId = match[2];
            }
          }
        });

        if (!isSubtopic) {
          // This is a topic page
          topicId = pageId;
        }
      }

      // Construct title (first author + year if available)
      let title = sourceTitle || citationText.split('.')[0];
      if (title.length > 100) {
        title = title.substring(0, 100) + '...';
      }

      // Create snippet (first 200 chars of annotation)
      let snippet = annotationText;
      if (snippet.length > 200) {
        snippet = snippet.substring(0, 200) + '...';
      }

      // Full text for search matching
      const fullText = [
        title,
        citationText,
        annotationText,
        tags,
        context,
      ].join(' ').toLowerCase();

      // Build URL to navigate to the correct page with the entry hash
      const basePath = window.location.pathname || '/';
      let url;

      if (subtopicId) {
        // Entry is on a subtopic page
        url = `${basePath}?topic=${encodeURIComponent(topicId)}&subtopic=${encodeURIComponent(subtopicId)}#${entryId}`;
      } else if (topicId) {
        // Entry is on a topic page
        url = `${basePath}?topic=${encodeURIComponent(topicId)}#${entryId}`;
      } else {
        // Fallback: just use the hash
        url = `${basePath}#${entryId}`;
      }

      // Add to index
      entriesIndex.push({
        id: entryId,
        title,
        snippet,
        url,
        fullText,
        citationText,
        annotationText,
        sourceUrl,
        author: authorName,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        context,
      });

    } catch (error) {
      console.error('Error indexing entry:', error, entry);
    }
  });

  indexReady = true;
  console.log(`✓ Indexed ${entriesIndex.length} research entries`);
}

// Get relevant entries based on a search query
function getRelevantEntries(query, maxResults = 5) {
  if (!indexReady) {
    buildEntriesIndex();
  }

  if (!query || !query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Score each entry
  const scoredEntries = entriesIndex.map(entry => {
    let score = 0;

    // Exact phrase match in title (high weight)
    if (entry.title.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Exact phrase match in snippet
    if (entry.snippet.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Exact phrase match in full text
    if (entry.fullText.includes(queryLower)) {
      score += 20;
    }

    // Token matches
    queryTokens.forEach(token => {
      // Title matches (high weight)
      const titleLower = entry.title.toLowerCase();
      const titleMatches = (titleLower.match(new RegExp(token, 'g')) || []).length;
      score += titleMatches * 15;

      // Snippet matches
      const snippetLower = entry.snippet.toLowerCase();
      const snippetMatches = (snippetLower.match(new RegExp(token, 'g')) || []).length;
      score += snippetMatches * 10;

      // Full text matches
      const fullTextMatches = (entry.fullText.match(new RegExp(token, 'g')) || []).length;
      score += fullTextMatches * 3;

      // Tag exact matches (medium-high weight)
      if (entry.tags.some(tag => tag.toLowerCase().includes(token))) {
        score += 30;
      }

      // Context matches
      if (entry.context.toLowerCase().includes(token)) {
        score += 5;
      }
    });

    return { ...entry, score };
  });

  // Filter out zero scores and sort by score
  const relevantEntries = scoredEntries
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return relevantEntries;
}

// Get all entries (for browsing)
function getAllEntries() {
  if (!indexReady) {
    buildEntriesIndex();
  }
  return entriesIndex;
}

// Rebuild index (call when DOM changes)
function rebuildIndex() {
  buildEntriesIndex();
}

// Initialize index when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildEntriesIndex);
} else {
  // DOM is already ready
  setTimeout(buildEntriesIndex, 100);
}

// Export functions
window.entriesIndexAPI = {
  getRelevantEntries,
  getAllEntries,
  rebuildIndex,
  isReady: () => indexReady,
};
