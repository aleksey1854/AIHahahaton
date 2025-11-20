from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import whisper
import easyocr
import tempfile
import shutil
import mimetypes
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модель Whisper грузим один раз
model = whisper.load_model("base")

# OCR для картинок (рус + англ)
ocr_reader = easyocr.Reader(["ru", "en"], gpu=False)


@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    # пробуем понять тип файла
    mime, _ = mimetypes.guess_type(file.filename)
    content_type = file.content_type or mime or ""  # "image/png", "text/plain", ...
    ext = Path(file.filename).suffix.lower()

    # ───── ВАРИАНТ 1: текстовый файл (.txt и прочие text/*) ─────
    if content_type.startswith("text/") or ext == ".txt":
        raw_bytes = await file.read()

        # пробуем UTF-8, если нет — fallback на cp1251 (часто для русского)
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = raw_bytes.decode("cp1251", errors="ignore")

        return {
            "fileName": file.filename,
            "source": "text",
            "text": text,
            # для единообразия можно явно указать язык, но тут мы его не детектим
            "detectedLanguage": None,
        }

    # ───── ВАРИАНТ 2: картинка / аудио / видео ─────
    suffix = Path(file.filename).suffix or ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    text = ""
    source = ""
    detected_language = None

    # если картинка → EasyOCR
    if content_type.startswith("image/"):
        result = ocr_reader.readtext(tmp_path, detail=0)  # только текст
        text = "\n".join(result)
        source = "image"
        # EasyOCR не даёт явный код языка, оставим None
    else:
        # всё остальное считаем аудио/видео → Whisper
        # ВАЖНО: НЕ указываем language="ru", даём Whisper сам определить язык
        result = model.transcribe(tmp_path)  # автоопределение языка
        text = result["text"]
        detected_language = result.get("language")
        source = "audio_or_video"

    return {
        "fileName": file.filename,
        "source": source,
        "text": text,
        "detectedLanguage": detected_language,
    }