
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
const nodemailer = require("nodemailer");
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

/* ✅ Hilfsfunktionen für JSON-Datei */
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

/* ✅ EMAIL */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "srhassar@gmail.com",
    pass: "xexj unxz rznt xmrm"
  }
});

/* ✅ ROUTES */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/kontakt", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public/register.html")));
app.get("/bewertungen", (req, res) => {
  res.sendFile(path.join(__dirname, "public/bewertungen.html"));
});

/* ✅ REGISTER */
app.post("/api/register", async (req, res) => {
  try {
    const { firstname, email, password, role } = req.body;

    if (!firstname || !email || !password) {
      return res.status(400).send("Fehlende Daten");
    }

    const users = loadUsers();

    // ✅ Prüfen ob Email schon existiert
    if (users.find(u => u.email === email)) {
      return res.status(400).send("Email bereits registriert");
    }

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

// ✅ Eigene Anfragen abrufen
app.get("/api/requests", (req, res) => {
  const user = req.query.user;
  const requests = loadRequests();

  if (user) {
    res.json(requests.filter(r => r.user === user));
  } else {
    res.json(requests);
  }
});


// ✅ Bewertung speichern
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

/* ✅ START */
app.listen(PORT, () => {
  console.log("✅ Server läuft: http://localhost:3000");
});


const multer = require("multer");

// ✅ Bild-Upload Konfiguration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images/uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ✅ Route hinzufügen
app.get("/create-request", (req, res) => {
  res.sendFile(path.join(__dirname, "public/create-request.html"));
});

// ✅ Hilfsfunktionen für Anfragen
function loadRequests() {
  if (!fs.existsSync("requests.json")) return [];
  return JSON.parse(fs.readFileSync("requests.json", "utf8"));
}
function saveRequests(requests) {
  fs.writeFileSync("requests.json", JSON.stringify(requests, null, 2));
}

// ✅ Anfrage erstellen
app.post("/api/create-request", upload.single("image"), (req, res) => {
  const { title, description, category, location, user } = req.body;

  const requests = loadRequests();

  const newRequest = {
    id: Date.now(),
    title,
    description,
    category,
    location,
    user,
    image: req.file ? req.file.filename : null,
    status: "offen",
    date: new Date().toLocaleDateString("de-DE")
  };

  requests.push(newRequest);
  saveRequests(requests);

  res.sendStatus(200);
});

// ✅ Admin - Dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// ✅ Admin - Anfragen-Seite
app.get("/admin/anfragen", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// ✅ Admin - Nutzer-Seite
app.get("/admin/users", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// ✅ Admin - API: alle Nutzer
app.get("/api/admin/users", (req, res) => {
  const users = loadUsers();
  // Passwörter nicht mitsenden!
  res.json(users.map(u => ({ firstname: u.firstname, email: u.email, role: u.role })));
});

// ✅ Admin - alle Anfragen
app.get("/api/admin/requests", (req, res) => {
  res.json(loadRequests());
});

app.post("/api/admin/status", (req, res) => {
  const { id, status } = req.body;
  const requests = loadRequests();
  const request = requests.find(r => r.id === id);
  if (!request) return res.status(404).send("Nicht gefunden");
  request.status = status;
  saveRequests(requests);
  res.sendStatus(200);
});

app.post("/api/kontakt", async (req, res) => {
  const { name, email, betreff, nachricht } = req.body;

  try {
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