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

// Global DataTable instances
let claimsTable;
let llmResultsTable;
let peerResultsTable;
let comparisonsTable;

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
            results_peer: data.results_peer,
            comparisons: data.comparisons || []
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

    // Set DOI as clickable link
    if (metadata.doi) {
        const doiUrl = `https://doi.org/${metadata.doi}`;
        $('#manuscript-doi').attr('href', doiUrl).text(metadata.doi);
    } else {
        $('#manuscript-doi').attr('href', '#').text('N/A').css('pointer-events', 'none');
    }

    // Display abstract if available
    if (metadata.abstract) {
        $('#manuscript-abstract').text(metadata.abstract);
        $('#manuscript-abstract-container').show();
    }

    // Display publication date if available
    if (metadata.pub_date) {
        $('#manuscript-pub-date').text(formatDate(metadata.pub_date));
        $('#pub-date-container').show();
    }

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
    container.html('<table id="claims-table" class="display claims-list-table" style="width:100%"></table>');

    // Prepare data for DataTables
    const tableData = claims.map(claim => {
        const displayId = claim.claim_id || claim.id;
        const typeBadge = `<span class="claim-type-badge">${claim.claim_type}</span>`;

        // Truncate claim text
        const maxLength = 200;
        const claimText = claim.claim.length > maxLength
            ? claim.claim.substring(0, maxLength) + '...'
            : claim.claim;

        // Evidence type badges
        let evidenceBadges = '—';
        if (claim.evidence_type && claim.evidence_type.length > 0) {
            evidenceBadges = claim.evidence_type.map(type =>
                `<span class="evidence-type-tag">${type}</span>`
            ).join(' ');
        }

        return [displayId, typeBadge, claimText, evidenceBadges];
    });

    // Initialize DataTable
    claimsTable = $('#claims-table').DataTable({
        data: tableData,
        columns: [
            { title: 'Claim ID', width: '10%' },
            { title: 'Type', width: '15%' },
            { title: 'Claim', width: '55%' },
            { title: 'Evidence Type', width: '20%' }
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[0, 'asc']],
        language: {
            search: 'Search claims:',
            lengthMenu: 'Show _MENU_ claims',
            info: 'Showing _START_ to _END_ of _TOTAL_ claims',
            infoEmpty: 'No claims available',
            infoFiltered: '(filtered from _MAX_ total claims)'
        }
    });

    // Add click handler for expandable rows using DataTables child rows API
    $('#claims-table tbody').on('click', 'tr', function() {
        const row = claimsTable.row(this);

        if (row.child.isShown()) {
            // Close this row
            row.child.hide();
            $(this).removeClass('expanded');
        } else {
            // Close all other rows
            claimsTable.rows().every(function() {
                if (this.child.isShown()) {
                    this.child.hide();
                    $(this.node()).removeClass('expanded');
                }
            });

            // Open this row
            const rowIndex = claimsTable.row(this).index();
            const claim = window.manuscriptData.claims[rowIndex];
            row.child(formatClaimDetails(claim)).show();
            $(this).addClass('expanded');
        }
    });
}

