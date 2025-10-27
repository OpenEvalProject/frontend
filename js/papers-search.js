/**
 * Paper search page functionality
 */

$(document).ready(function() {
    console.log('Paper search page loaded');

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
    const searchType = $('input[name="search-type"]:checked').val() || 'author';
    const limit = parseInt($('#result-limit').val()) || 50;

    // Show loading state
    showLoading();

    try {
        // Call search API
        const response = await fetch(
            `/api/papers/search?q=${encodeURIComponent(query)}&search_type=${searchType}&limit=${limit}`,
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
    const { query, search_type, results, total_results } = data;

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
                <p>No papers found matching your query.</p>
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
 * Create a result card HTML element for a paper
 */
function createResultCard(result, rank) {
    const {
        submission_id,
        title,
        doi,
        pub_date,
        abstract,
        matching_authors
    } = result;

    // Format publication date
    const formattedDate = pub_date ? new Date(pub_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Date not available';

    // Create author list HTML
    const authorsHtml = matching_authors.map(author => {
        const orcidBadge = author.orcid
            ? `<span class="orcid-badge" title="ORCID: ${escapeHtml(author.orcid)}">ORCID</span>`
            : '';
        const corrBadge = author.corresponding
            ? `<span class="corresponding-badge">Corresponding</span>`
            : '';

        return `
            <div class="author-item">
                <span class="author-name">${escapeHtml(author.given_names)} ${escapeHtml(author.surname)}</span>
                ${orcidBadge}
                ${corrBadge}
            </div>
        `;
    }).join('');

    // Truncate abstract if too long
    const maxAbstractLength = 300;
    const displayAbstract = abstract && abstract.length > maxAbstractLength
        ? abstract.substring(0, maxAbstractLength) + '...'
        : (abstract || 'No abstract available');

    return $(`
        <div class="result-card paper-result-card">
            <div class="result-header">
                <div class="result-rank">#${rank}</div>
                ${doi ? `<a href="https://doi.org/${encodeURIComponent(doi)}" target="_blank" class="doi-link">DOI</a>` : ''}
            </div>

            <div class="result-body">
                <div class="paper-content">
                    <h3 class="paper-title">
                        <a href="/paper.html?id=${encodeURIComponent(submission_id)}">
                            ${escapeHtml(title)}
                        </a>
                    </h3>

                    <div class="paper-metadata">
                        <span class="pub-date">${formattedDate}</span>
                    </div>

                    <div class="matching-authors-section">
                        <h4>Matching Authors</h4>
                        <div class="authors-list">
                            ${authorsHtml}
                        </div>
                    </div>

                    ${abstract ? `
                        <div class="abstract-section">
                            <h4>Abstract</h4>
                            <p class="abstract-text">${escapeHtml(displayAbstract)}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="result-footer">
                    <a href="/paper.html?id=${encodeURIComponent(submission_id)}"
                       class="view-manuscript-link">
                        View Full Analysis →
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
