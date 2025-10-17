$(document).ready(async function() {
    // Check authentication status
    await checkAuthStatus();

    // Get manuscript ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const manuscriptId = urlParams.get('id');

    if (!manuscriptId) {
        showError('No manuscript ID provided');
        return;
    }

    // Load manuscript details
    await loadManuscript(manuscriptId);

    // Handle stat card clicks to toggle content
    $(document).on('click', '.stat-card.clickable', function() {
        const target = $(this).data('target');
        const container = $(`#${target}`);

        // Special handling for comparison section (doesn't use collapsible-content class)
        if (target === 'comparison-section') {
            // Close all collapsible containers
            $('.collapsible-content').removeClass('expanded').addClass('collapsed');
            $('.stat-card.clickable').not(this).removeClass('active');

            // Toggle comparison section
            if (container.is(':visible')) {
                container.hide();
                $(this).removeClass('active');
            } else {
                container.show();
                $(this).addClass('active');
            }
        } else {
            // Normal handling for collapsible-content containers
            // Close all other containers and comparison section
            $('.collapsible-content').not(container).removeClass('expanded').addClass('collapsed');
            $('#comparison-section').hide();
            $('.stat-card.clickable').not(this).removeClass('active');

            // Toggle this container
            if (container.hasClass('collapsed')) {
                container.removeClass('collapsed').addClass('expanded');
                $(this).addClass('active');
            } else {
                container.removeClass('expanded').addClass('collapsed');
                $(this).removeClass('active');
            }
        }
    });
});

async function loadManuscript(manuscriptId) {
    try {
        const response = await fetch(`/api/manuscripts/${manuscriptId}`, {
            credentials: 'include'
        });

        $('#loading').hide();

        if (!response.ok) {
            if (response.status === 404) {
                showError('Manuscript not found');
            } else {
                showError(`Error loading manuscript: ${response.statusText}`);
            }
            return;
        }

        const data = await response.json();

        // Store data globally for use in all components
        window.manuscriptData = {
            claims: data.claims,
            results_llm: data.results_llm,
            results_peer: data.results_peer
        };

        // Populate manuscript overview
        populateOverview(data.metadata);

        // Populate summary stats
        populateSummaryStats(data.summary_stats);

        // Populate claims
        populateClaims(data.claims);

        // Populate LLM results
        populateResultsLLM(data.results_llm);

        // Populate peer results (if exist)
        if (data.summary_stats.has_peer_reviews && data.results_peer.length > 0) {
            $('#peer-results-stat').show();
            populateResultsPeer(data.results_peer);
        }

        // Populate comparisons (if exist)
        if (data.summary_stats.has_peer_reviews && data.comparisons.length > 0) {
            $('#comparisons-stat').show();
            $('#total-comparisons').text(data.comparisons.length);
            populateComparisons(data.comparisons);
        }

        // Show manuscript details
        $('#manuscript-details').show();

    } catch (error) {
        $('#loading').hide();
        showError('Error connecting to server. Please ensure the backend is running.');
        console.error('Error loading manuscript:', error);
    }
}

function populateOverview(metadata) {
    $('#manuscript-title').text(metadata.title || metadata.id);
    $('#manuscript-id').text(metadata.id);
    $('#manuscript-doi').text(metadata.doi || 'N/A');
    $('#manuscript-date').text(formatDate(metadata.created_at));
}

function populateSummaryStats(stats) {
    $('#total-claims').text(stats.total_claims);
    $('#total-results-llm').text(stats.total_results_llm);
    $('#total-results-peer').text(stats.total_results_peer);
}

