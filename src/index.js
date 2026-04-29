const express = require("express");
const env = require("../config/env");
const { closeDatabase, initDatabase, query } = require("./db");
const { getLink, saveLink } = require("./link-store");

const app = express();

app.use(express.json());

function isValidPublicUrl(value) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function generateShortCode(length = 6) {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let shortCode = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    shortCode += alphabet[randomIndex];
  }

  return shortCode;
}

function createUniqueShortCode() {
  return generateShortCode();
}

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/shorten", async (req, res, next) => {
  const { url } = req.body || {};

  if (typeof url !== "string" || !isValidPublicUrl(url)) {
    return res.status(400).json({
      error: "A valid http/https URL is required.",
    });
  }

  try {
    let shortCode = createUniqueShortCode();
    let link;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        link = await saveLink(shortCode, url);
        break;
      } catch (error) {
        if (error.code !== "23505") {
          throw error;
        }

        shortCode = createUniqueShortCode();
      }
    }

    if (!link) {
      throw new Error("Could not generate a unique short code.");
    }

    return res.status(201).json({
      short_code: link.code,
      short_url: `${req.protocol}://${req.get("host")}/${link.code}`,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/:short_code", async (req, res, next) => {
  try {
    const link = await getLink(req.params.short_code);

    if (!link) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    return res.redirect(302, link.long_url);
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Invalid JSON body.",
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "Internal server error.",
  });
});

async function startServer() {
  await initDatabase();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
