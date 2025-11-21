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

      // Extract tags
      const tags = entry.getAttribute('data-tags') || '';

      // Find the parent topic/subtopic for context
      let context = '';
      const parentSubtopic = entry.closest('[id]');
      if (parentSubtopic) {
        const header = parentSubtopic.querySelector('.topic-page-header h1');
        if (header) {
          context = header.textContent.trim();
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

      // Construct URL
      const url = `${window.location.origin}${window.location.pathname}#${entryId}`;

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