function populateClaims(claims) {
    const container = $('#claims-container');
    container.empty();

    if (claims.length === 0) {
        container.html('<p class="no-data">No claims extracted</p>');
        return;
    }

    // Create table structure
    const table = $('<table>').addClass('claims-list-table');
    const thead = $('<thead>');
    const headerRow = $('<tr>');
    headerRow.append($('<th>').text('Claim ID'));
    headerRow.append($('<th>').text('Type'));
    headerRow.append($('<th>').text('Claim'));
    headerRow.append($('<th>').text('Evidence Type'));
    thead.append(headerRow);
    table.append(thead);

    const tbody = $('<tbody>');

    // Store claims data globally for access in click handler
    window.claimsListData = claims;

    claims.forEach((claim, index) => {
        const row = $('<tr>').addClass('claim-list-row').attr('data-claim-index', index);

        // Claim ID
        const displayId = claim.claim_id || claim.id;
        row.append($('<td>').text(displayId));

        // Claim Type
        row.append($('<td>').html(`<span class="claim-type-badge">${claim.claim_type}</span>`));

        // Claim text (truncated if long)
        const claimCell = $('<td>').addClass('claim-text-cell');
        const maxLength = 200;
        if (claim.claim.length > maxLength) {
            claimCell.text(claim.claim.substring(0, maxLength) + '...');
        } else {
            claimCell.text(claim.claim);
        }
        row.append(claimCell);

        // Evidence type
        const evidenceCell = $('<td>').addClass('evidence-type-cell');
        if (claim.evidence_type && claim.evidence_type.length > 0) {
            claim.evidence_type.forEach(type => {
                evidenceCell.append($('<span>').addClass('evidence-type-tag').text(type));
            });
        } else {
            evidenceCell.text('—');
        }
        row.append(evidenceCell);

        tbody.append(row);
    });

    table.append(tbody);
    container.append(table);

    // Add click handler for expandable rows
    $('.claim-list-row').click(function() {
        const index = $(this).data('claim-index');
        const nextRow = $(this).next();

        // Check if next row is already an expanded detail row
        if (nextRow.hasClass('claim-detail-row')) {
            // Collapse: remove the detail row
            nextRow.remove();
            $(this).removeClass('expanded');
        } else {
            // Expand: insert detail row
            // First, collapse any other expanded rows
            $('.claim-detail-row').remove();
            $('.claim-list-row').removeClass('expanded');

            const claim = window.claimsListData[index];
            const detailRow = createClaimDetailRow(claim);
            $(this).after(detailRow);
            $(this).addClass('expanded');
        }
    });
}

function createClaimDetailRow(claim) {
    const detailRow = $('<tr>').addClass('claim-detail-row');
    const detailCell = $('<td>').attr('colspan', 4);

    const detailContainer = $('<div>').addClass('claim-detail-container');

    // Full claim text
    detailContainer.append($('<div>').addClass('claim-detail-field').html(`<strong>Full Claim:</strong><div class="claim-full-text">${claim.claim}</div>`));

    // Source text
    if (claim.source_text) {
        detailContainer.append($('<div>').addClass('claim-detail-field').html(`<strong>Source Text:</strong><div class="source-text-box">${claim.source_text}</div>`));
    }

    // Evidence reasoning
    if (claim.evidence_reasoning) {
        detailContainer.append($('<div>').addClass('claim-detail-field').html(`<strong>Evidence Reasoning:</strong><div class="reasoning-box">${claim.evidence_reasoning}</div>`));
    }

    detailCell.append(detailContainer);
    detailRow.append(detailCell);

    return detailRow;
}

