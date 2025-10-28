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

    // Handle stat card clicks to toggle content (updated for compact layout)
    $(document).on('click', '.stat-card-compact.clickable, .stat-card.clickable', function() {
        const target = $(this).data('target');
        const container = $(`#${target}`);

        // Special handling for comparison section (doesn't use collapsible-content class)
        if (target === 'comparison-section') {
            // Close all collapsible containers
            $('.collapsible-content').removeClass('expanded').addClass('collapsed');
            $('.stat-card-compact.clickable, .stat-card.clickable').not(this).removeClass('active');

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
            $('.stat-card-compact.clickable, .stat-card.clickable').not(this).removeClass('active');

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

        // Populate manuscript ID badge
        populateManuscriptHeader(data.metadata);

        // Populate summary stats (compact)
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
            populateComparisons(data.comparisons);
        }

        // Auto-load manuscript if JATS is available
        if (data.metadata.has_jats) {
            await loadAndRenderManuscript(manuscriptId);
        }

        // Show two-column layout
        $('#paper-layout').show();

    } catch (error) {
        $('#loading').hide();
        showError('Error connecting to server. Please ensure the backend is running.');
        console.error('Error loading manuscript:', error);
    }
}

function populateManuscriptHeader(metadata) {
    // Set manuscript ID badge in left column header
    $('#manuscript-id-badge').text(metadata.id);
}

