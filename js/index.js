// Pagination state
let currentPage = 1;
const itemsPerPage = 50;
let totalCount = 0;

$(document).ready(async function() {
    // Check authentication status
    await checkAuthStatus();

    // Load manuscripts table
    await loadManuscripts(currentPage);

    // Setup pagination button handlers
    $('#prev-page').click(() => {
        if (currentPage > 1) {
            currentPage--;
            loadManuscripts(currentPage);
        }
    });

    $('#next-page').click(() => {
        const totalPages = Math.ceil(totalCount / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            loadManuscripts(currentPage);
        }
    });
});

async function loadManuscripts(page = 1) {
    try {
        const offset = (page - 1) * itemsPerPage;
        const response = await fetch(`/api/manuscripts?limit=${itemsPerPage}&offset=${offset}`, {
            credentials: 'include'
        });

        $('#loading').hide();

        if (!response.ok) {
            console.error('API error:', response.status, response.statusText);
            $('#no-papers').text('Unable to load manuscripts. Please check that the backend server is running.').show();
            return;
        }

        const data = await response.json();
        totalCount = data.total_count || 0;

        if (!data.manuscripts || data.manuscripts.length === 0) {
            $('#no-papers').show();
            $('#pagination-controls').hide();
            return;
        }

        // Clear existing table rows
        $('#papers-list tbody').empty();

        // Populate table
        data.manuscripts.forEach(manuscript => {
            const row = $('<tr>').addClass('paper-row').attr('data-paper-id', manuscript.id);

            // Date Added
            row.append($('<td>').text(formatDate(manuscript.created_at)));

            // Article Title (clickable)
            row.append($('<td>').html(`<a href="/paper.html?id=${manuscript.id}">${manuscript.title || manuscript.id}</a>`));

            // Total Claims
            row.append($('<td>').text(manuscript.total_claims));

            // LLM Results
            row.append($('<td>').text(manuscript.total_results_llm));

            // Peer Results
            row.append($('<td>').text(manuscript.total_results_peer || '—'));

            // Comparisons
            row.append($('<td>').text(manuscript.total_comparisons));

            // Agree count (empty if no peer reviews)
            if (manuscript.has_peer_reviews) {
                row.append($('<td>').html(`<span class="agree-badge">${manuscript.agree_count || 0}</span>`));
                row.append($('<td>').html(`<span class="partial-badge">${manuscript.partial_count || 0}</span>`));
                row.append($('<td>').html(`<span class="disagree-badge">${manuscript.disagree_count || 0}</span>`));
            } else {
                row.append($('<td>').html('<span class="na-badge">—</span>'));
                row.append($('<td>').html('<span class="na-badge">—</span>'));
                row.append($('<td>').html('<span class="na-badge">—</span>'));
            }

            $('#papers-list tbody').append(row);
        });

        // Make rows clickable
        $('.paper-row').click(function() {
            const paperId = $(this).data('paper-id');
            window.location.href = `/paper.html?id=${paperId}`;
        });

        // Update pagination controls
        updatePaginationControls(page, data.manuscripts.length);

    } catch (error) {
        $('#loading').hide();
        $('#no-papers').html('Error connecting to server. Please ensure the backend is running at <code>http://localhost:8000</code>').show();
        console.error('Error loading manuscripts:', error);
    }
}

function updatePaginationControls(page, itemsOnPage) {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const startItem = (page - 1) * itemsPerPage + 1;
    const endItem = (page - 1) * itemsPerPage + itemsOnPage;

    // Show pagination controls
    $('#pagination-controls').show();

    // Update info text
    $('#showing-range').text(`${startItem}-${endItem}`);
    $('#total-count').text(totalCount);
    $('#current-page').text(page);

    // Update button states
    $('#prev-page').prop('disabled', page === 1);
    $('#next-page').prop('disabled', page >= totalPages);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