function populateResultsLLM(results) {
    const container = $('#llm-results-container');
    container.empty();

    if (results.length === 0) {
        container.html('<p class="no-data">No LLM results</p>');
        return;
    }

    // Create table structure
    const table = $('<table>').addClass('results-table');
    const thead = $('<thead>');
    const headerRow = $('<tr>');
    headerRow.append($('<th>').text('Result ID'));
    headerRow.append($('<th>').text('Status'));
    headerRow.append($('<th>').text('# Claims'));
    headerRow.append($('<th>').text('Reasoning'));
    thead.append(headerRow);
    table.append(thead);

    const tbody = $('<tbody>');

    // Store results data globally for access in click handler
    window.llmResultsData = results;

    results.forEach((result, index) => {
        const row = $('<tr>').addClass('result-row').attr('data-result-index', index);

        // Result ID
        row.append($('<td>').text(`Result ${result.id}`));

        // Status badge
        row.append($('<td>').html(`<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`));

        // Number of claims
        row.append($('<td>').text(result.claim_ids ? result.claim_ids.length : 0));

        // Reasoning (with expand button if long)
        const reasoningCell = $('<td>').addClass('reasoning-cell');
        if (result.result_reasoning) {
            const maxLength = 150;
            if (result.result_reasoning.length > maxLength) {
                const shortReasoning = result.result_reasoning.substring(0, maxLength) + '...';
                const reasoningSpan = $('<span>').text(shortReasoning);
                const expandBtn = $('<button>').addClass('expand-button').text('Expand');

                expandBtn.click(function(e) {
                    e.stopPropagation(); // Prevent row click
                    if (reasoningSpan.text().endsWith('...')) {
                        reasoningSpan.text(result.result_reasoning);
                        $(this).text('Collapse');
                    } else {
                        reasoningSpan.text(shortReasoning);
                        $(this).text('Expand');
                    }
                });

                reasoningCell.append(reasoningSpan).append(' ').append(expandBtn);
            } else {
                reasoningCell.text(result.result_reasoning);
            }
        } else {
            reasoningCell.text('—');
        }
        row.append(reasoningCell);

        tbody.append(row);
    });

    table.append(tbody);
    container.append(table);

    // Add click handler for expandable rows
    $('.result-row').click(function() {
        const index = $(this).data('result-index');
        const nextRow = $(this).next();

        // Check if next row is already an expanded detail row
        if (nextRow.hasClass('result-detail-row')) {
            // Collapse: remove the detail row
            nextRow.remove();
            $(this).removeClass('expanded');
        } else {
            // Expand: insert detail row
            // First, collapse any other expanded rows
            $('.result-detail-row').remove();
            $('.result-row').removeClass('expanded');

            const result = window.llmResultsData[index];
            const detailRow = createResultDetailRow(result);
            $(this).after(detailRow);
            $(this).addClass('expanded');
        }
    });
}

function createResultDetailRow(result) {
    const detailRow = $('<tr>').addClass('result-detail-row');
    const detailCell = $('<td>').attr('colspan', 4);

    const detailContainer = $('<div>').addClass('result-detail-container');

    // Claims table only
    if (result.claim_ids && result.claim_ids.length > 0) {
        detailContainer.append($('<strong>').text('Claims Evaluated:').css('display', 'block').css('margin-bottom', '0.5rem'));
        detailContainer.append(createClaimsTable(result.claim_ids));
    } else {
        detailContainer.append($('<p>').addClass('no-data').text('No claims associated with this result'));
    }

    detailCell.append(detailContainer);
    detailRow.append(detailCell);

    return detailRow;
}

function populateResultsPeer(results) {
    const container = $('#peer-results-container');
    container.empty();

    if (results.length === 0) {
        return;
    }

    // Create table structure
    const table = $('<table>').addClass('results-table');
    const thead = $('<thead>');
    const headerRow = $('<tr>');
    headerRow.append($('<th>').text('Result ID'));
    headerRow.append($('<th>').text('Status'));
    headerRow.append($('<th>').text('# Claims'));
    headerRow.append($('<th>').text('Reasoning'));
    thead.append(headerRow);
    table.append(thead);

    const tbody = $('<tbody>');

    // Store results data globally for access in click handler
    window.peerResultsData = results;

    results.forEach((result, index) => {
        const row = $('<tr>').addClass('result-row').attr('data-peer-result-index', index);

        // Result ID
        row.append($('<td>').text(`Result ${result.id}`));

        // Status badge
        row.append($('<td>').html(`<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`));

        // Number of claims
        row.append($('<td>').text(result.claim_ids ? result.claim_ids.length : 0));

        // Reasoning (with expand button if long)
        const reasoningCell = $('<td>').addClass('reasoning-cell');
        if (result.result_reasoning) {
            const maxLength = 150;
            if (result.result_reasoning.length > maxLength) {
                const shortReasoning = result.result_reasoning.substring(0, maxLength) + '...';
                const reasoningSpan = $('<span>').text(shortReasoning);
                const expandBtn = $('<button>').addClass('expand-button').text('Expand');

                expandBtn.click(function(e) {
                    e.stopPropagation(); // Prevent row click
                    if (reasoningSpan.text().endsWith('...')) {
                        reasoningSpan.text(result.result_reasoning);
                        $(this).text('Collapse');
                    } else {
                        reasoningSpan.text(shortReasoning);
                        $(this).text('Expand');
                    }
                });

                reasoningCell.append(reasoningSpan).append(' ').append(expandBtn);
            } else {
                reasoningCell.text(result.result_reasoning);
            }
        } else {
            reasoningCell.text('—');
        }
        row.append(reasoningCell);

        tbody.append(row);
    });

    table.append(tbody);
    container.append(table);

    // Add click handler for expandable rows
    $('[data-peer-result-index]').click(function() {
        const index = $(this).data('peer-result-index');
        const nextRow = $(this).next();

        // Check if next row is already an expanded detail row
        if (nextRow.hasClass('result-detail-row')) {
            // Collapse: remove the detail row
            nextRow.remove();
            $(this).removeClass('expanded');
        } else {
            // Expand: insert detail row
            // First, collapse any other expanded rows in peer results
            $('[data-peer-result-index]').removeClass('expanded');
            $('[data-peer-result-index]').next('.result-detail-row').remove();

            const result = window.peerResultsData[index];
            const detailRow = createResultDetailRow(result);
            $(this).after(detailRow);
            $(this).addClass('expanded');
        }
    });
}

