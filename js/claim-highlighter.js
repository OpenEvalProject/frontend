/**
 * Claim Highlighter Module
 *
 * Highlights claim source text in rendered manuscript content and provides
 * interactive tooltips with claim metadata.
 */

const ClaimHighlighter = (function() {
    'use strict';

    /**
     * Normalize text for case-insensitive matching
     * Removes extra whitespace and converts to lowercase
     */
    function normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Walk through text nodes in the DOM tree
     * @param {Node} node - Root node to start walking from
     * @param {Function} callback - Function to call for each text node
     */
    function walkTextNodes(node, callback) {
        if (node.nodeType === Node.TEXT_NODE) {
            callback(node);
        } else {
            // Skip certain elements that shouldn't be highlighted
            const skipElements = ['SCRIPT', 'STYLE', 'CODE', 'PRE'];
            if (!skipElements.includes(node.nodeName)) {
                let child = node.firstChild;
                while (child) {
                    // Save next sibling before callback (callback might modify DOM)
                    const next = child.nextSibling;
                    walkTextNodes(child, callback);
                    child = next;
                }
            }
        }
    }

    /**
     * Find the position of needle in haystack (case-insensitive)
     * @param {string} haystack - Text to search in
     * @param {string} needle - Text to search for
     * @returns {number} - Index of needle in haystack, or -1 if not found
     */
    function findTextPosition(haystack, needle) {
        const normalizedHaystack = normalizeText(haystack);
        const normalizedNeedle = normalizeText(needle);
        return normalizedHaystack.indexOf(normalizedNeedle);
    }

    /**
     * Highlight a single claim in the manuscript content
     * @param {HTMLElement} container - Container element with manuscript content
     * @param {Object} claim - Claim object with source text
     */
    function highlightClaim(container, claim) {
        // Prefer matched_segment (precise JATS position) over source (fuzzy match)
        const sourceText = claim.matched_segment || claim.source;
        if (!sourceText || sourceText.trim().length === 0) {
            return;
        }

        const normalizedSource = normalizeText(sourceText);
        let found = false;

        walkTextNodes(container, function(textNode) {
            if (found) return; // Only highlight first occurrence

            const text = textNode.textContent;
            const pos = findTextPosition(text, sourceText);

            if (pos !== -1) {
                // Calculate the actual position in the original text
                const normalizedText = normalizeText(text);
                const normalizedPos = normalizedText.indexOf(normalizedSource);

                if (normalizedPos !== -1) {
                    // Map normalized position back to original text position
                    let actualPos = 0;
                    let normalizedCount = 0;
                    let inWhitespace = false;

                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const isWhitespace = /\s/.test(char);

                        if (!isWhitespace || !inWhitespace) {
                            if (normalizedCount === normalizedPos) {
                                actualPos = i;
                                break;
                            }
                            normalizedCount++;
                        }

                        inWhitespace = isWhitespace;
                    }

                    // Calculate the length of the match in the original text
                    let matchLength = 0;
                    let sourceNormalizedIdx = 0;
                    for (let i = actualPos; i < text.length && sourceNormalizedIdx < normalizedSource.length; i++) {
                        const char = text[i];
                        const isWhitespace = /\s/.test(char);

                        if (!isWhitespace || sourceNormalizedIdx === 0 || sourceNormalizedIdx === normalizedSource.length - 1) {
                            matchLength++;
                            if (!isWhitespace) {
                                sourceNormalizedIdx++;
                            }
                        } else {
                            matchLength++;
                        }
                    }

                    // Create highlight span
                    const before = text.substring(0, actualPos);
                    const match = text.substring(actualPos, actualPos + matchLength);
                    const after = text.substring(actualPos + matchLength);

                    const span = document.createElement('span');
                    span.className = 'claim-highlight';
                    span.setAttribute('data-claim-id', claim.id);
                    span.setAttribute('data-claim-type', claim.claim_type);
                    span.setAttribute('data-claim-text', claim.claim);
                    span.textContent = match;

                    // Add evidence types as data attributes
                    if (claim.evidence_type && claim.evidence_type.length > 0) {
                        span.setAttribute('data-evidence-types', claim.evidence_type.join(','));
                    }

                    // Add source types as data attributes
                    if (claim.source_type && claim.source_type.length > 0) {
                        span.setAttribute('data-source-types', claim.source_type.join(','));
                    }

                    // Replace text node with fragments
                    const parent = textNode.parentNode;
                    parent.insertBefore(document.createTextNode(before), textNode);
                    parent.insertBefore(span, textNode);
                    parent.insertBefore(document.createTextNode(after), textNode);
                    parent.removeChild(textNode);

                    found = true;
                }
            }
        });

        if (!found) {
            console.warn('Could not find source text for claim:', claim.claim_id, sourceText);
        }
    }

    /**
     * Highlight all claims in the manuscript content
     * @param {HTMLElement} container - Container element with manuscript content
     * @param {Array} claims - Array of claim objects
     */
    function highlightAllClaims(container, claims) {
        // Filter claims that have source text and source type includes TEXT
        const textClaims = claims.filter(claim => {
            return claim.source &&
                   claim.source.trim().length > 0 &&
                   claim.source_type &&
                   claim.source_type.includes('TEXT');
        });

        console.log(`[Claim Highlighting] Processing ${textClaims.length} text-based claims out of ${claims.length} total claims`);

        // Sort claims by source text length (longest first) to avoid nested highlights
        textClaims.sort((a, b) => b.source.length - a.source.length);

        // Track successful highlights
        let successfulHighlights = 0;
        let failedHighlights = 0;

        // Highlight each claim
        textClaims.forEach(claim => {
            const beforeCount = container.querySelectorAll('.claim-highlight').length;
            highlightClaim(container, claim);
            const afterCount = container.querySelectorAll('.claim-highlight').length;

            if (afterCount > beforeCount) {
                successfulHighlights++;
            } else {
                failedHighlights++;
            }
        });

        const totalHighlights = container.querySelectorAll('.claim-highlight').length;

        console.log(`[Claim Highlighting] Results:`);
        console.log(`  ✓ Successfully matched: ${successfulHighlights}/${textClaims.length} claims`);
        console.log(`  ✗ Failed to match: ${failedHighlights}/${textClaims.length} claims`);
        console.log(`  📊 Total highlights created: ${totalHighlights}`);
        console.log(`  📈 Match rate: ${((successfulHighlights / textClaims.length) * 100).toFixed(1)}%`);
    }

    /**
     * Create and show tooltip for a claim
     * @param {HTMLElement} highlightElement - The highlighted span element
     * @param {Event} event - Click event
     */
    function showClaimTooltip(highlightElement, event) {
        // Remove any existing tooltip
        removeTooltip();

        const claimId = highlightElement.getAttribute('data-claim-id');
        const claimType = highlightElement.getAttribute('data-claim-type');
        const claimText = highlightElement.getAttribute('data-claim-text');
        const evidenceTypes = highlightElement.getAttribute('data-evidence-types');
        const sourceTypes = highlightElement.getAttribute('data-source-types');

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'claim-tooltip';
        tooltip.id = 'active-claim-tooltip';

        // Build tooltip content
        let content = `
            <div class="tooltip-header">
                <span class="tooltip-claim-type">${claimType}</span>
                <button class="tooltip-close" onclick="ClaimHighlighter.removeTooltip()">&times;</button>
            </div>
            <div class="tooltip-body">
                <div class="tooltip-section">
                    <strong>Claim:</strong>
                    <p>${claimText}</p>
                </div>
        `;

        if (evidenceTypes) {
            const types = evidenceTypes.split(',');
            content += `
                <div class="tooltip-section">
                    <strong>Evidence Types:</strong>
                    <div class="tooltip-badges">
                        ${types.map(type => `<span class="evidence-badge evidence-badge-${type.trim()}">${type.trim()}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (sourceTypes) {
            const types = sourceTypes.split(',');
            content += `
                <div class="tooltip-section">
                    <strong>Source Types:</strong>
                    <div class="tooltip-badges">
                        ${types.map(type => `<span class="source-badge source-badge-${type.trim()}">${type.trim()}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        content += `
            </div>
        `;

        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);

        // Position tooltip near the clicked element using fixed positioning
        const rect = highlightElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Use fixed positioning relative to viewport (not absolute)
        // Position below the element by default
        let top = rect.bottom + 5;
        let left = rect.left;

        // Adjust if tooltip goes off screen horizontally
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Adjust if tooltip goes off screen vertically
        if (top + tooltipRect.height > window.innerHeight) {
            // Position above if it doesn't fit below
            top = rect.top - tooltipRect.height - 5;
        }

        // Ensure tooltip stays within viewport bounds
        if (top < 0) {
            top = 10;
        }
        if (left < 0) {
            left = 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        // Add click outside handler to close tooltip
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);
    }

    /**
     * Handle clicks outside the tooltip
     */
    function handleOutsideClick(event) {
        const tooltip = document.getElementById('active-claim-tooltip');
        const clickedHighlight = event.target.closest('.claim-highlight');

        if (tooltip && !tooltip.contains(event.target) && !clickedHighlight) {
            removeTooltip();
        }
    }

    /**
     * Remove active tooltip
     */
    function removeTooltip() {
        const tooltip = document.getElementById('active-claim-tooltip');
        if (tooltip) {
            tooltip.remove();
            document.removeEventListener('click', handleOutsideClick);
        }
    }

    /**
     * Enhance pre-existing <mark> tags with claim metadata and interactions
     * @param {HTMLElement} container - Container with manuscript content
     * @param {Array} claims - Array of claim objects
     */
    function enhanceExistingMarks(container, claims) {
        // Find all <mark> tags with data-claim-id
        const marks = container.querySelectorAll('mark[data-claim-id]');

        if (marks.length === 0) {
            console.log('[Claim Highlighting] No pre-highlighted claims found in markdown');
            return 0;
        }

        console.log(`[Claim Highlighting] Found ${marks.length} pre-highlighted claims`);

        // Create claim lookup by ID
        const claimById = {};
        claims.forEach(claim => {
            claimById[claim.claim_id] = claim;
        });

        // Enhance each mark with claim metadata
        let enhanced = 0;
        marks.forEach(mark => {
            const claimId = mark.getAttribute('data-claim-id');
            const claim = claimById[claimId];

            if (claim) {
                // Add claim-highlight class for styling
                mark.classList.add('claim-highlight');

                // Add metadata as data attributes
                mark.setAttribute('data-claim-type', claim.claim_type || 'unknown');
                mark.setAttribute('data-claim-text', claim.claim || '');

                if (claim.evidence_type && claim.evidence_type.length > 0) {
                    mark.setAttribute('data-evidence-types', claim.evidence_type.join(','));
                }

                if (claim.source_type && claim.source_type.length > 0) {
                    mark.setAttribute('data-source-types', claim.source_type.join(','));
                }

                enhanced++;
            } else {
                console.warn(`[Claim Highlighting] No metadata found for claim ${claimId}`);
            }
        });

        console.log(`[Claim Highlighting] Enhanced ${enhanced}/${marks.length} marks with metadata`);
        return enhanced;
    }

    /**
     * Initialize claim highlighting
     * @param {HTMLElement} container - Container with manuscript content
     * @param {Array} claims - Array of claim objects
     */
    function initialize(container, claims) {
        if (!container || !claims || claims.length === 0) {
            console.warn('Cannot initialize claim highlighter: missing container or claims');
            return;
        }

        // First, check for pre-existing <mark> tags from annotated XML
        const preHighlightedCount = enhanceExistingMarks(container, claims);

        // If no pre-highlighted marks found, fall back to fuzzy text matching
        if (preHighlightedCount === 0) {
            console.log('[Claim Highlighting] Falling back to fuzzy text matching...');
            highlightAllClaims(container, claims);
        }

        // Add click handlers to all highlighted claims (both pre-existing and fuzzy-matched)
        container.addEventListener('click', function(event) {
            const highlight = event.target.closest('.claim-highlight');
            if (highlight) {
                event.preventDefault();
                event.stopPropagation();
                showClaimTooltip(highlight, event);
            }
        });

        console.log('Claim highlighter initialized');
    }

    // Public API
    return {
        initialize: initialize,
        removeTooltip: removeTooltip,
        highlightAllClaims: highlightAllClaims
    };
})();
