import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import sequelize from "./sequelize.js";
import User from "./models/User.js";
import methodOverride from "method-override";
import multer from "multer";
import { Parser } from "json2csv";
import { Sequelize } from "sequelize";
const { Op } = Sequelize;

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Request Logger
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] 📩 ${req.method} ${req.originalUrl} | IP: ${req.ip}`
  );
  next();
});

// Routes

app.get("/", async (req, res) => {
  const users = await User.findAll();
  console.log(`[Dashboard] Found ${users.length} users`);
  res.render("index", { users });
});

app.get("/users", async (req, res) => {
  const { search, filter, page = 1, limit = 10, upload, imported, skipped, errors } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = {};
  if (search) {
    if (filter === "name") {
      whereClause = { name: { [Op.like]: `%${search}%` } };
    } else if (filter === "email") {
      whereClause = { email: { [Op.like]: `%${search}%` } };
    } else {
      // Default: search in both name and email
      whereClause = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      };
    }
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["createdAt", "DESC"]],
  });

  const totalPages = Math.ceil(count / limit);

  console.log(`[Users Page] Loaded ${users.length} users (page ${page}/${totalPages})`);
  res.render("users", {
    users,
    search: search || '',
    filter: filter || '',
    currentPage: parseInt(page),
    totalPages,
    totalUsers: count,
    limit: parseInt(limit),
    upload, // Pass upload status to template
    imported: imported ? parseInt(imported) : undefined,
    skipped: skipped ? parseInt(skipped) : undefined,
    errors: errors ? parseInt(errors) : undefined,
  });
});

// User details page
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      console.log(`[User Details] ⚠️ User ID ${req.params.id} not found`);
      return res.status(404).render("user-details", { user: null });
    }

    console.log(`[User Details] 🟢 Rendering details for user ${user.id} (${user.name})`);
    res.render("user-details", { user });
  } catch (err) {
    console.error(`[User Details] 🔴 Error: ${err.message}`);
    res.status(500).send("Error loading user details");
  }
});

app.get("/add", (req, res) => {
  console.log("[Add Page] Rendering new user form");
  res.render("add");
});

app.get("/proxy", (req, res) => {
  console.log("[Proxy Page] Rendering proxy tester");
  res.render("proxy");
});

app.post("/add", async (req, res) => {
  const { name, email } = req.body;
  try {
    await User.create({ name, email });
    console.log(`[Create] 🟢 User Added: ${name} (${email})`);
    res.redirect("/users");
  } catch (err) {
    console.error(`[Create] 🔴 Error: ${err.message}`);
    res.send("Error adding user: " + err.message);
  }
});

app.put("/update/:id", async (req, res) => {
  const { name, email } = req.body;
  try {
    const [updated] = await User.update({ name, email }, { where: { id: req.params.id } });
    updated
      ? console.log(`[Update] 🟢 User ${req.params.id} updated to ${name} (${email})`)
      : console.log(`[Update] ⚠️ User ID ${req.params.id} not found`);
    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error(`[Update] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post("/delete/:id", async (req, res) => {
  try {
    const deleted = await User.destroy({ where: { id: req.params.id } });
    deleted
      ? console.log(`[Delete] 🗑️ User ID ${req.params.id} deleted`)
      : console.log(`[Delete] ⚠️ User ID ${req.params.id} not found`);
    res.redirect("/users");
  } catch (err) {
    console.error(`[Delete] 🔴 Error: ${err.message}`);
    res.send("Error deleting user: " + err.message);
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    user
      ? console.log(`[Fetch] 🟢 User Found: ${user.name}`)
      : console.log(`[Fetch] ⚠️ User ID ${req.params.id} not found`);
    res.json(user || { error: "Not found" });
  } catch (err) {
    console.error(`[Fetch] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// CSV Export
app.get("/export", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "createdAt", "updatedAt"],
      order: [["createdAt", "DESC"]],
    });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(users.map(user => user.toJSON()));

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    res.send(csv);

    console.log(`[Export] 📄 Exported ${users.length} users to CSV`);
  } catch (err) {
    console.error(`[Export] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// File Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    console.log(`[Upload] ❌ No file uploaded`);
    return res.redirect("/users?upload=no-file");
  }

  console.log(`[Upload] 📎 File uploaded: ${req.file.filename}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

  try {
    // Validate file type
    if (!req.file.mimetype.includes('text') && !req.file.mimetype.includes('csv') && !req.file.originalname.endsWith('.csv')) {
      console.log(`[Upload] ❌ Invalid file type: ${req.file.mimetype}`);
      return res.redirect("/users?upload=invalid-type");
    }

    // Check file size (limit to 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      console.log(`[Upload] ❌ File too large: ${req.file.size} bytes`);
      return res.redirect("/users?upload=file-too-large");
    }

    const filePath = path.join(__dirname, "uploads", req.file.filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Check for empty file
    if (!fileContent.trim()) {
      console.log(`[Upload] ❌ Empty file`);
      return res.redirect("/users?upload=empty-file");
    }

    const lines = fileContent.split('\n').filter(line => line.trim());
    console.log(`[Upload] Processing CSV with ${lines.length} lines`);

    if (lines.length < 2) {
      console.log(`[Upload] ❌ CSV file has insufficient data (only ${lines.length} lines)`);
      return res.redirect("/users?upload=insufficient-data");
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    console.log(`[Upload] Headers found: ${headers.join(', ')}`);

    const nameIndex = headers.indexOf('name');
    const emailIndex = headers.indexOf('email');

    if (nameIndex === -1 || emailIndex === -1) {
      console.log(`[Upload] ❌ Required columns 'name' and 'email' not found in headers`);
      return res.redirect("/users?upload=missing-columns");
    }

    // Process data rows
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        const values = parseCSVLine(line);
        console.log(`[Upload] Processing line ${i}: ${values.join(' | ')}`);

        if (values.length <= Math.max(nameIndex, emailIndex)) {
          console.log(`[Upload] ⚠️ Not enough columns in line ${i}`);
          errors.push(`Line ${i}: Insufficient columns`);
          errorCount++;
          continue;
        }

        const rawName = values[nameIndex]?.trim();
        const rawEmail = values[emailIndex]?.trim();

        // Validate data
        if (!rawName || !rawEmail) {
          console.log(`[Upload] ⚠️ Missing name or email in line ${i}`);
          errors.push(`Line ${i}: Missing name or email`);
          errorCount++;
          continue;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(rawEmail)) {
          console.log(`[Upload] ⚠️ Invalid email format in line ${i}: ${rawEmail}`);
          errors.push(`Line ${i}: Invalid email format`);
          errorCount++;
          continue;
        }

        // Check for reasonable name length
        if (rawName.length > 100) {
          console.log(`[Upload] ⚠️ Name too long in line ${i}: ${rawName.substring(0, 50)}...`);
          errors.push(`Line ${i}: Name too long`);
          errorCount++;
          continue;
        }

        // Attempt to create user
        try {
          await User.create({
            name: rawName,
            email: rawEmail
          });
          importedCount++;
          console.log(`[Upload] ✅ Created user: ${rawName} (${rawEmail})`);
        } catch (dbErr) {
          if (dbErr.name === 'SequelizeUniqueConstraintError') {
            console.log(`[Upload] ⚠️ Duplicate user skipped: ${rawName} (${rawEmail})`);
            errors.push(`Line ${i}: Duplicate user`);
            skippedCount++;
          } else {
            console.log(`[Upload] ⚠️ Database error for line ${i}: ${dbErr.message}`);
            errors.push(`Line ${i}: Database error - ${dbErr.message}`);
            errorCount++;
          }
        }

      } catch (parseErr) {
        console.log(`[Upload] ⚠️ Parse error in line ${i}: ${parseErr.message}`);
        errors.push(`Line ${i}: Parse error - ${parseErr.message}`);
        errorCount++;
      }
    }

    // Log summary
    console.log(`[Upload] 📊 Summary: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);

    // Store errors in session or redirect with status
    if (errorCount > 0) {
      // For now, just log errors. In a full app, you'd store these in session/flash messages
      console.log(`[Upload] 📋 Errors encountered:`, errors.slice(0, 10)); // Show first 10 errors
    }

    // Determine redirect based on results
    if (importedCount > 0) {
      res.redirect(`/users?upload=success&imported=${importedCount}&skipped=${skippedCount}&errors=${errorCount}`);
    } else if (errorCount > 0) {
      res.redirect("/users?upload=partial-success");
    } else {
      res.redirect("/users?upload=no-new-users");
    }

  } catch (err) {
    console.error(`[Upload] 🔴 Unexpected error: ${err.message}`);
    res.redirect("/users?upload=server-error");
  } finally {
    // Clean up uploaded file
    try {
      if (req.file && fs.existsSync(path.join(__dirname, "uploads", req.file.filename))) {
        fs.unlinkSync(path.join(__dirname, "uploads", req.file.filename));
        console.log(`[Upload] 🗑️ Cleaned up file: ${req.file.filename}`);
      }
    } catch (cleanupErr) {
      console.log(`[Upload] ⚠️ Failed to cleanup file: ${cleanupErr.message}`);
    }
  }
});

// Proxy Test
app.get("/proxy/:url", async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    console.log(`[Proxy Test] Requesting: ${url}`);

    const response = await fetch(url);
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    console.error(`[Proxy Test] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// CSV parsing helper function
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current);

  return result;
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`[${new Date().toISOString()}] ~ Anurag---> ~ Server running at http://localhost:${PORT}`)
);
