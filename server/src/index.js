import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import db from "./db.js";
import { analyzeFridge } from "./ai/analyzeFridge.js";
import { matchRecipes } from "./recipes.js";

const app = express();
const port = Number(process.env.PORT || 5000);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) cb(null, true);
    else cb(new Error("Please upload image files only."));
  }
});

const cleanName = value => String(value ?? "").trim().slice(0, 100);
const validStock = value => ["available", "low", "empty"].includes(value);
const getFridgeItems = () => db.prepare("SELECT * FROM fridge_items ORDER BY id DESC").all();

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "fridge-scan", aiMode: process.env.AI_MODE || "demo" }));

app.get("/api/items", (_req, res) => res.json({ items: getFridgeItems() }));

app.post("/api/scan", (req, res, next) => {
  upload.array("photos", 3)(req, res, async err => {
    if (err) return next(err);
    try {
      const source = req.body.source === "sample" ? "sample" : "camera";
      if (source !== "sample" && (!req.files || req.files.length < 1 || req.files.length > 3)) {
        return res.status(400).json({ error: "Capture between 1 and 3 photos, or choose sample photos." });
      }
      const result = await analyzeFridge({ files: req.files || [], source });
      // Only structured detections are stored. Photo buffers are not written to disk.
      const createScan = db.prepare("INSERT INTO scans(source, item_count) VALUES (?, ?)");
      const createItem = db.prepare(`INSERT INTO fridge_items
        (scan_id, name, quantity, unit, stock_status, confidence, confirmed)
        VALUES (?, ?, ?, ?, ?, ?, 0)`);
      const transaction = db.transaction(items => {
        const scan = createScan.run(source, items.length);
        for (const item of items) {
          const name = cleanName(item.name);
          if (!name) continue;
          createItem.run(scan.lastInsertRowid, name, Math.max(0, Number(item.quantity) || 0),
            cleanName(item.unit) || "item", validStock(item.stockStatus) ? item.stockStatus : "available",
            Math.min(1, Math.max(0, Number(item.confidence) || 0.5)));
        }
        return Number(scan.lastInsertRowid);
      });
      const scanId = transaction(result.items);
      const lowItems = db
  .prepare(`
    SELECT name, quantity, unit
    FROM fridge_items
    WHERE scan_id = ?
      AND stock_status IN ('low', 'empty')
  `)
  .all(scanId);

const insertGrocery = db.prepare(`
  INSERT INTO grocery_items (name, quantity, unit, source)
  VALUES (?, ?, ?, 'low-stock')
`);

const addLowStock = db.transaction(() => {
  for (const item of lowItems) {
    const existing = db.prepare(`
      SELECT id
      FROM grocery_items
      WHERE lower(name) = lower(?)
        AND checked = 0
    `).get(item.name);

    if (!existing) {
      insertGrocery.run(
        item.name,
        item.quantity > 0 ? item.quantity : 1,
        item.unit
      );
    }
  }
});

addLowStock();
      res.json({ scanId, mode: result.mode, notice: result.notice, items: getFridgeItems() });
    } catch (e) { next(e); }
  });
});

app.patch("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM fridge_items WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Fridge item not found." });
  const name = cleanName(req.body.name ?? existing.name);
  const quantity = Number(req.body.quantity ?? existing.quantity);
  const unit = cleanName(req.body.unit ?? existing.unit) || "item";
  const stockStatus = req.body.stockStatus ?? existing.stock_status;
  if (!name || !Number.isFinite(quantity) || quantity < 0 || !validStock(stockStatus))
    return res.status(400).json({ error: "Check the item name, quantity, and stock status." });
  db.prepare(`UPDATE fridge_items SET name=?, quantity=?, unit=?, stock_status=?, confirmed=1 WHERE id=?`)
    .run(name, quantity, unit, stockStatus, id);
  res.json({ item: db.prepare("SELECT * FROM fridge_items WHERE id=?").get(id) });
});

