(function () {
  const vscode = acquireVsCodeApi();

  const query = (e) => document.querySelector(e);
  const queryAll = (e) => document.querySelectorAll(e);
  const postMsg = (type, data) => vscode.postMessage({ type, data });

  const oldState = vscode.getState();

  function boot() {
    setTimeout(() => {
      postMsg("init", oldState?.repoPath);
    }, 500);

    bindRepoTabs();
    bindSubmit();
    bindUserPickers();
    bindBranchPickers();
    bindMessages();
  }

  const toolkitReady = customElements.get("vscode-button")
    ? Promise.resolve()
    : Promise.race([
        customElements.whenDefined("vscode-button"),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);

  toolkitReady.then(boot).catch(boot);

  function bindRepoTabs() {
    query("#repo-list").onclick = function (e) {
      const target = e.target;
      const repoPath = target.dataset.path;
      if (repoPath) {
        target.parentElement.childNodes.forEach((item) => {
          item.classList?.remove("active");
        });
        target.classList.add("active");
        vscode.setState({ ...vscode.getState(), repoPath });
        postMsg("repoChange", repoPath);
      }
    };
  }

  function bindSubmit() {
    const submit = query("#submit");
    submit?.addEventListener("click", () => {
      if (submit.disabled || submit.classList.contains("mrt-btn--busy")) {
        return;
      }
      const data = collectFormData();
      if (data.reviewer_id) {
        data.reviewer_ids = [Number(data.reviewer_id)];
      }
      data.assignee_username = selectedAssignee?.username;
      data.reviewer_username = selectedReviewer?.username;
      setSubmitBusy(true);
      postMsg("submitMR", data);
      storageData(data);
    });
  }

  function setSubmitBusy(busy) {
    const submit = query("#submit");
    if (!submit) {
      return;
    }
    const defaultText =
      submit.dataset.label || submit.textContent?.trim() || "Submit MR";
    submit.dataset.label = defaultText;
    submit.disabled = busy;
    submit.classList.toggle("mrt-btn--busy", busy);
    if (busy) {
      submit.innerHTML =
        '<span class="gm-submit-inner"><vscode-progress-ring class="gm-submit-spinner"></vscode-progress-ring><span>Submitting…</span></span>';
    } else {
      submit.textContent = defaultText;
    }
  }

  function getToolkitValue(el) {
    if (!el) {
      return "";
    }
    const inner = el.shadowRoot?.querySelector("input, textarea");
    return (el.value || inner?.value || "").trim();
  }

  function collectFormData() {
    const labelsSelect = query(".mrt-labels-select");
    return {
      title: getToolkitValue(query("#title-field")),
      description: getToolkitValue(query("#description-field")) || "",
      source_branch: query(".mrt-source-branch-value")?.value || "",
      target_branch: query(".mrt-target-branch-value")?.value || "",
      assignee_id: query(".mrt-assignee-id")?.value || "",
      reviewer_id: query(".mrt-reviewer-id")?.value || "",
      labels: labelsSelect
        ? Array.from(labelsSelect.selectedOptions).map((opt) => opt.value)
        : [],
      remove_source_branch: Boolean(
        query("#delete-source-branch")?.checked
      ),
      squash: Boolean(query("#squash-commits")?.checked),
    };
  }

  function setToolkitValue(el, value) {
    if (!el) {
      return;
    }
    el.value = value;
    const inner = el.shadowRoot?.querySelector("input, textarea");
    if (inner) {
      inner.value = value;
    }
  }

  function clearForm() {
    setToolkitValue(query("#title-field"), "");
    setToolkitValue(query("#description-field"), "");
    setCurrentAssignee({});
    setCurrentReviewer({});
    queryAll(".mrt-user-item.active").forEach((el) =>
      el.classList.remove("active")
    );
    const labelsSelect = query(".mrt-labels-select");
    if (labelsSelect) {
      queryAll(".mrt-labels-select option").forEach((opt) => {
        opt.selected = false;
      });
    }
    const deleteBranch = query("#delete-source-branch");
    const squash = query("#squash-commits");
    if (deleteBranch) {
      deleteBranch.checked = true;
    }
    if (squash) {
      squash.checked = false;
    }
    closeAllPickers();
    selectedSourceBranch = "";
    selectedTargetBranch = "";
    query(".mrt-source-branch-value").value = "";
    query(".mrt-target-branch-value").value = "";
    query(".mrt-source-branch-name").textContent = "Select source branch";
    query(".mrt-source-branch-name").classList.add("placeholder");
    query(".mrt-target-branch-name").textContent = "Select target branch";
    query(".mrt-target-branch-name").classList.add("placeholder");
    renderBranchList("source", "");
    renderBranchList("target", "");
    if (searchInpSourceBranch) {
      searchInpSourceBranch.value = "";
    }
    if (searchInpTargetBranch) {
      searchInpTargetBranch.value = "";
    }
    vscode.setState({
      repoPath: vscode.getState()?.repoPath,
    });
  }

  function updateRepoTab(paths) {
    const state = vscode.getState() || {};
    let repoPath = state.repoPath;
    const dom = query("#repo-list");
    if (dom && paths.length > 1) {
      if (!repoPath || !paths.includes(repoPath)) {
        repoPath = paths[0];
      }
      vscode.setState({ ...state, repoPath });
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

  const assigneeNameDom = query(".mrt-assignee-name");
  const reviewerNameDom = query(".mrt-reviewer-name");
  const searchInpDomAssignee = query("#keywordInp-assignee");
  const searchInpDomReviewer = query("#keywordInp-reviewer");
  const userWrapAssigneeDom = query(".mrt-picker-select.assignee");
  const userWrapReviewerDom = query(".mrt-picker-select.reviewer");
  const branchWrapSourceDom = query(".mrt-picker-select.source");
  const branchWrapTargetDom = query(".mrt-picker-select.target");
  const userListAssigneeDom = query(".assignee .mrt-user-list");
  const userListReviewerDom = query(".reviewer .mrt-user-list");
  const branchListSourceDom = query(".mrt-branch-list.source");
  const branchListTargetDom = query(".mrt-branch-list.target");
  const searchInpSourceBranch = query("#keywordInp-source-branch");
  const searchInpTargetBranch = query("#keywordInp-target-branch");
  let timer;
  let selectedSourceBranch = "";
  let selectedTargetBranch = "";

  let selectedAssignee = oldState?.selectedAssignee;
  let selectedReviewer = oldState?.selectedReviewer;
  setCurrentAssignee(selectedAssignee || {});
  setCurrentReviewer(selectedReviewer || {});

  function closeAllPickers(exceptType) {
    queryAll(".mrt-picker-select").forEach((el) => {
      if (exceptType && el.classList.contains(exceptType)) {
        return;
      }
      el.classList.remove("show");
    });
    if (!exceptType) {
      document.onkeydown = null;
    }
  }

  function bindUserPickers() {
    assigneeNameDom.onclick = pickerWrapDomClick("assignee");
    reviewerNameDom.onclick = pickerWrapDomClick("reviewer");
    searchInpDomAssignee.onblur = pickerWrapDomBlur("assignee");
    searchInpDomReviewer.onblur = pickerWrapDomBlur("reviewer");
    searchInpDomAssignee.oninput = debounce(function (e) {
      postMsg("searchUser", e.target.value);
    }, 500);
    searchInpDomReviewer.oninput = debounce(function (e) {
      postMsg("searchReviewer", e.target.value);
    }, 500);
    userListAssigneeDom.onclick = userListDomCLick;
    userListReviewerDom.onclick = userListDomCLick;
    query(".del-assignee").onclick = delUsers("assignee");
    query(".del-reviewer").onclick = delUsers("reviewer");
  }

  function bindBranchPickers() {
    query(".mrt-source-branch-name").onclick = pickerWrapDomClick("source");
    query(".mrt-target-branch-name").onclick = pickerWrapDomClick("target");
    searchInpSourceBranch.onblur = pickerWrapDomBlur("source");
    searchInpTargetBranch.onblur = pickerWrapDomBlur("target");
    searchInpSourceBranch.oninput = debounce((e) => {
      renderBranchList("source", e.target.value);
    }, 200);
    searchInpTargetBranch.oninput = debounce((e) => {
      renderBranchList("target", e.target.value);
    }, 200);
    branchListSourceDom.onclick = branchListClick;
    branchListTargetDom.onclick = branchListClick;
  }

  function pickerDom(type) {
    return query(`.mrt-picker-select.${type}`);
  }

  function pickerSearchInput(type) {
    if (type === "assignee") {
      return searchInpDomAssignee;
    }
    if (type === "reviewer") {
      return searchInpDomReviewer;
    }
    if (type === "source") {
      return searchInpSourceBranch;
    }
    return searchInpTargetBranch;
  }

  function pickerItemSelector(type) {
    return type === "source" || type === "target"
      ? `.${type} .mrt-branch-item`
      : `.${type} .mrt-user-item`;
  }

  function pickerWrapDomClick(type) {
    return function () {
      closeAllPickers(type);
      pickerDom(type)?.classList.add("show");
      clearTimeout(timer);
      setTimeout(() => {
        const searchInp = pickerSearchInput(type);
        searchInp.focus();
        if (type === "source" || type === "target") {
          searchInp.value = "";
          renderBranchList(type, "");
        }
        query(`${pickerItemSelector(type)}.hover`)?.classList?.remove("hover");
        document.onkeydown = function (e) {
          const itemSel = pickerItemSelector(type);
          const active = query(`${itemSel}.active`);
          const firstItem = query(itemSel);
          const hoverItem = query(`${itemSel}.hover`) || active;
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
            searchInp.blur();
          }
        };
      }, 300);
    };
  }

  function pickerWrapDomBlur(type) {
    return function () {
      timer = setTimeout(() => {
        pickerDom(type)?.classList.remove("show");
        document.onkeydown = null;
      }, 100);
    };
  }

  function branchListClick(e) {
    const li = e.target.tagName === "LI" ? e.target : e.target.parentNode;
    if (!li || li.tagName !== "LI") {
      return;
    }
    const type = li.classList.contains("source-item") ? "source" : "target";
    const name = li.dataset.name;
    if (type === "source") {
      setCurrentSourceBranch(name);
    } else {
      setCurrentTargetBranch(name);
    }
    pickerDom(type)?.classList.remove("show");
    document.onkeydown = null;
  }

  function renderBranchList(type, filter) {
    const q = (filter || "").trim().toLowerCase();
    const list = q
      ? branches.filter((b) => b.name.toLowerCase().includes(q))
      : branches;
    const ul = type === "source" ? branchListSourceDom : branchListTargetDom;
    const current =
      type === "source" ? selectedSourceBranch : selectedTargetBranch;
    if (!ul) {
      return;
    }
    ul.innerHTML = list
      .map(
        ({ name }) =>
          `<li class="mrt-branch-item ${type}-item ${
            current === name ? "active" : ""
          }" data-name="${name}"><span class="name">${name}</span></li>`
      )
      .join("");
    const emptyDom = query(`.mrt-picker-select.${type} .empty`);
    if (list.length === 0) {
      emptyDom?.classList.add("show");
    } else {
      emptyDom?.classList.remove("show");
    }
  }

  function setCurrentSourceBranch(name) {
    selectedSourceBranch = name || "";
    query(".mrt-source-branch-value").value = selectedSourceBranch;
    const label = query(".mrt-source-branch-name");
    label.textContent = selectedSourceBranch || "Select source branch";
    if (!selectedSourceBranch) {
      label.classList.add("placeholder");
    } else {
      label.classList.remove("placeholder");
    }
    renderBranchList("source", searchInpSourceBranch?.value || "");
    setTitle();
  }

  function setCurrentTargetBranch(name) {
    selectedTargetBranch = name || "";
    query(".mrt-target-branch-value").value = selectedTargetBranch;
    const label = query(".mrt-target-branch-name");
    label.textContent = selectedTargetBranch || "Select target branch";
    if (!selectedTargetBranch) {
      label.classList.add("placeholder");
    } else {
      label.classList.remove("placeholder");
    }
    renderBranchList("target", searchInpTargetBranch?.value || "");
  }

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
    const user = {
      id: data.id,
      name: data.name,
      username: data.username,
    };
    if (type === "assignee") {
      setCurrentAssignee(
        selectedAssignee?.id === user.id ? {} : user
      );
    } else {
      setCurrentReviewer(
        selectedReviewer?.id === user.id ? {} : user
      );
    }
  }

  function delUsers(type) {
    return () => {
      type === "assignee" ? setCurrentAssignee({}) : setCurrentReviewer({});
      query(`.${type} .mrt-user-item.active`)?.classList?.remove("active");
    };
  }

  let currentBranchName = "";
  let branches = [];

  function bindMessages() {
    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "viewTips":
          setTipsVisible(msg.data);
          break;
        case "viewReady":
          showCreateForm();
          break;
        case "branches":
          branches = msg.data;
          updateBranches(branches);
          break;
        case "currentBranch":
          currentBranchName = msg.data;
          setSourceBranch();
          break;
        case "users":
          updateUsers(msg.data, "assignee");
          break;
        case "reviewers":
          updateUsers(msg.data, "reviewer");
          break;
        case "labels":
          updateLabels(msg.data);
          break;
        case "updateRepoTab":
          updateRepoTab(msg.data);
          break;
        case "platform":
          setPlatformOptions(msg.data);
          break;
        case "clearForm":
          clearForm();
          break;
        case "submitState":
          setSubmitBusy(Boolean(msg.data?.busy));
          break;
        default:
          break;
      }
    });
  }

  function showCreateForm() {
    const wrap = query(".mrt-wrap");
    const form = query(".mrt-form");
    wrap?.classList.remove("hidden");
    wrap?.classList.remove("show-tips");
    form?.classList.remove("hidden");
    if (form) {
      form.style.display = "block";
    }
  }

  function setPlatformOptions(platform) {
    queryAll(".gitlab-only").forEach((el) => {
      el.style.display = platform === "github" ? "none" : "";
    });
    const submit = query("#submit");
    if (submit) {
      const text =
        platform === "github" ? "Submit Pull Request" : "Submit MR";
      submit.dataset.label = text;
      if (!submit.classList.contains("mrt-btn--busy")) {
        submit.textContent = text;
      }
    }
  }

  function debounce(fn, delay) {
    let t;
    return function () {
      const self = this;
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), delay);
    };
  }

  function updateBranches() {
    renderBranchList("source", "");
    renderBranchList("target", "");
    setSourceBranch();
    setTargetBranch();
  }

  function setSourceBranch() {
    let value = "";
    if (branches.find((item) => item.name === currentBranchName)) {
      value = currentBranchName;
    }
    if (value) {
      setCurrentSourceBranch(value);
    }
  }

  function setTargetBranch() {
    const state = vscode.getState() || {};
    let value = "";
    if (
      state.targetBranch &&
      branches.some((v) => v.name === state.targetBranch)
    ) {
      value = state.targetBranch;
    } else {
      const item = branches.find(({ name }) =>
        ["master", "main", "dev", "develop"].includes(name)
      );
      value = item?.name;
    }
    if (!value) {
      value = branches[0]?.name;
    }
    if (value) {
      setCurrentTargetBranch(value);
    }
  }

  function updateUsers(users = [], type = "assignee") {
    const currentId =
      type === "assignee" ? selectedAssignee?.id : selectedReviewer?.id;
    const list = users
      .map(({ name, username, id }) => {
        return `<li class="mrt-user-item ${type}-item ${
          currentId == id ? "active" : ""
        }" data-id="${id}" data-name="${name}" data-username="${username}">
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
  }

  function updateLabels(labels = []) {
    const select = query(".mrt-labels-select");
    if (!select) {
      return;
    }
    select.innerHTML = labels
      .map(
        (label) =>
          `<option value="${label.name}">${label.name}</option>`
      )
      .join("");
  }

  function setTitle() {
    const titleField = query("#title-field");
    const inner = titleField?.shadowRoot?.querySelector("input");
    const current = titleField?.value || inner?.value || "";
    if (!current.trim() && currentBranchName) {
      setToolkitValue(titleField, currentBranchName);
    }
  }

  function storageData(formData) {
    vscode.setState({
      ...vscode.getState(),
      targetBranch: formData.target_branch,
      selectedAssignee,
      selectedReviewer,
    });
  }

  function setCurrentAssignee({ id, name, username }) {
    query(".mrt-assignee-id").value = id || "";
    assigneeNameDom.textContent = name || "Select assignee";
    assigneeNameDom.classList.toggle("placeholder", !name);
    selectedAssignee = { id, name, username };
    if (name) {
      query(`.del-assignee`).classList.remove("hidden");
    } else {
      query(`.del-assignee`).classList.add("hidden");
    }
  }

  function setCurrentReviewer({ id, name, username }) {
    query(".mrt-reviewer-id").value = id || "";
    reviewerNameDom.textContent = name || "Select reviewer";
    reviewerNameDom.classList.toggle("placeholder", !name);
    selectedReviewer = { id, name, username };
    if (name) {
      query(`.del-reviewer`).classList.remove("hidden");
    } else {
      query(`.del-reviewer`).classList.add("hidden");
    }
  }

  function setTipsVisible(visible) {
    const wrapDom = query(".mrt-wrap");
    const formDom = query(".mrt-form");
    wrapDom?.classList.remove("hidden");
    if (visible) {
      wrapDom?.classList.add("show-tips");
      formDom?.classList.add("hidden");
    } else {
      wrapDom?.classList.remove("show-tips");
      showCreateForm();
    }
  }
})();