function createResultClaimsTable(claimIds) {
    const container = $('<div>').addClass('result-claims-section');
    container.append($('<strong>').text('Claims Evaluated:'));

    const tableContainer = $('<div>').addClass('claims-table-container');
    const table = $('<table>').addClass('claims-table');

    const tbody = $('<tbody>');

    claimIds.forEach(claimId => {
        const claim = window.manuscriptData.claims.find(c => c.id === claimId);
        if (claim) {
            const row = $('<tr>');
            // Use the simple claim_id (like "C1", "C2") if available, otherwise fallback to UUID
            const displayId = claim.claim_id || claimId;
            row.append($('<td>').addClass('claim-id-cell').text(displayId));
            row.append($('<td>').addClass('claim-text-cell').text(claim.claim));
            tbody.append(row);
        }
    });

    table.append(tbody);
    tableContainer.append(table);
    container.append(tableContainer);

    return container;
}

function populateComparisons(comparisons) {
    const tbody = $('#comparison-table-body');
    const section = $('#comparison-section');
    tbody.empty();

    if (comparisons.length === 0) {
        return;  // Keep section hidden
    }

    // Don't automatically show - let the stat card control visibility
    // section.show();

    // Store comparisons data globally for access in click handler
    window.comparisonsData = comparisons;

    comparisons.forEach((comp, index) => {
        const row = $('<tr>').addClass('comparison-row').attr('data-comparison-index', index);

        // LLM Result
        row.append($('<td>').text(comp.llm_result_id || 'N/A'));

        // Peer Result
        row.append($('<td>').text(comp.peer_result_id || 'N/A'));

        // LLM Status
        row.append($('<td>').html(`<span class="status-badge status-${(comp.llm_status || '').toLowerCase()}">${comp.llm_status || 'N/A'}</span>`));

        // Peer Status
        row.append($('<td>').html(`<span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span>`));

        // Agreement
        const agreementClass = `agreement-${comp.agreement_status}`;
        row.append($('<td>').html(`<span class="agreement-badge ${agreementClass}">${comp.agreement_status}</span>`));

        // Notes (with expand button if long)
        const notesCell = $('<td>');
        if (comp.notes) {
            if (comp.notes.length > 100) {
                const shortNotes = comp.notes.substring(0, 100) + '...';
                const notesSpan = $('<span>').text(shortNotes);
                const expandBtn = $('<button>').addClass('expand-button').text('Expand');

                expandBtn.click(function(e) {
                    e.stopPropagation(); // Prevent row click
                    if (notesSpan.text().endsWith('...')) {
                        notesSpan.text(comp.notes);
                        $(this).text('Collapse');
                    } else {
                        notesSpan.text(shortNotes);
                        $(this).text('Expand');
                    }
                });

                notesCell.append(notesSpan).append(' ').append(expandBtn);
            } else {
                notesCell.text(comp.notes);
            }
        } else {
            notesCell.text('—');
        }
        row.append(notesCell);

        tbody.append(row);
    });

    // Add click handler for expandable rows
    $('.comparison-row').click(function() {
        const index = $(this).data('comparison-index');
        const nextRow = $(this).next();

        // Check if next row is already an expanded detail row
        if (nextRow.hasClass('comparison-detail-row')) {
            // Collapse: remove the detail row
            nextRow.remove();
            $(this).removeClass('expanded');
        } else {
            // Expand: insert detail row
            // First, collapse any other expanded rows
            $('.comparison-detail-row').remove();
            $('.comparison-row').removeClass('expanded');

            const comp = window.comparisonsData[index];
            const detailRow = createComparisonDetailRow(comp);
            $(this).after(detailRow);
            $(this).addClass('expanded');
        }
    });
}

