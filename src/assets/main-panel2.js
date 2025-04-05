(function () {
  const vscode = acquireVsCodeApi();

  const query = (e) => document.querySelector(e);
  const queryAll = (e) => document.querySelectorAll(e);
  const postMsg = (type, data) => vscode.postMessage({ type, data });

  const oldState = vscode.getState();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "myMRs":
        console.log("myMRs", msg.data);
        setMyMRs(msg.data);
        break;
      default:
        break;
    }
  });

  function setMyMRs(data) {
    const container = query("#mrt-my-mrs");
    if (!data || data.length === 0) {
      container.innerHTML = "<p>No Merge Requests found.</p>";
      return;
    }

    container.innerHTML = data
      .map(
      (item, index) => `
      <details>
      <summary>${item.title}</summary>
      <div">
        <p><strong>Branch:</strong> ${item.source_branch} → ${
        item.target_branch
      }</p>
      ${
        item.labels && item.labels.length > 0
        ? `<p><strong>Labels:</strong></p>
           <ul>
           ${item.labels.map((label) => `<li>${label}</li>`).join("")}
           </ul>`
        : ""
      }
      <p><a href="${item.web_url}" target="_blank">Open</a></p>
        
      </div>
      </details>
    `
      )
      .join("");
  }
})();
