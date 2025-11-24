import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import session from "express-session";
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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || "change_me_in_env";
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Session middleware
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Expose current user to views with fallback to empty object
app.use((req, res, next) => {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : {};
  next();
});

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
    cb(null, uploadsDir);
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

// Simple authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect("/login");
}

// Auth routes
app.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  const { error } = req.query;
  res.render("login", { error: error || '' });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "password";

  if (username === adminUser && password === adminPass) {
    req.session.user = { username };
    console.log(`[Auth] 🟢 User logged in: ${username}`);
    return res.redirect("/");
  }

  console.log(`[Auth] 🔴 Failed login attempt for: ${username}`);
  return res.redirect("/login?error=invalid");
});

app.post("/logout", (req, res) => {
  if (!req.session) {
    return res.redirect("/login");
  }
  req.session.destroy((err) => {
    if (err) {
      console.error(`[Auth] 🔴 Logout error: ${err.message}`);
    }
    res.redirect("/login");
  });
});

// Routes

app.get("/", requireAuth, async (req, res) => {
  try {
    const totalUsers = await User.count();

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersLast7 = await User.count({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } },
    });

    const newUsersLast30 = await User.count({
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
    });

    const recentUsers = await User.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    console.log(
      `[Dashboard] Users: total=${totalUsers}, last7=${newUsersLast7}, last30=${newUsersLast30}`
    );

    res.render("index", {
      totalUsers,
      newUsersLast7,
      newUsersLast30,
      recentUsers,
    });
  } catch (err) {
    console.error(`[Dashboard] 🔴 Error loading stats: ${err.message}`);
    res.render("index", {
      totalUsers: 0,
      newUsersLast7: 0,
      newUsersLast30: 0,
      recentUsers: [],
    });
  }
});

app.get("/users", requireAuth, async (req, res) => {
  const { search, filter, page = 1, limit = 10, upload, imported, skipped, errors, bulk, deletedCount, sort, direction } = req.query;

  // Sanitize pagination values
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  // Sanitize search text (trim & cap length)
  let safeSearch = (search || '').toString().trim();
  if (safeSearch.length > 100) {
    safeSearch = safeSearch.substring(0, 100);
  }

  // Sanitize filter field
  const safeFilter = filter === 'name' || filter === 'email' ? filter : '';

  let whereClause = {};
  if (safeSearch) {
    if (safeFilter === "name") {
      whereClause = { name: { [Op.like]: `%${safeSearch}%` } };
    } else if (safeFilter === "email") {
      whereClause = { email: { [Op.like]: `%${safeSearch}%` } };
    } else {
      // Default: search in both name and email
      whereClause = {
        [Op.or]: [
          { name: { [Op.like]: `%${safeSearch}%` } },
          { email: { [Op.like]: `%${safeSearch}%` } },
        ],
      };
    }
  }

  // Sorting configuration
  const sortKey = (sort || "createdAt").toString();
  const sortDir = (direction || "desc").toString().toLowerCase() === "asc" ? "ASC" : "DESC";

  let sortField;
  if (sortKey === "id") {
    sortField = "id";
  } else if (sortKey === "name") {
    sortField = "name";
  } else if (sortKey === "email") {
    sortField = "email";
  } else {
    sortField = "createdAt";
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
    limit: limitNum,
    offset,
    order: [[sortField, sortDir]],
  });

  const totalPages = Math.ceil(count / limitNum);

  console.log(`[Users Page] Loaded ${users.length} users (page ${pageNum}/${totalPages})`);
  res.render("users", {
    users,
    search: safeSearch,
    filter: safeFilter,
    currentPage: pageNum,
    totalPages,
    totalUsers: count,
    limit: limitNum,
    upload, // Pass upload status to template
    imported: imported ? parseInt(imported) : undefined,
    skipped: skipped ? parseInt(skipped) : undefined,
    errors: errors ? parseInt(errors) : undefined,
    bulk: bulk || '',
    deletedCount: deletedCount ? parseInt(deletedCount) : undefined,
    currentSort: sortField,
    currentDirection: sortDir.toLowerCase(),
  });
});

// User details page
app.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      console.log(`[User Details] ⚠️ Invalid user ID: ${req.params.id}`);
      return res.status(400).render("error", {
        title: "Invalid User ID",
        message: "The requested user ID is not valid.",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      console.log(`[User Details] ⚠️ User ID ${id} not found`);
      return res.status(404).render("user-details", { user: null });
    }

    console.log(`[User Details] 🟢 Rendering details for user ${user.id} (${user.name})`);
    res.render("user-details", { user });
  } catch (err) {
    console.error(`[User Details] 🔴 Error: ${err.message}`);
    res.status(500).send("Error loading user details");
  }
});