function createComparisonDetailRow(comp) {
    const detailRow = $('<tr>').addClass('comparison-detail-row');
    const detailCell = $('<td>').attr('colspan', 6);

    const detailContainer = $('<div>').addClass('comparison-detail-container');

    // Find the full result objects
    const llmResult = window.manuscriptData.results_llm.find(r => r.id === comp.llm_result_id);
    const peerResult = window.manuscriptData.results_peer.find(r => r.id === comp.peer_result_id);

    // Left side: LLM Result
    const llmSide = $('<div>').addClass('result-detail-side');
    llmSide.append($('<h4>').text('LLM Result'));
    llmSide.append($('<div>').addClass('result-detail-field').html(`<strong>Result ID:</strong> ${comp.llm_result_id || 'N/A'}`));
    llmSide.append($('<div>').addClass('result-detail-field').html(`<strong>Status:</strong> <span class="status-badge status-${(comp.llm_status || '').toLowerCase()}">${comp.llm_status || 'N/A'}</span>`));

    // Add reasoning first
    if (comp.llm_reasoning) {
        llmSide.append($('<div>').addClass('result-detail-field').html(`<strong>Reasoning:</strong><div class="reasoning-box">${comp.llm_reasoning}</div>`));
    }

    // Add claims table after reasoning
    if (llmResult && llmResult.claim_ids && llmResult.claim_ids.length > 0) {
        llmSide.append(createClaimsTable(llmResult.claim_ids));
    }

    // Right side: Peer Result
    const peerSide = $('<div>').addClass('result-detail-side');
    peerSide.append($('<h4>').text('Peer Result'));
    peerSide.append($('<div>').addClass('result-detail-field').html(`<strong>Result ID:</strong> ${comp.peer_result_id || 'N/A'}`));
    peerSide.append($('<div>').addClass('result-detail-field').html(`<strong>Status:</strong> <span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span>`));

    // Add reasoning first
    if (comp.peer_reasoning) {
        peerSide.append($('<div>').addClass('result-detail-field').html(`<strong>Reasoning:</strong><div class="reasoning-box">${comp.peer_reasoning}</div>`));
    }

    // Add claims table after reasoning
    if (peerResult && peerResult.claim_ids && peerResult.claim_ids.length > 0) {
        peerSide.append(createClaimsTable(peerResult.claim_ids));
    }

    detailContainer.append(llmSide);
    detailContainer.append(peerSide);
    detailCell.append(detailContainer);
    detailRow.append(detailCell);

    return detailRow;
}

function createClaimsTable(claimIds) {
    const container = $('<div>').addClass('result-detail-field');
    container.append($('<strong>').text('Claims:'));

    const tableContainer = $('<div>').addClass('claims-table-container');
    const table = $('<table>').addClass('claims-table');

    const tbody = $('<tbody>');

    claimIds.forEach(claimId => {
        const claim = window.manuscriptData.claims.find(c => c.id === claimId);
        if (claim) {
            const row = $('<tr>');
            // Use the simple claim_id (like "C1", "C2") if available, otherwise fallback to UUID
            const displayId = claim.claim_id || claimId;
            row.append($('<td>').addClass('claim-id-cell').text(displayId));
            row.append($('<td>').addClass('claim-text-cell').text(claim.claim));
            tbody.append(row);
        }
    });

    table.append(tbody);
    tableContainer.append(table);
    container.append(tableContainer);

    return container;
}

function showError(message) {
    $('#error').text(message).show();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
