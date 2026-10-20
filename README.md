# BlogSpace — Thiranex Internship Task

A beginner-friendly full-stack blogging platform with authentication, CRUD posts, comments, REST APIs and MongoDB.

## Requirements
- Node.js 18 or newer
- MongoDB Atlas account (or local MongoDB)
- VS Code

## Setup
1. Extract this ZIP and open the `blogspace-thiranex` folder in VS Code.
2. Open the terminal in this folder and run:
   ```bash
   npm install
   ```
3. Copy `.env.example` to a new file named `.env`.
4. Edit `.env` and set your MongoDB connection string:
   ```env
   MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/blogspace?retryWrites=true&w=majority
   JWT_SECRET=use_a_long_random_secret_here
   PORT=5000
   ```
   Replace the sample URI with your actual MongoDB Atlas URI. URL-encode special characters in your database password. In Atlas, allow your current IP under Network Access.
5. Start the app:
   ```bash
   npm start
   ```
6. Open **http://localhost:5000** in your browser. Do not open `index.html` directly with Live Server; the backend APIs need the Node server.

## Demo checklist
1. Register a new account.
2. Create a blog post.
3. Open its comments and add a comment.
4. Edit the post and save.
5. Delete the post to demonstrate CRUD.
6. Register a second account or log in in another browser to demonstrate user interaction.
7. Check `http://localhost:5000/api/health` for API status and `http://localhost:5000/api/posts` for the posts JSON.

## REST API endpoints
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login and receive JWT | No |
| GET | `/api/posts` | List posts | No |
| POST | `/api/posts` | Create post | Yes |
| PUT | `/api/posts/:id` | Edit own post | Yes |
| DELETE | `/api/posts/:id` | Delete own post and comments | Yes |
| GET | `/api/posts/:id/comments` | List comments | No |
| POST | `/api/posts/:id/comments` | Add comment | Yes |
| GET | `/api/health` | Health check | No |

## Database models
- **User:** name, email, hashed password
- **Post:** title, content, author, timestamps
- **Comment:** text, author, post, timestamps

## Important
- Passwords are hashed with bcrypt before storage.
- JWT protects create/edit/delete post and comment actions.
- Users can edit or delete only their own posts.
- This is a starter project. Before production use, add rate limiting, stronger validation, CSRF/security hardening where applicable, and tests.