function formatClaimDetails(claim) {
    let html = '<div class="claim-detail-container">';

    // Full claim text
    html += '<div class="claim-detail-field">';
    html += '<strong>Full Claim:</strong>';
    html += `<div class="claim-full-text">${claim.claim}</div>`;
    html += '</div>';

    // Source text
    if (claim.source_text) {
        html += '<div class="claim-detail-field">';
        html += '<strong>Source Text:</strong>';
        html += `<div class="source-text-box">${claim.source_text}</div>`;
        html += '</div>';
    }

    // Evidence reasoning
    if (claim.evidence_reasoning) {
        html += '<div class="claim-detail-field">';
        html += '<strong>Evidence Reasoning:</strong>';
        html += `<div class="reasoning-box">${claim.evidence_reasoning}</div>`;
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function populateResultsLLM(results) {
    const container = $('#llm-results-container');
    container.empty();

    if (results.length === 0) {
        container.html('<p class="no-data">No LLM results</p>');
        return;
    }

    // Create table structure
    container.html('<table id="llm-results-table" class="display results-table" style="width:100%"></table>');

    // Prepare data for DataTables
    const tableData = results.map(result => {
        const statusBadge = `<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`;
        const claimCount = result.claim_ids ? result.claim_ids.length : 0;
        const reasoning = result.result_reasoning || '—';

        return [statusBadge, claimCount, reasoning];
    });

    // Initialize DataTable
    llmResultsTable = $('#llm-results-table').DataTable({
        data: tableData,
        columns: [
            { title: 'Status', width: '20%' },
            { title: '# Claims', width: '15%' },
            { title: 'Reasoning', width: '65%' }
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50],
        order: [[0, 'asc']],
        language: {
            search: 'Search results:',
            lengthMenu: 'Show _MENU_ results',
            info: 'Showing _START_ to _END_ of _TOTAL_ results'
        }
    });

    // Add click handler for expandable rows
    $('#llm-results-table tbody').on('click', 'tr', function() {
        const row = llmResultsTable.row(this);

        if (row.child.isShown()) {
            row.child.hide();
            $(this).removeClass('expanded');
        } else {
            // Close all other rows
            llmResultsTable.rows().every(function() {
                if (this.child.isShown()) {
                    this.child.hide();
                    $(this.node()).removeClass('expanded');
                }
            });

            // Open this row
            const rowIndex = llmResultsTable.row(this).index();
            const result = window.manuscriptData.results_llm[rowIndex];
            row.child(formatResultDetails(result)).show();
            $(this).addClass('expanded');
        }
    });
}

function formatResultDetails(result) {
    let html = '<div class="result-detail-container">';

    // Claims table
    if (result.claim_ids && result.claim_ids.length > 0) {
        html += '<strong style="display:block;margin-bottom:0.5rem;">Claims Evaluated:</strong>';
        html += formatClaimsTable(result.claim_ids);
    } else {
        html += '<p class="no-data">No claims associated with this result</p>';
    }

    html += '</div>';
    return html;
}

function formatClaimsTable(claimIds) {
    let html = '<div class="claims-table-container">';
    html += '<table class="claims-table">';
    html += '<tbody>';

    claimIds.forEach(claimId => {
        const claim = window.manuscriptData.claims.find(c => c.id === claimId);
        if (claim) {
            const displayId = claim.claim_id || claimId;
            html += '<tr>';
            html += `<td class="claim-id-cell">${displayId}</td>`;
            html += `<td class="claim-text-cell">${claim.claim}</td>`;
            html += '</tr>';
        }
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
}

function populateResultsPeer(results) {
    const container = $('#peer-results-container');
    container.empty();

    if (results.length === 0) {
        return;
    }

    // Create table structure
    container.html('<table id="peer-results-table" class="display results-table" style="width:100%"></table>');

    // Prepare data for DataTables
    const tableData = results.map(result => {
        const statusBadge = `<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`;
        const claimCount = result.claim_ids ? result.claim_ids.length : 0;
        const reasoning = result.result_reasoning || '—';

        return [statusBadge, claimCount, reasoning];
    });

    // Initialize DataTable
    peerResultsTable = $('#peer-results-table').DataTable({
        data: tableData,
        columns: [
            { title: 'Status', width: '20%' },
            { title: '# Claims', width: '15%' },
            { title: 'Reasoning', width: '65%' }
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50],
        order: [[0, 'asc']],
        language: {
            search: 'Search results:',
            lengthMenu: 'Show _MENU_ results',
            info: 'Showing _START_ to _END_ of _TOTAL_ results'
        }
    });

    // Add click handler for expandable rows
    $('#peer-results-table tbody').on('click', 'tr', function() {
        const row = peerResultsTable.row(this);

        if (row.child.isShown()) {
            row.child.hide();
            $(this).removeClass('expanded');
        } else {
            // Close all other rows
            peerResultsTable.rows().every(function() {
                if (this.child.isShown()) {
                    this.child.hide();
                    $(this.node()).removeClass('expanded');
                }
            });

            // Open this row
            const rowIndex = peerResultsTable.row(this).index();
            const result = window.manuscriptData.results_peer[rowIndex];
            row.child(formatResultDetails(result)).show();
            $(this).addClass('expanded');
        }
    });
}

function populateComparisons(comparisons) {
    const tbody = $('#comparison-table-body');
    const section = $('#comparison-section');
    tbody.empty();

    if (comparisons.length === 0) {
        return;
    }

    // Clear existing table and create new one
    $('#comparison-section .comparison-container').html('<table id="comparisons-table" class="display comparison-table" style="width:100%"></table>');

    // Prepare data for DataTables
    const tableData = comparisons.map(comp => {
        const llmStatusBadge = `<span class="status-badge status-${(comp.llm_status || '').toLowerCase()}">${comp.llm_status || 'N/A'}</span>`;
        const peerStatusBadge = `<span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span>`;
        const agreementBadge = `<span class="agreement-badge agreement-${comp.agreement_status}">${comp.agreement_status}</span>`;
        const notes = comp.notes || '—';

        return [llmStatusBadge, peerStatusBadge, agreementBadge, notes];
    });

    // Initialize DataTable
    comparisonsTable = $('#comparisons-table').DataTable({
        data: tableData,
        columns: [
            { title: 'OpenEval Status', width: '20%' },
            { title: 'Peer Status', width: '20%' },
            { title: 'Agreement', width: '20%' },
            { title: 'Notes', width: '40%' }
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50],
        order: [[2, 'asc']],
        language: {
            search: 'Search comparisons:',
            lengthMenu: 'Show _MENU_ comparisons',
            info: 'Showing _START_ to _END_ of _TOTAL_ comparisons'
        }
    });

    // Add click handler for expandable rows
    $('#comparisons-table tbody').on('click', 'tr', function() {
        const row = comparisonsTable.row(this);

        if (row.child.isShown()) {
            row.child.hide();
            $(this).removeClass('expanded');
        } else {
            // Close all other rows
            comparisonsTable.rows().every(function() {
                if (this.child.isShown()) {
                    this.child.hide();
                    $(this.node()).removeClass('expanded');
                }
            });

            // Open this row
            const rowIndex = comparisonsTable.row(this).index();
            const comp = window.manuscriptData.comparisons[rowIndex];
            row.child(formatComparisonDetails(comp)).show();
            $(this).addClass('expanded');
        }
    });
}

function formatComparisonDetails(comp) {
    // Find the full result objects
    const llmResult = window.manuscriptData.results_llm.find(r => r.id === comp.llm_result_id);
    const peerResult = window.manuscriptData.results_peer.find(r => r.id === comp.peer_result_id);

    let html = '<div class="comparison-detail-container">';

    // Left side: OpenEval Result
    html += '<div class="result-detail-side">';
    html += '<h4>OpenEval Result</h4>';
    html += `<div class="result-detail-field"><strong>Status:</strong> <span class="status-badge status-${(comp.llm_status || '').toLowerCase()}">${comp.llm_status || 'N/A'}</span></div>`;

    if (comp.llm_reasoning) {
        html += '<div class="result-detail-field">';
        html += '<strong>Reasoning:</strong>';
        html += `<div class="reasoning-box">${comp.llm_reasoning}</div>`;
        html += '</div>';
    }

    if (llmResult && llmResult.claim_ids && llmResult.claim_ids.length > 0) {
        html += formatClaimsTableWithLabel(llmResult.claim_ids);
    }

    html += '</div>';

    // Right side: Peer Result
    html += '<div class="result-detail-side">';
    html += '<h4>Peer Result</h4>';
    html += `<div class="result-detail-field"><strong>Status:</strong> <span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span></div>`;

    if (comp.peer_reasoning) {
        html += '<div class="result-detail-field">';
        html += '<strong>Reasoning:</strong>';
        html += `<div class="reasoning-box">${comp.peer_reasoning}</div>`;
        html += '</div>';
    }

    if (peerResult && peerResult.claim_ids && peerResult.claim_ids.length > 0) {
        html += formatClaimsTableWithLabel(peerResult.claim_ids);
    }

    html += '</div>';
    html += '</div>';

    return html;
}

function formatClaimsTableWithLabel(claimIds) {
    let html = '<div class="result-detail-field">';
    html += '<strong>Claims:</strong>';
    html += '<div class="claims-table-container">';
    html += '<table class="claims-table">';
    html += '<tbody>';

    claimIds.forEach(claimId => {
        const claim = window.manuscriptData.claims.find(c => c.id === claimId);
        if (claim) {
            const displayId = claim.claim_id || claimId;
            html += '<tr>';
            html += `<td class="claim-id-cell">${displayId}</td>`;
            html += `<td class="claim-text-cell">${claim.claim}</td>`;
            html += '</tr>';
        }
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    html += '</div>';
    return html;
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
