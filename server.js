import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const publicDirectory = path.join(__dirname, "public");
const videosDirectory = path.join(publicDirectory, "videos");
const pagesDirectory = path.join(publicDirectory, "pages");
const dataDirectory = path.join(__dirname, "data");
const databaseFile = path.join(dataDirectory, "videos.json");

await fs.mkdir(videosDirectory, { recursive: true });
await fs.mkdir(pagesDirectory, { recursive: true });
await fs.mkdir(dataDirectory, { recursive: true });

try {
    await fs.access(databaseFile);
} catch {
    await fs.writeFile(databaseFile, "[]", "utf8");
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

const upload = multer({
    dest: videosDirectory,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (request, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();

        if (extension !== ".swf") {
            return callback(new Error("Разрешены только SWF-файлы"));
        }

        callback(null, true);
    }
});

app.use(express.static(publicDirectory));

app.post("/upload", upload.single("swf"), async (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).send("Файл не загружен");
        }

        const title = String(request.body.title || "").trim();
        const description = String(request.body.description || "").trim();

        if (!title) {
            return response.status(400).send("Укажите название ролика");
        }

        const id = crypto.randomUUID();
        const fileName = `${id}.swf`;
        const finalFilePath = path.join(videosDirectory, fileName);

        await fs.rename(request.file.path, finalFilePath);

        const video = {
            id,
            title,
            description,
            file: `/videos/${fileName}`,
            page: `/pages/${id}.html`,
            createdAt: new Date().toISOString()
        };

        const databaseText = await fs.readFile(databaseFile, "utf8");
        const videos = JSON.parse(databaseText);

        videos.push(video);

        await fs.writeFile(
            databaseFile,
            JSON.stringify(videos, null, 2),
            "utf8"
        );

        const pageHtml = `<!doctype html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            max-width: 1000px;
            margin: 40px auto;
            padding: 0 20px;
            font-family: sans-serif;
        }

        ruffle-player {
            display: block;
            width: 100%;
            max-width: 900px;
            aspect-ratio: 4 / 3;
        }
    </style>
</head>
<body>
    <a href="/">← На главную</a>

    <h1>${escapeHtml(title)}</h1>

    <p>${escapeHtml(description)}</p>

    <ruffle-player id="player"></ruffle-player>

    <script src="https://unpkg.com/@ruffle-rs/ruffle"></script>
    <script>
        const player = document.querySelector("#player");
        player.load(${JSON.stringify(video.file)});
    </script>
</body>
</html>`;

        const pageFile = path.join(pagesDirectory, `${id}.html`);

        await fs.writeFile(pageFile, pageHtml, "utf8");

        response.send(`
            <h1>Ролик опубликован</h1>
            <p>
                <a href="${video.page}">Открыть страницу ролика</a>
            </p>
        `);
    } catch (error) {
        console.error(error);
        response.status(500).send("Ошибка при загрузке ролика");
    }
});

app.use((error, request, response, next) => {
        if (error instanceof multer.MulterError) {
        return response.status(400).send("Файл слишком большой или некорректный");
    }

    response.status(400).send(error.message || "Ошибка загрузки");
});

app.listen(PORT, () => {
    console.log(`Сайт запущен: http://localhost:${PORT}`);
});

