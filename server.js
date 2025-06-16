import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "blog",
  password: "anshu@123",
  port: 5432,
});
await db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

async function getAllPosts() {
  const result = await db.query("SELECT * FROM posts ORDER BY created_at DESC");
  return result.rows;
}

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM posts ORDER BY id DESC");
    const posts = result.rows;
    res.render("index", { posts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading posts");
  }
});


app.post("/add", async (req, res) => {
  const { title, content, author } = req.body;
  try {
    await db.query(
      "INSERT INTO posts (title, content, author) VALUES ($1, $2, $3)",
      [title, content, author || null]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding post");
  }
});


app.get("/edit/:id", async (req, res) => {
  const id = req.params.id;
  console.log(id);
  try {
    const result = await db.query("SELECT * FROM posts WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).send("Post not found");
    res.render("edit.ejs", { post: result.rows[0] });
  } catch {
    res.status(500).send("Server error");
  }
});

app.post("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const { title, content, author } = req.body;
  try {
    await db.query(
      "UPDATE posts SET title = $1, content = $2, author = $3 WHERE id = $4",
      [title, content, author, id]
    );
    res.redirect("/");
  } catch {
    res.status(500).send("Server error");
  }
});




app.post("/delete/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    await db.query("DELETE FROM posts WHERE id = $1", [postId]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting post");
  }
});

app.listen(port);

process.on("SIGINT", async () => {
  await db.end();
  process.exit();
});
