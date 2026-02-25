import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: List all files in the project (excluding node_modules, dist, etc.)
  app.get("/api/files", (req, res) => {
    const rootDir = __dirname;
    const files: string[] = [];

    function walk(dir: string) {
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(rootDir, filePath);

        // Exclude common directories
        if (
          file === "node_modules" ||
          file === ".git" ||
          file === "dist" ||
          file === ".next" ||
          file === ".cache"
        ) {
          return;
        }

        if (stat && stat.isDirectory()) {
          walk(filePath);
        } else {
          files.push(relativePath);
        }
      });
    }

    try {
      walk(rootDir);
      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Read file content
  app.get("/api/files/content", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Path is required" });
    }

    const fullPath = path.join(__dirname, filePath);

    // Security check: ensure the path is within the project directory
    if (!fullPath.startsWith(__dirname)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Write file content
  app.post("/api/files/write", (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "Path and content are required" });
    }

    const fullPath = path.join(__dirname, filePath);

    if (!fullPath.startsWith(__dirname)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, "utf-8");
      res.json({ success: true, message: `File ${filePath} written successfully` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Delete file
  app.delete("/api/files/delete", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Path is required" });
    }

    const fullPath = path.join(__dirname, filePath);

    if (!fullPath.startsWith(__dirname)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }
      fs.unlinkSync(fullPath);
      res.json({ success: true, message: `File ${filePath} deleted successfully` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
