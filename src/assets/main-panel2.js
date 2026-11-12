(function () {
  const vscode = acquireVsCodeApi();

  const query = (e) => document.querySelector(e);
  const queryAll = (e) => document.querySelectorAll(e);
  const postMsg = (type, data) => vscode.postMessage({ type, data });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "myMRs":
        setMyMRs(msg.data);
        break;
      default:
        break;
    }
  });

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function copyURL(url) {
    navigator.clipboard.writeText(url).then(
      () => {},
      () => {}
    );
  }

  function setMyMRs(data) {
    const container = query("#mrt-my-mrs");
    if (!data || data.length === 0) {
      container.innerHTML =
        '<p class="gm-empty">No open merge requests found.</p>';
      return;
    }

    container.innerHTML = data
      .map((item) => {
        const title = escapeHtml(item.title);
        const safeUrl = escapeHtml(item.web_url);
        return `
      <details class="gm-mr-item">
      <summary class="${item.has_conflicts ? "conflict" : "normal"}">${title}</summary>
      <div class="gm-mr-body">
      <p><strong>Branch:</strong> ${escapeHtml(item.source_branch)} → ${escapeHtml(item.target_branch)}</p>
      ${
        item.labels && item.labels.length > 0
          ? `<p><strong>Labels:</strong></p>
       <ul>
       ${item.labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}
       </ul>`
          : ""
      }
      <p class="gm-mr-actions">
      <a href="${safeUrl}" target="_blank">Open</a>
      <span class="gm-sep">|</span>
      <a href="#" class="copy-url" data-url="${safeUrl}">Copy URL</a>
      <span class="gm-sep">|</span>
      ${
        item.can_merge
          ? `<a href="#" class="merge-mr" data-close-id="${item.close_id}" data-title="${title}">Merge</a>`
          : `<span class="gm-action-disabled" title="${escapeHtml(
              item.merge_hint || "Cannot merge"
            )}">Merge</span>`
      }
      <span class="gm-sep">|</span>
      <a href="#" class="close-mr" data-close-id="${item.close_id}" data-title="${title}">Close</a>
      </p>
      </div>
      </details>
    `;
      })
      .join("");

    queryAll(".copy-url").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const url = event.target.getAttribute("data-url");
        copyURL(url);
      });
    });

    queryAll(".close-mr").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const el = event.target;
        postMsg("closeMr", {
          close_id: Number(el.getAttribute("data-close-id")),
          title: el.getAttribute("data-title"),
        });
      });
    });

    queryAll(".merge-mr").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const el = event.target;
        postMsg("mergeMr", {
          close_id: Number(el.getAttribute("data-close-id")),
          title: el.getAttribute("data-title"),
        });
      });
    });
  }
})();
