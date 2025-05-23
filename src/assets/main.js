(function () {
  const vscode = acquireVsCodeApi();

  const query = (e) => document.querySelector(e);
  const queryAll = (e) => document.querySelectorAll(e);
  const postMsg = (type, data) => vscode.postMessage({ type, data });

  const oldState = vscode.getState();

  // todo
  setTimeout(() => {
    postMsg("init", oldState.repoPath);
  }, 500);

  // repo tab
  query("#repo-list").onclick = function (e) {
    const target = e.target;
    const repoPath = target.dataset.path;
    if (repoPath) {
      target.parentElement.childNodes.forEach((item) => {
        item.classList?.remove("active");
      });
      target.classList.add("active");
      vscode.setState({ ...oldState, repoPath });
      postMsg("repoChange", repoPath);
    }
  };
  function updateRepoTab(paths) {
    state = vscode.getState();
    let repoPath = state.repoPath;
    const dom = query("#repo-list");
    if (dom && paths.length > 1) {
      if (!repoPath || !paths.includes(repoPath)) {
        repoPath = paths[0];
      }
      vscode.setState({ ...oldState, repoPath });
      dom.innerHTML = `
                <div class="mrt-repo">
                    ${paths
                      .map((item) => {
                        const name = item.split("/").reverse()[0];
                        return `<div 
                            class="mrt-repo-name ${
                              repoPath === item ? "active" : ""
                            }"
                            data-path="${item}"
                        >${name}</div>`;
                      })
                      .join("")}
                </div>
            `;
    }
  }

  // submit MR
  query("#submit").onclick = function () {
    const formItems = queryAll(".form");
    const data = {};
    formItems.forEach((item) => {
      const name = item.getAttribute("name");
      if (item.tagName === "SELECT" && item.multiple) {
        const selectedValues = Array.from(item.selectedOptions).map(
          (opt) => opt.value
        );
        data[name] = selectedValues;
      } else {
        data[name] = item.value;
      }
      if (name === "reviewer_id" && item.value) {
        data.reviewer_ids = [Number(item.value)];
      }
    });

    const checkbox = queryAll(".checkbox");
    checkbox.forEach((item) => {
      const name = item.getAttribute("name");
      data[name] = item.checked;
    });

    postMsg("submitMR", data);
    storageData(data);
  };

  const assigneeNameDom = query(".mrt-assignee-name");
  const reviewerNameDom = query(".mrt-reviewer-name");
  // search input
  const searchInpDomAssignee = query("#keywordInp-assignee");
  const searchInpDomReviewer = query("#keywordInp-reviewer");
  // user assignee list
  const userWrapAssigneeDom = query(".mrt-user-select.assignee");
  // user reviewer list
  const userWrapReviewerDom = query(".mrt-user-select.reviewer");
  let timer;

  function userWrapDomClick(type) {
    return function () {
      type === "assignee"
        ? userWrapAssigneeDom.classList.add("show")
        : userWrapReviewerDom.classList.add("show");
      clearTimeout(timer);
      setTimeout(() => {
        type === "assignee"
          ? searchInpDomAssignee.focus()
          : searchInpDomReviewer.focus();
        query(`.${type} .mrt-user-item.hover`)?.classList?.remove("hover");
        document.onkeydown = function (e) {
          const active = query(`.${type} .mrt-user-item.active`);
          const firstItem = query(`.${type} .mrt-user-item`);
          const hoverItem = query(`.${type} .mrt-user-item.hover`) || active;
          if (e.key === "ArrowDown") {
            const next = !hoverItem ? firstItem : hoverItem.nextElementSibling;
            if (next) {
              hoverItem?.classList.remove("hover");
              next.classList.add("hover");
              next.scrollIntoView(true);
            }
          } else if (e.key === "ArrowUp") {
            const prev = !hoverItem
              ? firstItem
              : hoverItem.previousElementSibling;
            if (prev) {
              hoverItem?.classList.remove("hover");
              prev.classList.add("hover");
              prev.scrollIntoView(true);
            }
          } else if (e.key === "Enter") {
            if (!hoverItem) {
              return;
            }
            hoverItem.click();
            type === "assignee"
              ? searchInpDomAssignee.blur()
              : searchInpDomReviewer.blur();
          }
        };
      }, 300);
    };
  }
  assigneeNameDom.onclick = userWrapDomClick("assignee");
  reviewerNameDom.onclick = userWrapDomClick("reviewer");

  function userWrapDomBlur(type) {
    return function () {
      timer = setTimeout(() => {
        type === "assignee"
          ? userWrapAssigneeDom.classList.remove("show")
          : userWrapReviewerDom.classList.remove("show");
        document.onkeydown = null;
      }, 100);
    };
  }
  searchInpDomAssignee.onblur = userWrapDomBlur("assignee");
  searchInpDomReviewer.onblur = userWrapDomBlur("reviewer");

  searchInpDomAssignee.oninput = debounce(function (e) {
    postMsg("searchUser", e.target.value);
  }, 500);
  searchInpDomReviewer.oninput = debounce(function (e) {
    postMsg("searchReviewer", e.target.value);
  }, 500);

  // select assignee
  const userListAssigneeDom = query(".assignee .mrt-user-list");
  const userListReviewerDom = query(".reviewer .mrt-user-list");

  let selectedAssignee = oldState?.selectedAssignee;
  setCurrentAssignee(selectedAssignee || {});
  let selectedReviewer = oldState?.selectedReviewer;
  setCurrentReviewer(selectedReviewer || {});

  function userListDomCLick(e) {
    const li = e.target.tagName === "LI" ? e.target : e.target.parentNode;
    if (!li || li.tagName !== "LI") {
      return;
    }
    Array.prototype.slice
      .call(li?.parentNode?.children || [])
      .filter((el) => el.tagName === "LI" && el !== li)
      .forEach((item) => item.classList.remove("active"));
    li?.classList.toggle("active");
    const type = li.classList.contains("assignee-item")
      ? "assignee"
      : "reviewer";
    const data = li.dataset;
    if (type === "assignee") {
      setCurrentAssignee(selectedAssignee?.id === data?.id ? {} : data);
    } else {
      setCurrentReviewer(selectedReviewer?.id === data?.id ? {} : data);
    }
  }
  userListAssigneeDom.onclick = userListDomCLick;
  userListReviewerDom.onclick = userListDomCLick;

  function delUsers(type) {
    return () => {
      type === "assignee" ? setCurrentAssignee({}) : setCurrentReviewer({});
      query(`.${type} .mrt-user-item.active`)?.classList?.remove("active");
    };
  }
  query(".del-assignee").onclick = delUsers("assignee");
  query(".del-reviewer").onclick = delUsers("reviewer");

  let currentBranchName = "";
  // remote branches
  let branches = [];

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "viewTips":
        setTipsVisible(msg.data);
        break;
      case "branches":
        branches = msg.data;
        updateBranches(branches);
        break;
      case "currentBranch":
        currentBranchName = msg.data;
        break;
      case "users":
        updateUsers(msg.data, "assignee");
        break;
      case "reviewers":
        updateUsers(msg.data, "reviewer");
        break;
      case "labels":
        updateLabels(msg.data); // 🔥 Add this
        break;
    //   case "myMRs":
    //     setMyMRs();
    //     break;
      case "updateRepoTab":
        updateRepoTab(msg.data);
        break;
    }
  });

  // debounce
  function debounce(fn, delay) {
    let timer;
    return function () {
      let _this = this;
      const opt = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(_this, opt);
      }, delay);
    };
  }

  function updateBranches() {
    const select = queryAll(".branches-select");
    select.forEach((item) => {
      item.innerHTML = branches
        .map(({ name }) => {
          return `<option value="${name}">${name}</option>`;
        })
        .join("");
    });
    setSourceBranch();
    setTargetBranch();
  }
  function setSourceBranch() {
    const dom = query(".mrt-source-branch");
    let value = "";
    if (branches.find((item) => item.name === currentBranchName)) {
      value = currentBranchName;
    }
    dom.value = value;

    setTitle();
  }
  function setTargetBranch() {
    let value = "";
    if (
      oldState &&
      oldState.targetBranch &&
      branches.includes((v) => v.name === oldState.targetBranch)
    ) {
      value = oldState.targetBranch;
    } else {
      const item = branches.find(({ name }) =>
        ["master", "dev", "develop"].includes(name)
      );
      value = item?.name;
    }
    if (!value) {
      value = branches[0]?.name;
    }
    const dom = query(".mrt-target-branch");
    dom.value = value;
  }

  function updateUsers(users = [], type = "assignee") {
    const currentId =
      type === "assignee" ? selectedAssignee?.id : selectedReviewer?.id;
    const list = users
      .map(({ name, username, id }) => {
        return `<li class="mrt-user-item ${type}-item ${
          currentId == id ? "active" : ""
        }" data-id="${id}" data-name="${name}">
                <span class="name">${name}</span>
                <span class="username">@${username}</span>
            </li>`;
      })
      .join("");

    if (type === "assignee") {
      userListAssigneeDom.innerHTML = list;
    } else {
      userListReviewerDom.innerHTML = list;
    }
    const emptyDom = query(`.${type} .empty`);
    if (users.length === 0) {
      emptyDom.classList.add("show");
    } else {
      emptyDom.classList.remove("show");
    }
    // query(`.${type} .mrt-user-item[data-id='${}']`)?.classList?.add('active');
  }
  function updateLabels(labels = []) {
    const select = query(".mrt-labels-select"); // Adjust this selector based on your HTML
    if (!select) return;

    select.innerHTML = labels
      .map((label) => `<option value="${label.name}">${label.name}</option>`)
      .join("");
  }

  function setTitle() {
    const dom = query(".mrt-title");
    if (dom.value) {
      return;
    }
    dom.value = currentBranchName;
  }

  function storageData(formData) {
    vscode.setState({
      targetBranch: formData.target_branch,
      selectedAssignee,
      selectedReviewer,
    });
  }

  function setCurrentAssignee({ id, name }) {
    query(".mrt-assignee-id").value = id || "";
    assigneeNameDom.innerHTML = name || "";
    selectedAssignee = { id, name };
    if (name) {
      query(`.del-assignee`).classList.remove("hidden");
    } else {
      query(`.del-assignee`).classList.add("hidden");
    }
  }

  function setCurrentReviewer({ id, name }) {
    query(".mrt-reviewer-id").value = id || "";
    reviewerNameDom.innerHTML = name || "";
    selectedReviewer = { id, name };
    if (name) {
      query(`.del-reviewer`).classList.remove("hidden");
    } else {
      query(`.del-reviewer`).classList.add("hidden");
    }
  }

  function setTipsVisible(visible) {
    const method = visible ? "add" : "remove";
    const wrapDom = query(".mrt-wrap");
    wrapDom.classList.remove("hidden");
    wrapDom.classList[method]("show-tips");
  }

  query(".setting-btn").onclick = () => {
    postMsg("setting");
  };
})();
