import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

let posts = [];  // Store posts temporarily

app.get("/", (req, res) => {
  res.render("index", { posts });
});

app.get("/new", (req, res) => {
  res.render("new");
});

app.get("/edit/:id", (req, res) => {
  const postId = Number(req.params.id);
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).send("Post not found");
  }

  res.render("edit", { post });
});

app.post("/edit/:id",(req,res)=>{
  const postId=Number(req.params.id);
  const postIndex = posts.findIndex((p) => p.id === postId);
  if (postIndex === -1) {
    return res.status(404).send("Post not found");
  }

  posts[postIndex].title = title;
  posts[postIndex].content = content;

  res.redirect("/");
});




app.post("/new", (req, res) => {
  const { title, content } = req.body;
  const newPost = {
    id: Date.now(),  
    title,
    content
  };
  posts.push(newPost);  
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
