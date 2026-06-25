const express = require("express");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const multer = require("multer");

const app = express();
app.use(express.json());
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

/* ✅ Hilfsfunktionen */
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}
function saveUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}
function loadRequests() {
  if (!fs.existsSync("requests.json")) return [];
  return JSON.parse(fs.readFileSync("requests.json", "utf8"));
}
function saveRequests(requests) {
  fs.writeFileSync("requests.json", JSON.stringify(requests, null, 2));
}

/* ✅ EMAIL */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "srhassar@gmail.com",
    pass: "xexj unxz rznt xmrm"
  }
});

/* ✅ Bild-Upload */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images/uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

/* ✅ SEITEN-ROUTES */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/kontakt", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public/register.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/bewertungen", (req, res) => res.sendFile(path.join(__dirname, "public/bewertungen.html")));
app.get("/create-request", (req, res) => res.sendFile(path.join(__dirname, "public/create-request.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public/admin.html")));
app.get("/admin/anfragen", (req, res) => res.sendFile(path.join(__dirname, "public/admin.html")));
app.get("/admin/users", (req, res) => res.sendFile(path.join(__dirname, "public/admin.html")));

/* ✅ REGISTER */
app.post("/api/register", async (req, res) => {
  try {
    const { firstname, email, password, role } = req.body;
    if (!firstname || !email || !password) return res.status(400).send("Fehlende Daten");

    const users = loadUsers();
    if (users.find(u => u.email === email)) return res.status(400).send("Email bereits registriert");

    users.push({ firstname, email, password, role: role || "kunde" });
    saveUsers(users);
    console.log("✅ User gespeichert:", email);

    await transporter.sendMail({
      from: "FixIt <srhassar@gmail.com>",
      to: email,
      subject: "Registrierung erfolgreich ✅",
      html: `<h2>Willkommen ${firstname}</h2>`
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/* ✅ LOGIN */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).send("User existiert nicht");
  if (user.password !== password) return res.status(401).send("Falsches Passwort");
  console.log("✅ Login erfolgreich:", email);
  res.json({ firstname: user.firstname, role: user.role });
});

/* ✅ ANFRAGEN */
app.get("/api/requests", (req, res) => {
  const user = req.query.user;
  const requests = loadRequests();
  if (user) {
    res.json(requests.filter(r => r.user === user));
  } else {
    res.json(requests);
  }
});

app.post("/api/create-request", upload.single("image"), (req, res) => {
  const { title, description, category, location, user } = req.body;
  const requests = loadRequests();
  requests.push({
    id: Date.now(),
    title, description, category, location, user,
    image: req.file ? req.file.filename : null,
    status: "offen",
    date: new Date().toLocaleDateString("de-DE")
  });
  saveRequests(requests);
  res.sendStatus(200);
});

/* ✅ BEWERTUNG */
app.post("/api/rate", (req, res) => {
  const { requestId, stars, feedback } = req.body;
  const requests = loadRequests();
  const request = requests.find(r => String(r.id) === String(requestId));
  if (!request) return res.status(404).send("Nicht gefunden");
  request.stars = stars;
  request.feedback = feedback || "";
  saveRequests(requests);
  res.sendStatus(200);
});

/* ✅ ADMIN */
app.get("/api/admin/requests", (req, res) => res.json(loadRequests()));

app.get("/api/admin/users", (req, res) => {
  const users = loadUsers();
  res.json(users.map(u => ({ firstname: u.firstname, email: u.email, role: u.role })));
});

app.post("/api/admin/status", (req, res) => {
  const { id, status } = req.body;
  const requests = loadRequests();
  const request = requests.find(r => String(r.id) === String(id));
  if (!request) return res.status(404).send("Nicht gefunden");
  request.status = status;
  saveRequests(requests);
  res.sendStatus(200);
});

/* ✅ KONTAKT / SUPPORT */
app.post("/api/kontakt", async (req, res) => {
  const { name, email, betreff, nachricht } = req.body;
  try {
    // Support in JSON speichern
    const supportFile = "support.json";
    const support = fs.existsSync(supportFile)
      ? JSON.parse(fs.readFileSync(supportFile, "utf8"))
      : [];
    support.push({
      id: Date.now(),
      name, email, betreff, nachricht,
      datum: new Date().toLocaleDateString("de-DE")
    });
    fs.writeFileSync(supportFile, JSON.stringify(support, null, 2));

    // Email senden
    await transporter.sendMail({
      from: `FixIt Support <srhassar@gmail.com>`,
      to: "srhassar@gmail.com",
      subject: `[Support] ${betreff} – von ${name}`,
      html: `
        <h2>Neue Support-Anfrage</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <p><strong>Betreff:</strong> ${betreff}</p>
        <p><strong>Nachricht:</strong></p>
        <p>${nachricht}</p>
      `
    });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/api/support", (req, res) => {
  const supportFile = "support.json";
  if (!fs.existsSync(supportFile)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(supportFile, "utf8")));
});

/* ✅ START */
app.listen(PORT, () => {
  console.log("✅ Server läuft: http://localhost:3000");
});

app.post("/api/support/antwort", async (req, res) => {
  const { email, name, betreff, antwort } = req.body;
  try {
    await transporter.sendMail({
      from: `FixIt Support <srhassar@gmail.com>`,
      to: email,
      subject: `Re: ${betreff}`,
      html: `
        <h2>Antwort von FixIt Service</h2>
        <p>Hallo ${name},</p>
        <p>${antwort}</p>
        <br>
        <p>Mit freundlichen Grüßen,<br>FixIt Service Team</p>
      `
    });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});