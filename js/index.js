// DataTable instance
let manuscriptsTable;

$(document).ready(async function () {
  // Check authentication status
  await checkAuthStatus();

  // Load statistics
  await loadStatistics();

  // Load manuscripts table
  await loadManuscripts();
});

async function loadStatistics() {
  try {
    const response = await fetch("/api/manuscripts/stats", {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Failed to load statistics:", response.status);
      return;
    }

    const stats = await response.json();

    // Update the statistics display
    $("#stat-manuscripts").text(stats.total_manuscripts.toLocaleString());
    $("#stat-claims").text(stats.total_claims.toLocaleString());
    $("#stat-llm-results").text(stats.total_llm_results.toLocaleString());
    $("#stat-peer-results").text(stats.total_peer_results.toLocaleString());
    $("#stat-peer-papers").text(`(${stats.manuscripts_with_peer_reviews} papers)`);
    $("#stat-comparisons").text(stats.total_comparisons.toLocaleString());
  } catch (error) {
    console.error("Error loading statistics:", error);
  }
}

async function loadManuscripts() {
  try {
    // Fetch all manuscripts (no pagination, DataTables will handle it)
    const response = await fetch("/api/manuscripts?limit=10000", {
      credentials: "include",
    });

    $("#loading").hide();

    if (!response.ok) {
      console.error("API error:", response.status, response.statusText);
      $("#no-papers")
        .text(
          "Unable to load manuscripts. Please check that the backend server is running."
        )
        .show();
      return;
    }

    const data = await response.json();

    if (!data.manuscripts || data.manuscripts.length === 0) {
      $("#no-papers").show();
      return;
    }

    // Hide custom pagination controls (DataTables will provide its own)
    $("#pagination-controls").hide();

    // Prepare data for DataTables
    const tableData = data.manuscripts.map((manuscript) => {
      return [
        manuscript.pub_date ? formatDate(manuscript.pub_date) : "—",
        `<a href="/paper.html?id=${manuscript.id}">${
          manuscript.title || manuscript.id
        }</a>`,
        manuscript.total_claims,
        manuscript.total_results_llm,
        manuscript.total_results_peer || 0,
        manuscript.total_comparisons,
        manuscript.has_peer_reviews
          ? `<span class="agree-badge">${manuscript.agree_count || 0}</span>`
          : `<span class="na-badge">0</span>`,
        manuscript.has_peer_reviews
          ? `<span class="disjoint-badge">${
              manuscript.disjoint_count || 0
            }</span>`
          : `<span class="na-badge">0</span>`,
        manuscript.has_peer_reviews
          ? `<span class="disagree-badge">${
              manuscript.disagree_count || 0
            }</span>`
          : `<span class="na-badge">0</span>`,
        manuscript.id, // Hidden column for row click handling
      ];
    });

    // Initialize DataTables
    manuscriptsTable = $("#papers-list").DataTable({
      data: tableData,
      columns: [
        { title: "Publication Date", width: "10%" },
        { title: "Article Title", width: "35%" },
        { title: "Total Claims", width: "8%" },
        { title: "OpenEval Results", width: "8%" },
        { title: "Peer Results", width: "8%" },
        { title: "Comparisons", width: "8%" },
        { title: "Agree", width: "7%" },
        { title: "Disjoint", width: "7%" },
        { title: "Disagree", width: "7%" },
        { title: "ID", visible: false, searchable: false }, // Hidden ID column
      ],
      pageLength: 10,
      lengthMenu: [10, 25, 50, 100],
      order: [[0, "desc"]], // Sort by date descending by default
      responsive: true,
      language: {
        search: "Search manuscripts:",
        lengthMenu: "Show _MENU_ manuscripts per page",
        info: "Showing _START_ to _END_ of _TOTAL_ manuscripts",
        infoEmpty: "No manuscripts available",
        infoFiltered: "(filtered from _MAX_ total manuscripts)",
        zeroRecords: "No matching manuscripts found",
      },
      drawCallback: function () {
        // Make rows clickable after each redraw
        $("#papers-list tbody tr")
          .css("cursor", "pointer")
          .off("click")
          .on("click", function () {
            const rowData = manuscriptsTable.row(this).data();
            if (rowData && rowData[9]) {
              // rowData[9] is the hidden ID column
              window.location.href = `/paper.html?id=${rowData[9]}`;
            }
          });
      },
    });
  } catch (error) {
    $("#loading").hide();
    $("#no-papers")
      .html(
        "Error connecting to server. Please ensure the backend is running at <code>http://localhost:8000</code>"
      )
      .show();
    console.error("Error loading manuscripts:", error);
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
