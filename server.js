const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();
const port = Number(process.env.PORT || 3000);

const siteDir = path.join(__dirname, "site");
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");

const pageFiles = new Map([
  ["/", "index.html"],
  ["/about", path.join("about", "index.html")],
  ["/resources", path.join("resources", "index.html")],
  ["/how-it-works", path.join("how-it-works", "index.html")],
  ["/contact", path.join("contact", "index.html")],
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["checked", "on", "true", "1", "yes"].includes(value.toLowerCase());
};

const trimField = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const appendJsonLine = async (fileName, payload) => {
  await fs.mkdir(dataDir, {recursive: true});
  const filePath = path.join(dataDir, fileName);
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
};

const contactPayload = (body) => {
  return {
    name: trimField(body.name),
    from_email: trimField(body.from_email),
    from_phone: trimField(body.from_phone),
    message: trimField(body.message),
    consent:
      toBoolean(body.consent) ||
      toBoolean(
        body["I allow this website to store my submission so they can respond to my inquiry."],
      ),
  };
};

const newsletterPayload = (body) => {
  return {
    from_email: trimField(body.from_email),
  };
};

const validateContact = (payload) => {
  if (!payload.name || !payload.from_email || !payload.from_phone || !payload.consent) {
    return false;
  }

  return emailPattern.test(payload.from_email);
};

const validateNewsletter = (payload) => {
  return !!payload.from_email && emailPattern.test(payload.from_email);
};

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use("/_local", express.static(publicDir));

app.post("/api/contact", async (req, res) => {
  const payload = contactPayload(req.body);
  if (!validateContact(payload)) {
    return res.status(400).json({ok: false});
  }

  try {
    await appendJsonLine("contact-submissions.jsonl", {
      ...payload,
      createdAt: new Date().toISOString(),
    });
    return res.json({ok: true});
  } catch (error) {
    console.error("Contact form write failed:", error);
    return res.status(500).json({ok: false});
  }
});

app.post("/api/newsletter", async (req, res) => {
  const payload = newsletterPayload(req.body);
  if (!validateNewsletter(payload)) {
    return res.status(400).json({ok: false});
  }

  try {
    await appendJsonLine("newsletter-signups.jsonl", {
      ...payload,
      createdAt: new Date().toISOString(),
    });
    return res.json({ok: true});
  } catch (error) {
    console.error("Newsletter form write failed:", error);
    return res.status(500).json({ok: false});
  }
});

for (const [route, relativeFile] of pageFiles.entries()) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(siteDir, relativeFile));
  });
}

app.use(express.static(siteDir));

app.use((req, res) => {
  res.status(404).send("Not found");
});

const start = async () => {
  await fs.mkdir(dataDir, {recursive: true});
  app.listen(port, () => {
    console.log(`Ephilium clone running at http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
