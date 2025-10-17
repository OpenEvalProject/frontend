$(document).ready(async function() {
    // Check authentication status
    await checkAuthStatus();

    // Load manuscripts table
    await loadManuscripts();
});

async function loadManuscripts() {
    try {
        const response = await fetch('/api/manuscripts', {
            credentials: 'include'
        });

        $('#loading').hide();

        if (!response.ok) {
            console.error('API error:', response.status, response.statusText);
            $('#no-papers').text('Unable to load manuscripts. Please check that the backend server is running.').show();
            return;
        }

        const data = await response.json();

        if (!data.manuscripts || data.manuscripts.length === 0) {
            $('#no-papers').show();
            return;
        }

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

    } catch (error) {
        $('#loading').hide();
        $('#no-papers').html('Error connecting to server. Please ensure the backend is running at <code>http://localhost:8000</code>').show();
        console.error('Error loading manuscripts:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
