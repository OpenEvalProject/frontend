/**
 * Search page functionality for semantic claim search
 */

$(document).ready(function() {
    console.log('Search page loaded');

    // Initialize
    checkAuthStatus();
    setupSearchHandlers();

    // Focus on search input
    $('#search-query').focus();
});

/**
 * Setup event handlers for search functionality
 */
function setupSearchHandlers() {
    // Search button click
    $('#search-btn').on('click', function() {
        performSearch();
    });

    // Enter key in search input
    $('#search-query').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            performSearch();
        }
    });
}

/**
 * Perform the search
 */
async function performSearch() {
    const query = $('#search-query').val().trim();

    if (!query) {
        showError('Please enter a search query');
        return;
    }

    // Get search parameters
    const limit = parseInt($('#result-limit').val()) || 10;

    // Show loading state
    showLoading();

    try {
        // Call search API
        const response = await fetch(
            `/api/claims/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Search failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Display results
        displayResults(data);

    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Failed to perform search. Please try again.');
    }
}

/**
 * Display search results
 */
function displayResults(data) {
    const { query, results, total_results } = data;

    // Hide loading and empty states
    $('#search-loading').hide();
    $('#empty-state').hide();
    $('#search-error').hide();

    // Show results container
    $('#search-results').show();

    // Update results metadata
    $('#query-display').text(query);
    $('#result-count').text(total_results);

    // Clear previous results
    const $resultsList = $('#results-list');
    $resultsList.empty();

    if (total_results === 0) {
        $resultsList.html(`
            <div class="no-results">
                <p>No claims found matching your query.</p>
                <p class="hint">Try using different keywords or a broader query.</p>
            </div>
        `);
        return;
    }

    // Render each result
    results.forEach((result, index) => {
        const resultCard = createResultCard(result, index + 1);
        $resultsList.append(resultCard);
    });
}

/**
 * Create a result card HTML element
 */
function createResultCard(result, rank) {
    const {
        claim_id,
        manuscript_id,
        claim,
        claim_type,
        source_text,
        evidence_type,
        evidence_reasoning,
        similarity
    } = result;

    // Format similarity as percentage
    const similarityPercent = (similarity * 100).toFixed(1);

    // Determine similarity badge color
    let badgeClass = 'similarity-low';
    if (similarity >= 0.8) badgeClass = 'similarity-high';
    else if (similarity >= 0.6) badgeClass = 'similarity-medium';

    // Parse evidence_type if it's a string (double-encoded JSON)
    let evidenceTypes = [];
    if (typeof evidence_type === 'string') {
        try {
            const parsed = JSON.parse(evidence_type);
            if (typeof parsed === 'string') {
                evidenceTypes = JSON.parse(parsed);
            } else {
                evidenceTypes = parsed;
            }
        } catch (e) {
            evidenceTypes = [evidence_type];
        }
    } else if (Array.isArray(evidence_type)) {
        evidenceTypes = evidence_type;
    }

    // Create evidence type badges HTML
    const evidenceBadgesHtml = evidenceTypes.map(type =>
        `<span class="evidence-type-badge">${escapeHtml(type)}</span>`
    ).join(' ');

    return $(`
        <div class="result-card">
            <div class="result-header">
                <div class="result-rank">#${rank}</div>
                <div class="result-similarity ${badgeClass}">
                    ${similarityPercent}% match
                </div>
            </div>

            <div class="result-body">
                <div class="claim-content">
                    <h3 class="claim-text">${escapeHtml(claim)}</h3>
                    <div class="claim-metadata">
                        <span class="claim-type-badge">${escapeHtml(claim_type)}</span>
                        ${evidenceBadgesHtml}
                    </div>
                </div>

                <div class="claim-details">
                    <div class="detail-section">
                        <h4>Source Text</h4>
                        <p class="source-text">${escapeHtml(source_text)}</p>
                    </div>

                    <div class="detail-section">
                        <h4>Evidence Reasoning</h4>
                        <p class="evidence-reasoning">${escapeHtml(evidence_reasoning)}</p>
                    </div>
                </div>

                <div class="result-footer">
                    <a href="/paper.html?id=${encodeURIComponent(manuscript_id)}"
                       class="view-manuscript-link"
                       target="_blank">
                        View Full Manuscript →
                    </a>
                </div>
            </div>
        </div>
    `);
}

/**
 * Show loading state
 */
function showLoading() {
    $('#search-loading').show();
    $('#search-results').hide();
    $('#empty-state').hide();
    $('#search-error').hide();
}

/**
 * Show error message
 */
function showError(message) {
    $('#search-loading').hide();
    $('#search-results').hide();
    $('#empty-state').hide();
    $('#search-error').show();
    $('#search-error .error-message').text(message);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
