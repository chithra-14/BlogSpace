const API = "/api";
let token = localStorage.getItem("blogspace_token") || "";
let currentUser = JSON.parse(localStorage.getItem("blogspace_user") || "null");
let authMode = "login";
let editingPostId = null;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
const shortDate = value => new Date(value).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
function showToast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
async function request(url, options = {}) {
  const headers = { "Content-Type":"application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
function updateAccount() {
  const area = $("accountArea");
  if (currentUser) {
    area.innerHTML = `<span class="welcome-user">Hi, ${escapeHTML(currentUser.name.split(" ")[0])}</span><button class="btn btn-outline" onclick="logout()">Log out</button>`;
  } else {
    area.innerHTML = `<button class="btn btn-outline" onclick="showAuth('login')">Log in</button><button class="btn btn-primary" onclick="showAuth('register')">Get started</button>`;
  }
}
function logout() {
  token = ""; currentUser = null;
  localStorage.removeItem("blogspace_token"); localStorage.removeItem("blogspace_user");
  updateAccount(); renderPosts(); showToast("You have logged out.");
}
function showAuth(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
  $("authSubtitle").textContent = mode === "login" ? "Log in to join the conversation." : "Join the community and share your ideas.";
  $("nameField").classList.toggle("hidden", mode === "login");
  $("authName").required = mode === "register";
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authSubmit").textContent = mode === "login" ? "Log in" : "Create account";
  $("authSwitch").innerHTML = mode === "login" ? `New here? <button type="button" onclick="showAuth('register')">Create an account</button>` : `Already a member? <button type="button" onclick="showAuth('login')">Log in</button>`;
  $("authMessage").textContent = ""; $("authForm").reset();
  $("authModal").classList.remove("hidden");
}
function closeAuth() { $("authModal").classList.add("hidden"); }
$("authForm").addEventListener("submit", async e => {
  e.preventDefault(); $("authMessage").textContent = "";
  const payload = { email:$("authEmail").value.trim(), password:$("authPassword").value };
  if (authMode === "register") payload.name = $("authName").value.trim();
  $("authSubmit").disabled = true;
  try {
    const result = await request(`/auth/${authMode === "login" ? "login" : "register"}`, { method:"POST", body:JSON.stringify(payload) });
    token = result.token; currentUser = result.user;
    localStorage.setItem("blogspace_token", token); localStorage.setItem("blogspace_user", JSON.stringify(currentUser));
    closeAuth(); updateAccount(); renderPosts(); showToast(result.message);
  } catch (err) { $("authMessage").textContent = err.message; }
  finally { $("authSubmit").disabled = false; }
});
function startWriting() {
  if (!currentUser) { showAuth("login"); showToast("Log in or register to create a post."); return; }
  editingPostId = null; $("postForm").reset(); $("postMessage").textContent = "";
  $("postFormTitle").textContent = "Create a story"; $("savePostButton").textContent = "Publish story";
  $("postModal").classList.remove("hidden");
}
function closePostForm() { $("postModal").classList.add("hidden"); }
$("postForm").addEventListener("submit", async e => {
  e.preventDefault(); $("postMessage").textContent = "";
  const payload = { title:$("postTitle").value.trim(), content:$("postContent").value.trim() };
  const button = $("savePostButton"); button.disabled = true;
  try {
    await request(editingPostId ? `/posts/${editingPostId}` : "/posts", { method:editingPostId ? "PUT" : "POST", body:JSON.stringify(payload) });
    closePostForm(); await renderPosts(); showToast(editingPostId ? "Story updated!" : "Your story is published!");
  } catch (err) { $("postMessage").textContent = err.message; }
  finally { button.disabled = false; }
});
function editPost(post) {
  editingPostId = post._id; $("postTitle").value = post.title; $("postContent").value = post.content;
  $("postMessage").textContent = ""; $("postFormTitle").textContent = "Edit your story";
  $("savePostButton").textContent = "Save changes"; $("postModal").classList.remove("hidden");
}
async function deletePost(id) {
  if (!confirm("Delete this post and all its comments? This cannot be undone.")) return;
  try { await request(`/posts/${id}`, { method:"DELETE" }); await renderPosts(); showToast("Post deleted."); }
  catch (err) { showToast(err.message); }
}
async function toggleComments(id) {
  const panel = $(`comments-${id}`);
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  await loadComments(id);
}
async function loadComments(id) {
  const list = $(`comment-list-${id}`);
  list.innerHTML = `<div class="comment-item">Loading comments…</div>`;
  try {
    const comments = await request(`/posts/${id}/comments`);
    list.innerHTML = comments.length ? comments.map(c => `<div class="comment-item"><b>${escapeHTML(c.author?.name || "Community member")} <span style="font-weight:400;color:#888">· ${shortDate(c.createdAt)}</span></b><p>${escapeHTML(c.text)}</p></div>`).join("") : `<div class="comment-item">No comments yet. Start the conversation!</div>`;
  } catch (err) { list.innerHTML = `<div class="comment-item">${escapeHTML(err.message)}</div>`; }
}
async function addComment(event, id) {
  event.preventDefault();
  if (!currentUser) { showAuth("login"); showToast("Log in to leave a comment."); return; }
  const input = $(`comment-input-${id}`); const text = input.value.trim();
  if (!text) return;
  const button = event.submitter; if (button) button.disabled = true;
  try { await request(`/posts/${id}/comments`, { method:"POST", body:JSON.stringify({ text }) }); input.value = ""; await loadComments(id); await renderPostCounts(); }
  catch (err) { showToast(err.message); }
  finally { if (button) button.disabled = false; }
}
async function renderPostCounts() {
  try {
    const posts = await request("/posts");
    posts.forEach(p => { const count = $(`comment-count-${p._id}`); if (count) count.textContent = p.commentCount; });
  } catch {}
}
async function renderPosts() {
  const container = $("posts");
  try {
    const posts = await request("/posts");
    $("postTotal").textContent = `${posts.length} ${posts.length === 1 ? "story" : "stories"}`;
    if (!posts.length) {
      container.innerHTML = `<div class="empty-state"><b>No stories just yet.</b><br>Be the first to share an idea with the community.</div>`;
      return;
    }
    container.innerHTML = posts.map(post => {
      const mine = currentUser && post.author && String(post.author._id) === String(currentUser.id);
      const authorName = post.author?.name || "Community member";
      const initial = authorName.charAt(0).toUpperCase();
      const excerpt = post.content.length > 650 ? post.content.slice(0,650) + "…" : post.content;
      return `<article class="post-card">
        <div class="post-meta"><span class="avatar">${escapeHTML(initial)}</span><b>${escapeHTML(authorName)}</b><span>·</span><span>${shortDate(post.createdAt)}</span></div>
        <h3>${escapeHTML(post.title)}</h3><div class="post-body">${escapeHTML(excerpt)}</div>
        <div class="post-footer"><button class="comment-toggle" onclick="toggleComments('${post._id}')">↳ <span id="comment-count-${post._id}">${post.commentCount || 0}</span> comments</button>
        <div class="post-actions">${mine ? `<button class="text-button" onclick='editPost(${JSON.stringify({ _id:post._id,title:post.title,content:post.content }).replace(/'/g,"&#39;")})'>Edit</button><button class="text-button danger" onclick="deletePost('${post._id}')">Delete</button>` : ""}</div></div>
        <section class="comments hidden" id="comments-${post._id}"><h4>Conversation</h4><div id="comment-list-${post._id}"></div>
          <form class="comment-form" onsubmit="addComment(event,'${post._id}')"><input id="comment-input-${post._id}" maxlength="1000" placeholder="${currentUser ? "Write a thoughtful comment…" : "Log in to comment"}" aria-label="Write a comment" required><button class="btn btn-primary" type="submit">Send</button></form>
        </section></article>`;
    }).join("");
  } catch (err) {
    $("postTotal").textContent = "Unable to load";
    container.innerHTML = `<div class="empty-state">Could not load stories: ${escapeHTML(err.message)}<br>Make sure the backend and MongoDB are running, then refresh.</div>`;
  }
}
$("authModal").addEventListener("click", e => { if (e.target === $("authModal")) closeAuth(); });
$("postModal").addEventListener("click", e => { if (e.target === $("postModal")) closePostForm(); });
updateAccount();
renderPosts();