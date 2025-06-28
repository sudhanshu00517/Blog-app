import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
await db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return done(null, false);
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);
    if (result.rows.length === 0) {
      const email = profile.emails?.[0]?.value || "";
      const newUserResult = await db.query(
        "INSERT INTO users (google_id, email) VALUES ($1, $2) RETURNING *",
        [profile.id, email]
      );
      return done(null, newUserResult.rows[0]);
    } else {
      return done(null, result.rows[0]);
    }
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM posts WHERE user_id = $1 ORDER BY id DESC", [req.user.id]);
    res.render("index", { posts: result.rows, user: req.user });
  } catch {
    res.status(500).send("Error loading posts");
  }
});

app.get("/register", (req, res) => {
  res.render("register", { error: null, success: null, email: "" });
});

app.post("/register", async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render("register", { error: "Passwords do not match", success: null, email });
  }
  try {
    const existing = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.render("register", { error: "Email already registered", success: null, email });
    }
    const hashed = await bcrypt.hash(password, saltRounds);
    await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashed]);
      const newUser = newUserResult.rows[0];

    req.login(newUser, (err) => {
      if (err) return next(err);
      return res.redirect("/");
    });
  } catch {
    res.render("register", { error: "Registration failed", success: null, email });
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login"
}));

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", {
  successRedirect: "/",
  failureRedirect: "/login"
}));

app.post("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect("/login");
  });
});

app.post("/add", ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;
  try {
    await db.query("INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3)", [title, content, req.user.id]);
    res.redirect("/");
  } catch {
    res.status(500).send("Error adding post");
  }
});

app.get("/edit/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query("SELECT * FROM posts WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).send("Not found");
    res.render("edit", { post: result.rows[0] });
  } catch {
    res.status(500).send("Server error");
  }
});

app.post("/edit/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { title, content } = req.body;
  try {
    await db.query("UPDATE posts SET title = $1, content = $2 WHERE id = $3 AND user_id = $4", [title, content, id, req.user.id]);
    res.redirect("/");
  } catch {
    res.status(500).send("Server error");
  }
});

app.post("/delete/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  try {
    await db.query("DELETE FROM posts WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    res.redirect("/");
  } catch {
    res.status(500).send("Error deleting post");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on("SIGINT", async () => {
  await db.end();
  process.exit();
});
