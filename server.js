const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const DATABASE_FILE = path.join(DATA_DIR, "games.json");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DATABASE_FILE)) {
  fs.writeFileSync(DATABASE_FILE, "[]");
}

app.use(cors({
  origin: "*"
}));

app.use(express.json());

app.use("/uploads", express.static(UPLOADS_DIR));

function readGames() {
  try {
    return JSON.parse(fs.readFileSync(DATABASE_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveGames(games) {
  fs.writeFileSync(
    DATABASE_FILE,
    JSON.stringify(games, null, 2)
  );
}

function cleanFileName(name) {
  return name
    .replace(/[^a-zA-Zа-яА-Я0-9._-]/g, "_")
    .slice(0, 100);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const originalName = cleanFileName(file.originalname);
    cb(null, `${id}-${originalName}`);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".swf") {
      return cb(new Error("Разрешены только SWF-файлы"));
    }

    cb(null, true);
  }
});

// Проверка работы сервера
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "SWF server is running"
  });
});

// Получить список роликов
app.get("/api/games", (req, res) => {
  const games = readGames();

  const result = games.map((game) => ({
    ...game,
    fileUrl: `${BASE_URL}/uploads/${game.fileName}`,
    pageUrl: `${BASE_URL}/games/${game.id}`
  }));

  res.json(result);
});

// Получить один ролик
app.get("/api/games/:id", (req, res) => {
  const games = readGames();
  const game = games.find((item) => item.id === req.params.id);

  if (!game) {
    return res.status(404).json({
      error: "Ролик не найден"
    });
  }

  res.json({
    ...game,
    fileUrl: `${BASE_URL}/uploads/${game.fileName}`,
    pageUrl: `${BASE_URL}/games/${game.id}`
  });
});

// Загрузить новый ролик
app.post("/api/games", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Файл не был загружен"
    });
  }

  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();

  if (!title) {
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      error: "Название обязательно"
    });
  }

  const games = readGames();

  const game = {
    id: crypto.randomUUID(),
    title: title.slice(0, 100),
    description: description.slice(0, 1000),
    fileName: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    createdAt: new Date().toISOString()
  };

  games.push(game);
  saveGames(games);

  res.status(201).json({
    message: "Ролик загружен",
    game: {
      ...game,
      fileUrl: `${BASE_URL}/uploads/${game.fileName}`,
      pageUrl: `${BASE_URL}/games/${game.id}`
    }
  });
});

// Удалить ролик
app.delete("/api/games/:id", (req, res) => {
  const games = readGames();
  const index = games.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: "Ролик не найден"
    });
  }

  const game = games[index];
  const filePath = path.join(UPLOADS_DIR, game.fileName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  games.splice(index, 1);
  saveGames(games);

  res.json({
    message: "Ролик удалён"
  });
});

// Обработка ошибок загрузки
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Файл слишком большой. Максимальный размер — 100 МБ"
      });
    }

    return res.status(400).json({
      error: error.message
    });
  }

  res.status(400).json({
    error: error.message || "Ошибка сервера"
  });
});

app.listen(PORT, () => {
  console.log(`Server started: ${BASE_URL}`);
});