function populateSummaryStats(stats) {
    $('#total-claims').text(stats.total_claims);
    $('#total-results-llm').text(stats.total_results_llm);
    $('#total-results-peer').text(stats.total_results_peer);

    // Update LLM results breakdown
    if (stats.total_results_llm > 0) {
        $('#llm-supported-count').text(stats.llm_supported_count || 0);
        $('#llm-unsupported-count').text(stats.llm_unsupported_count || 0);
        $('#llm-uncertain-count').text(stats.llm_uncertain_count || 0);
        $('#llm-breakdown').show();
    }

    // Update peer results breakdown (if peer reviews exist)
    if (stats.has_peer_reviews && stats.total_results_peer > 0) {
        $('#peer-supported-count').text(stats.peer_supported_count || 0);
        $('#peer-unsupported-count').text(stats.peer_unsupported_count || 0);
        $('#peer-uncertain-count').text(stats.peer_uncertain_count || 0);
        $('#peer-breakdown').show();
    }

    // Update comparison stats with agreement breakdown
    if (stats.total_comparisons > 0) {
        $('#total-comparisons').text(stats.total_comparisons);

        // Show breakdown if we have agreement counts
        if (stats.agree_count !== null) {
            $('#agree-count-badge').text(stats.agree_count || 0);
            $('#partial-count-badge').text(stats.partial_count || 0);
            $('#disagree-count-badge').text(stats.disagree_count || 0);
            $('#disjoint-count-badge').text(stats.disjoint_count || 0);
            $('#comparison-breakdown').show();
        }
    }
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

    // Source text (field name changed from source_text to source)
    if (claim.source) {
        html += '<div class="claim-detail-field">';
        html += '<strong>Source Text:</strong>';
        html += `<div class="source-text-box">${claim.source}</div>`;
        html += '</div>';
    }

    // Source type badges
    if (claim.source_type && claim.source_type.length > 0) {
        html += '<div class="claim-detail-field">';
        html += '<strong>Source Type:</strong> ';
        html += claim.source_type.map(type =>
            `<span class="evidence-type-tag">${type}</span>`
        ).join(' ');
        html += '</div>';
    }

    // Evidence reasoning (field name changed from evidence_reasoning to evidence)
    if (claim.evidence) {
        html += '<div class="claim-detail-field">';
        html += '<strong>Evidence:</strong>';
        html += `<div class="reasoning-box">${claim.evidence}</div>`;
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
        const resultId = result.result_id || result.id.slice(0, 8);
        const resultText = result.result || '—';
        const statusBadge = `<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`;
        const claimCount = result.claim_ids ? result.claim_ids.length : 0;

        // Get result types from comparisons
        const resultTypes = getResultTypesForResult(result.id);
        const typeBadges = resultTypes.length > 0
            ? resultTypes.map(type => `<span class="result-type-badge result-type-${type.toLowerCase()}">${type}</span>`).join(' ')
            : '—';

        const reasoning = result.result_reasoning || '—';

        return [resultId, resultText, statusBadge, typeBadges, claimCount, reasoning];
    });

    // Initialize DataTable
    llmResultsTable = $('#llm-results-table').DataTable({
        data: tableData,
        columns: [
            { title: 'Result ID', width: '8%' },
            { title: 'Result', width: '22%' },
            { title: 'Status', width: '10%' },
            { title: 'Type', width: '10%' },
            { title: '# Claims', width: '7%' },
            { title: 'Reasoning', width: '43%' }
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

function getResultTypesForResult(resultId) {
    // Find all comparisons that reference this result
    const types = new Set();

    if (window.manuscriptData.comparisons) {
        window.manuscriptData.comparisons.forEach(comp => {
            if (comp.openeval_result_id === resultId && comp.openeval_result_type) {
                types.add(comp.openeval_result_type);
            }
            if (comp.peer_result_id === resultId && comp.peer_result_type) {
                types.add(comp.peer_result_type);
            }
        });
    }

    return Array.from(types);
}

function formatClaimsTable(claimIds) {
    let html = '<div class="claims-table-container">';
    html += '<table class="claims-table">';
    html += '<tbody>';

    if (!claimIds || claimIds.length === 0) {
        html += '<tr><td colspan="2" class="no-data">No claims associated</td></tr>';
    } else {
        claimIds.forEach(claimId => {
            // Match by claim_id (C1, C2, etc.) not by UUID
            const claim = window.manuscriptData.claims.find(c => c.claim_id === claimId);
            if (claim) {
                html += '<tr>';
                html += `<td class="claim-id-cell">${claimId}</td>`;
                html += `<td class="claim-text-cell">${claim.claim}</td>`;
                html += '</tr>';
            } else {
                console.log('Claim not found for claim_id:', claimId);
            }
        });
    }

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
        const resultId = result.result_id || result.id.slice(0, 8);
        const resultText = result.result || '—';
        const statusBadge = `<span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span>`;
        const claimCount = result.claim_ids ? result.claim_ids.length : 0;

        // Get result types from comparisons
        const resultTypes = getResultTypesForResult(result.id);
        const typeBadges = resultTypes.length > 0
            ? resultTypes.map(type => `<span class="result-type-badge result-type-${type.toLowerCase()}">${type}</span>`).join(' ')
            : '—';

        const reasoning = result.result_reasoning || '—';

        return [resultId, resultText, statusBadge, typeBadges, claimCount, reasoning];
    });

    // Initialize DataTable
    peerResultsTable = $('#peer-results-table').DataTable({
        data: tableData,
        columns: [
            { title: 'Result ID', width: '8%' },
            { title: 'Result', width: '22%' },
            { title: 'Status', width: '10%' },
            { title: 'Type', width: '10%' },
            { title: '# Claims', width: '7%' },
            { title: 'Reasoning', width: '43%' }
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
        const openevalStatusBadge = `<span class="status-badge status-${(comp.openeval_status || '').toLowerCase()}">${comp.openeval_status || 'N/A'}</span>`;
        const peerStatusBadge = `<span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span>`;

        // NEW: Display result type badges with type-specific colors
        const openevalTypeBadge = comp.openeval_result_type
            ? `<span class="result-type-badge result-type-${comp.openeval_result_type.toLowerCase()}">${comp.openeval_result_type}</span>`
            : '—';
        const peerTypeBadge = comp.peer_result_type
            ? `<span class="result-type-badge result-type-${comp.peer_result_type.toLowerCase()}">${comp.peer_result_type}</span>`
            : '—';

        const agreementBadge = `<span class="agreement-badge agreement-${comp.agreement_status}">${comp.agreement_status}</span>`;
        const comparison = comp.comparison || '—';

        return [openevalStatusBadge, openevalTypeBadge, peerStatusBadge, peerTypeBadge, agreementBadge, comparison];
    });

    // Initialize DataTable
    comparisonsTable = $('#comparisons-table').DataTable({
        data: tableData,
        columns: [
            { title: 'OpenEval Status', width: '15%' },
            { title: 'OpenEval Type', width: '12%' },
            { title: 'Peer Status', width: '15%' },
            { title: 'Peer Type', width: '12%' },
            { title: 'Agreement', width: '15%' },
            { title: 'Comparison', width: '31%' }
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
    const openevalResult = window.manuscriptData.results_llm.find(r => r.id === comp.openeval_result_id);
    const peerResult = window.manuscriptData.results_peer.find(r => r.id === comp.peer_result_id);

    let html = '<div class="comparison-detail-container">';

    // Left side: OpenEval Result
    html += '<div class="result-detail-side">';
    html += '<h4>OpenEval Result</h4>';
    html += `<div class="result-detail-field"><strong>Status:</strong> <span class="status-badge status-${(comp.openeval_status || '').toLowerCase()}">${comp.openeval_status || 'N/A'}</span></div>`;

    // NEW: Display result type
    if (comp.openeval_result_type) {
        html += `<div class="result-detail-field"><strong>Type:</strong> <span class="result-type-badge result-type-${comp.openeval_result_type.toLowerCase()}">${comp.openeval_result_type}</span></div>`;
    }

    if (openevalResult && openevalResult.result) {
        html += '<div class="result-detail-field">';
        html += '<strong>Result:</strong>';
        html += `<div class="result-text-box">${openevalResult.result}</div>`;
        html += '</div>';
    }

    if (comp.openeval_reasoning) {
        html += '<div class="result-detail-field">';
        html += '<strong>Reasoning:</strong>';
        html += `<div class="reasoning-box">${comp.openeval_reasoning}</div>`;
        html += '</div>';
    }

    if (openevalResult && openevalResult.claim_ids && openevalResult.claim_ids.length > 0) {
        html += formatClaimsTableWithLabel(openevalResult.claim_ids);
    }

    html += '</div>';

    // Right side: Peer Result
    html += '<div class="result-detail-side">';
    html += '<h4>Peer Result</h4>';
    html += `<div class="result-detail-field"><strong>Status:</strong> <span class="status-badge status-${(comp.peer_status || '').toLowerCase()}">${comp.peer_status || 'N/A'}</span></div>`;

    // NEW: Display result type
    if (comp.peer_result_type) {
        html += `<div class="result-detail-field"><strong>Type:</strong> <span class="result-type-badge result-type-${comp.peer_result_type.toLowerCase()}">${comp.peer_result_type}</span></div>`;
    }

    if (peerResult && peerResult.result) {
        html += '<div class="result-detail-field">';
        html += '<strong>Result:</strong>';
        html += `<div class="result-text-box">${peerResult.result}</div>`;
        html += '</div>';
    }

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
        // Match by claim_id (C1, C2, etc.) not by UUID
        const claim = window.manuscriptData.claims.find(c => c.claim_id === claimId);
        if (claim) {
            html += '<tr>';
            html += `<td class="claim-id-cell">${claimId}</td>`;
            html += `<td class="claim-text-cell">${claim.claim}</td>`;
            html += '</tr>';
        } else {
            console.log('Claim not found for claim_id:', claimId);
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

/**
 * Load manuscript markdown and render with claim highlighting
 * Auto-loads on page load (no toggle button)
 */
async function loadAndRenderManuscript(manuscriptId) {
    const $loading = $('#manuscript-loading-left');
    const $error = $('#manuscript-error-left');
    const $rendered = $('#manuscript-rendered-left');

    try {
        $loading.show();
        $error.hide();
        $rendered.hide();

        // Fetch markdown from API
        const response = await fetch(`/api/manuscripts/${manuscriptId}/markdown`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to load manuscript: ${response.statusText}`);
        }

        const data = await response.json();
        const markdown = data.markdown;

        // Render markdown to HTML using marked.js
        const html = marked.parse(markdown);
        $rendered.html(html);

        // Hide loading, show content
        $loading.hide();
        $rendered.show();

        // Apply claim highlighting if claims are available
        if (window.manuscriptData && window.manuscriptData.claims) {
            console.log('Applying claim highlighting to manuscript...');
            ClaimHighlighter.initialize($rendered[0], window.manuscriptData.claims);
        }

    } catch (error) {
        console.error('Error loading manuscript:', error);
        $loading.hide();
        $error.text(`Error loading manuscript: ${error.message}`).show();
    }
}
