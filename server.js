require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "development_secret_change_me";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  content: { type: String, required: true, trim: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);

function makeToken(user) {
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (password.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) return res.status(409).json({ message: "This email is already registered. Please log in." });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password: hashedPassword });
    res.status(201).json({ message: "Account created successfully.", token: makeToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: "Registration failed.", error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    res.json({ message: "Login successful.", token: makeToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

// List and create posts
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find().populate("author", "name").sort({ createdAt: -1 }).lean();
    const ids = posts.map(p => p._id);
    const counts = await Comment.aggregate([{ $match: { post: { $in: ids } } }, { $group: { _id: "$post", count: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
    res.json(posts.map(p => ({ ...p, commentCount: countMap[p._id.toString()] || 0 })));
  } catch (err) { res.status(500).json({ message: "Could not load posts.", error: err.message }); }
});

app.post("/api/posts", auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "Title and content are required." });
    const post = await Post.create({ title: title.trim(), content: content.trim(), author: req.user.id });
    await post.populate("author", "name");
    res.status(201).json(post);
  } catch (err) { res.status(500).json({ message: "Could not create post.", error: err.message }); }
});

// Edit and delete only the author's own posts
app.put("/api/posts/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) return res.status(403).json({ message: "You can edit only your own posts." });
    if (!req.body.title?.trim() || !req.body.content?.trim()) return res.status(400).json({ message: "Title and content are required." });
    post.title = req.body.title.trim();
    post.content = req.body.content.trim();
    await post.save();
    await post.populate("author", "name");
    res.json(post);
  } catch (err) { res.status(500).json({ message: "Could not update post.", error: err.message }); }
});

app.delete("/api/posts/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) return res.status(403).json({ message: "You can delete only your own posts." });
    await Promise.all([Post.deleteOne({ _id: post._id }), Comment.deleteMany({ post: post._id })]);
    res.json({ message: "Post and its comments deleted." });
  } catch (err) { res.status(500).json({ message: "Could not delete post.", error: err.message }); }
});

// Read and add comments
app.get("/api/posts/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id }).populate("author", "name").sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) { res.status(500).json({ message: "Could not load comments.", error: err.message }); }
});

app.post("/api/posts/:id/comments", auth, async (req, res) => {
  try {
    if (!req.body.text?.trim()) return res.status(400).json({ message: "Comment cannot be empty." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    const comment = await Comment.create({ text: req.body.text.trim(), author: req.user.id, post: post._id });
    await comment.populate("author", "name");
    res.status(201).json(comment);
  } catch (err) { res.status(500).json({ message: "Could not add comment.", error: err.message }); }
});

app.get("/api/health", (req, res) => res.json({ status: "ok", message: "BlogSpace API is running." }));

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI is missing. Create a .env file using .env.example.");
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => console.log(`BlogSpace running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("Startup error:", err.message);
    process.exit(1);
  }
}
start();