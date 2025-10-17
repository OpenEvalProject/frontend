let manuscriptFile = null;
let reviewsFile = null;
let responsesFile = null;

$(document).ready(async function() {
    const isAuthenticated = await checkAuthStatus();

    if (!isAuthenticated) {
        $('#auth-required').show();
        $('#submit-paper-form').hide();
        return;
    }

    $('#submit-paper-form').show();

    // File upload handling for all three file inputs
    setupFileUpload('manuscript', (file) => { manuscriptFile = file; });
    setupFileUpload('reviews', (file) => { reviewsFile = file; });
    setupFileUpload('responses', (file) => { responsesFile = file; });

    // Form submission
    $('#submit-paper-form').submit(handleSubmit);

    $('#cancel-btn').click(() => {
        window.location.href = '/index.html';
    });
});

function setupFileUpload(fileType, onFileSelect) {
    const dropArea = $(`#${fileType}-drop-area`);
    const fileInput = $(`#${fileType}-upload`);

    // Click to browse
    dropArea.click(() => fileInput.click());

    // File input change
    fileInput.change(function() {
        if (this.files && this.files[0]) {
            handleFile(this.files[0], fileType, onFileSelect);
        }
    });

    // Drag and drop
    dropArea.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('drag-over');
    });

    dropArea.on('dragleave', function() {
        $(this).removeClass('drag-over');
    });

    dropArea.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('drag-over');

        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0], fileType, onFileSelect);
        }
    });
}

function handleFile(file, fileType, onFileSelect) {
    // Validate file type
    const validTypes = ['text/plain', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showError(`Please upload a .txt or .pdf file for ${fileType}`);
        return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError(`File size for ${fileType} must be less than 10MB`);
        return;
    }

    onFileSelect(file);
    $(`#${fileType}-name`).text(file.name);
    $(`#${fileType}-info`).show();
    $('#error-message').hide();
}

async function handleSubmit(e) {
    e.preventDefault();

    $('#error-message').hide();

    // Validate required manuscript file
    if (!manuscriptFile) {
        showError('Please upload a manuscript file');
        return;
    }

    $('#submit-btn').prop('disabled', true);
    $('#processing').show();

    try {
        const formData = new FormData();
        formData.append('manuscript_file', manuscriptFile);

        // Add optional files if selected
        if (reviewsFile) {
            formData.append('reviews_file', reviewsFile);
        }
        if (responsesFile) {
            formData.append('responses_file', responsesFile);
        }

        // Title will be extracted from the manuscript by the backend

        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            showError(error.detail || error.error || 'Failed to analyze paper');
            return;
        }

        const result = await response.json();

        // Redirect to paper page
        window.location.href = result.redirect_url || `/paper.html?id=${result.paper_id}`;

    } catch (error) {
        showError('Error submitting paper. Please try again.');
        console.error('Submission error:', error);
    } finally {
        $('#submit-btn').prop('disabled', false);
        $('#processing').hide();
    }
}

function showError(message) {
    $('#error-message').html(message).show();
    $('#submit-btn').prop('disabled', false);
    $('#processing').hide();
}
