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
    const dom = query("#mrt-my-mrs");
    if (data && data.length > 0) {
      dom.innerHTML = data
        .map((item) => {
          return `<li>${item?.title} - <a href="${item?.web_url}" target="_blank">Open</a></li>`;
        })
        .join("");
    } else {
      dom.innerHTML = "<li>No MRs found</li>";
    }
  }
})();
