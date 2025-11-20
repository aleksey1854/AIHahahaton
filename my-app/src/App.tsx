import { useState } from "react";

type UploadedFile = {
  file: File;
};

function FileUpload() {
  const [file, setFile] = useState<UploadedFile | null>(null);

  // основной текст, с которым работаем: либо свой, либо из файла
  const [manualText, setManualText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");

  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;

    if (!selected) {
      setFile(null);
    } else {
      setFile({ file: selected });
    }

    // при смене файла чистим результаты перевода,
    // но текст не трогаем, вдруг человек хочет сравнить/скопировать
    setTranslatedText("");
  }

  async function handleExtract() {
    if (!file) return;

    setLoadingExtract(true);
    setTranslatedText("");

    try {
      const formData = new FormData();
      formData.append("file", file.file);

      const res = await fetch("http://127.0.0.1:8000/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Ошибка при запросе к /stt");
      }

      const data: { fileName: string; source: string; text: string } =
        await res.json();

      // текст, который вернули Whisper/EasyOCR
      setManualText(data.text);
    } catch (err) {
      console.error(err);
      alert("Не удалось обработать файл");
    } finally {
      setLoadingExtract(false);
    }
  }

  async function handleTranslate() {
    if (!manualText.trim()) return;

    setLoadingTranslate(true);

    // ─── ЗАГЛУШКА: имитация перевода на английский ───
    await new Promise((r) => setTimeout(r, 700));

    const mockTranslation =
      "Example of translated text into English. In the real system this will be the translation of the text you entered or that was extracted from the file.";

    setTranslatedText(mockTranslation);
    setLoadingTranslate(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>
      <h2>Загрузка медиа-файла</h2>

      <input
        type="file"
        accept=".mp4,.webm,.mp3,.jpg,.jpeg,.png,.txt"
        onChange={handleChange}
      />

      {file && (
        <div style={{ marginTop: 8 }}>
          <p>
            Выбран файл: {file.file.name} ({file.file.type || "unknown"},{" "}
            {Math.round(file.file.size / 1024)} КБ)
          </p>
          <button onClick={handleExtract} disabled={loadingExtract}>
            {loadingExtract ? "Анализируем файл..." : "Проанализировать файл"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3>Текст для обработки и перевода</h3>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Можно просто вписать свой текст на русском или дождаться, пока мы
          вытащим текст из загруженного файла, а затем отредактировать его
          вручную и при необходимости перевести.
        </p>
        <textarea
          rows={6}
          style={{ width: "100%", resize: "vertical" }}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Напиши или вставь сюда текст на русском, который нужно обработать и перевести на английский..."
        />
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleTranslate}
          disabled={loadingTranslate || !manualText.trim()}
        >
          {loadingTranslate ? "Переводим..." : "Перевести на английский"}
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Перевод на английский</h3>
        {translatedText ? (
          <p style={{ whiteSpace: "pre-wrap", background: "#111", padding: 8 }}>
            {translatedText}
          </p>
        ) : (
          <p style={{ fontStyle: "italic" }}>
            Здесь появится переведённый текст.
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <div>
      <h1 style={{ textAlign: "center", marginTop: 16 }}>
        AI-Translate — прототип
      </h1>
      <p style={{ textAlign: "center" }}>
        Загрузите медиа-файл или просто вставьте текст – мы поможем его
        обработать и перевести.
      </p>

      <FileUpload />
    </div>
  );
}

export default App;