app.post("/api/items", (req, res) => {
  const name = cleanName(req.body.name);
  const quantity = Number(req.body.quantity ?? 1);
  const unit = cleanName(req.body.unit ?? "item") || "item";
  const stockStatus = req.body.stockStatus ?? "available";
  if (!name || !Number.isFinite(quantity) || quantity < 0 || !validStock(stockStatus))
    return res.status(400).json({ error: "Enter a valid name, quantity, and stock status." });
  const result = db.prepare(`INSERT INTO fridge_items(name, quantity, unit, stock_status, confirmed)
    VALUES (?, ?, ?, ?, 1)`).run(name, quantity, unit, stockStatus);
  res.status(201).json({ item: db.prepare("SELECT * FROM fridge_items WHERE id=?").get(result.lastInsertRowid) });
});

app.delete("/api/items/:id", (req, res) => {
  const result = db.prepare("DELETE FROM fridge_items WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Fridge item not found." });
  res.status(204).end();
});

app.get("/api/groceries", (_req, res) => {
  res.json({ items: db.prepare("SELECT * FROM grocery_items ORDER BY checked ASC, id DESC").all() });
});
app.post("/api/groceries", (req, res) => {
  const name = cleanName(req.body.name);
  const quantity = Number(req.body.quantity ?? 1);
  const unit = cleanName(req.body.unit ?? "item") || "item";
  if (!name || !Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: "Enter a valid grocery name and quantity." });
  const result = db.prepare("INSERT INTO grocery_items(name, quantity, unit, source) VALUES (?, ?, ?, ?)")
    .run(name, quantity, unit, cleanName(req.body.source ?? "manual") || "manual");
  res.status(201).json({ item: db.prepare("SELECT * FROM grocery_items WHERE id=?").get(result.lastInsertRowid) });
});
app.patch("/api/groceries/:id", (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare("SELECT * FROM grocery_items WHERE id=?").get(id);
  if (!old) return res.status(404).json({ error: "Grocery item not found." });
  const name = cleanName(req.body.name ?? old.name);
  const quantity = Number(req.body.quantity ?? old.quantity);
  const unit = cleanName(req.body.unit ?? old.unit) || "item";
  const checked = req.body.checked === undefined ? old.checked : (req.body.checked ? 1 : 0);
  if (!name || !Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: "Check the grocery name and quantity." });
  db.prepare("UPDATE grocery_items SET name=?, quantity=?, unit=?, checked=? WHERE id=?").run(name, quantity, unit, checked, id);
  res.json({ item: db.prepare("SELECT * FROM grocery_items WHERE id=?").get(id) });
});
app.delete("/api/groceries/:id", (req, res) => {
  const result = db.prepare("DELETE FROM grocery_items WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Grocery item not found." });
  res.status(204).end();
});
app.post("/api/groceries/from-low-stock", (_req, res) => {
  const low = db.prepare("SELECT name, quantity, unit FROM fridge_items WHERE stock_status IN ('low','empty')").all();
  const insert = db.prepare("INSERT INTO grocery_items(name, quantity, unit, source) VALUES (?, ?, ?, 'low-stock')");
  const added = [];
  const tx = db.transaction(() => {
    for (const item of low) {
      const exists = db.prepare("SELECT id FROM grocery_items WHERE lower(name)=lower(?) AND checked=0").get(item.name);
      if (!exists) {
        const result = insert.run(item.name, item.quantity > 0 ? item.quantity : 1, item.unit);
        added.push(db.prepare("SELECT * FROM grocery_items WHERE id=?").get(result.lastInsertRowid));
      }
    }
  });
  tx();
  res.json({ added, items: db.prepare("SELECT * FROM grocery_items ORDER BY checked ASC, id DESC").all() });
});
app.get("/api/recipes", (_req, res) => res.json({ recipes: matchRecipes(getFridgeItems()) }));

app.use((err, _req, res, _next) => {
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: err.message || "Something went wrong. Please try again." });
});
app.listen(port, () => console.log(`Fridge Scan API listening on http://localhost:${port}`));