app.get("/add", requireAuth, (req, res) => {
  console.log("[Add Page] Rendering new user form");
  res.render("add");
});

app.get("/proxy", requireAuth, (req, res) => {
  console.log("[Proxy Page] Rendering proxy tester");
  res.render("proxy");
});

app.post("/add", requireAuth, async (req, res) => {
  const { name, email } = req.body;
  try {
    await User.create({ name, email });
    console.log(`[Create] 🟢 User Added: ${name} (${email})`);
    res.redirect("/users");
  } catch (err) {
    console.error(`[Create] 🔴 Error: ${err.message}`);
    res.status(500).render("error", {
      title: "Error Adding User",
      message: "There was a problem adding the user. Please try again.",
      error: err,
    });
  }
});

app.put("/update/:id", requireAuth, async (req, res) => {
  const { name, email } = req.body;
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      console.log(`[Update] ⚠️ Invalid user ID: ${req.params.id}`);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const [updated] = await User.update({ name, email }, { where: { id } });
    updated
      ? console.log(`[Update] 🟢 User ${req.params.id} updated to ${name} (${email})`)
      : console.log(`[Update] ⚠️ User ID ${req.params.id} not found`);
    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error(`[Update] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post("/delete/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      console.log(`[Delete] ⚠️ Invalid user ID: ${req.params.id}`);
      return res.status(400).render("error", {
        title: "Invalid User ID",
        message: "The user ID supplied for deletion is not valid.",
      });
    }

    const deleted = await User.destroy({ where: { id } });
    deleted
      ? console.log(`[Delete] 🗑️ User ID ${req.params.id} deleted`)
      : console.log(`[Delete] ⚠️ User ID ${req.params.id} not found`);
    res.redirect("/users");
  } catch (err) {
    console.error(`[Delete] 🔴 Error: ${err.message}`);
    res.status(500).render("error", {
      title: "Error Deleting User",
      message: "There was a problem deleting the user. Please try again.",
      error: err,
    });
  }
});

// Bulk delete users
app.post("/users/bulk-delete", requireAuth, async (req, res) => {
  try {
    let { ids } = req.body;

    if (!ids) {
      console.log("[Bulk Delete] ⚠️ No user IDs provided");
      return res.redirect("/users?bulk=none-selected");
    }

    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    // Sanitize IDs (integers only)
    const numericIds = ids
      .map((val) => parseInt(val, 10))
      .filter((val) => Number.isInteger(val) && val > 0);

    if (numericIds.length === 0) {
      console.log("[Bulk Delete] ⚠️ No valid user IDs after sanitization");
      return res.redirect("/users?bulk=none-selected");
    }

    const deleted = await User.destroy({ where: { id: numericIds } });
    console.log(`[Bulk Delete] 🗑️ Deleted ${deleted} user(s): [${ids.join(", ")}]`);

    res.redirect(`/users?bulk=deleted&deletedCount=${deleted}`);
  } catch (err) {
    console.error(`[Bulk Delete] 🔴 Error: ${err.message}`);
    res.redirect("/users?bulk=server-error");
  }
});

app.get("/user/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      console.log(`[Fetch] ⚠️ Invalid user ID: ${req.params.id}`);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findByPk(id);
    user
      ? console.log(`[Fetch] 🟢 User Found: ${user.name}`)
      : console.log(`[Fetch] ⚠️ User ID ${id} not found`);
    res.json(user || { error: "Not found" });
  } catch (err) {
    console.error(`[Fetch] 🔴 Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// CSV Export
app.get("/export", requireAuth, async (req, res) => {
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
app.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
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
app.get("/proxy/:url", requireAuth, async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.url || "");

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      console.log(`[Proxy Test] ⚠️ Invalid URL: ${raw}`);
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.log(`[Proxy Test] ⚠️ Blocked non-HTTP(S) URL: ${parsed.href}`);
      return res.status(400).json({ error: "Only http and https URLs are allowed" });
    }

    // Basic length guard to avoid abuse
    if (parsed.href.length > 2000) {
      console.log(`[Proxy Test] ⚠️ URL too long`);
      return res.status(400).json({ error: "URL is too long" });
    }

    console.log(`[Proxy Test] Requesting: ${parsed.href}`);

    const response = await fetch(parsed.href);
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

// 404 handler (keep after all routes)
app.use((req, res) => {
  res.status(404).render("not-found", { url: req.originalUrl });
});

// Global error handler (last middleware)
app.use((err, req, res, next) => {
  console.error(`[Global Error] 🔴 ${err.message}`);

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(500).json({ error: "Internal server error" });
  }

  res.status(500).render("error", {
    title: "Server Error",
    message: "Something went wrong. Please try again later.",
    error: err,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`[${new Date().toISOString()}] ~ Anurag---> ~ Server running at http://localhost:${PORT}`)
);
