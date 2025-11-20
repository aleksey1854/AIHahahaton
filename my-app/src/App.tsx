import { useState } from "react";
import "./App.css";

type UploadedFile = {
  file: File;
};

type TranslationHistory = {
  id: string;
  fileName: string;
  text: string;
  translation: string;
  timestamp: Date;
};

function HomePage() {
  const [currentPage, setCurrentPage] = useState<"home" | "history">("home");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [manualText, setManualText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [history, setHistory] = useState<TranslationHistory[]>([]);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [translations, setTranslations] = useState<{ kk: string; ru: string; en: string }>({
    kk: "",
    ru: "",
    en: "",
  });

  // Интеграция с Google Cloud Translation API
  // Требует VITE_GOOGLE_TRANSLATE_KEY (API key) в .env
  async function translateToLanguages(text: string) {
    if (!text) return { kk: "", ru: "", en: "" };

    const apiKey = (import.meta.env as any).VITE_GOOGLE_TRANSLATE_KEY || "";

    // Вспомогательная локальная заглушка
    const localFallback = async () => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        kk: `${text} (қазақша — пример перевода)`,
        ru: text,
        en:
          "Example of translated text into English. In the real system this will be the translation of the text you entered or that was extracted from the file.",
      };
    };

    // Если ключ не установлен, используем заглушку
    if (!apiKey) {
      console.warn("Google Cloud Translation API key not configured (VITE_GOOGLE_TRANSLATE_KEY)");
      return await localFallback();
    }

    try {
      // Google Translate API v2 REST endpoint
      // ВАЖНО: требует включённого биллинга в Google Cloud Console!
      const googleApiUrl = "https://translation.googleapis.com/language/translate/v2";
      
      // Отправляем отдельный запрос для каждого языка
      // (Google Translate v2 возвращает одноязычный результат за раз)
      const translationPromises = [
        // Translate to Kazakh (kk)
        fetch(`${googleApiUrl}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: text,
            target: "kk",
          }),
        }).then((res) => res.json()),
        // Translate to Russian (ru)
        fetch(`${googleApiUrl}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: text,
            target: "ru",
          }),
        }).then((res) => res.json()),
        // Translate to English (en) — на случай если входной текст не на английском
        fetch(`${googleApiUrl}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: text,
            target: "en",
          }),
        }).then((res) => res.json()),
      ];

      const [kkRes, ruRes, enRes] = await Promise.all(translationPromises);

      // Парсим ответы Google Translate API v2
      // Ожидаемый формат: { data: { translations: [{ translatedText: '...' }] } }
      const extractTranslation = (response: any) => {
        if (response.data?.translations?.[0]?.translatedText) {
          return response.data.translations[0].translatedText;
        }
        if (response.error) {
          const errMsg = response.error?.message || JSON.stringify(response.error);
          console.error("Google Translate API error:", errMsg);
          
          // Если 403 PERMISSION_DENIED — скорее всего не включено биллинг
          if (response.error?.code === 403) {
            console.error(
              "⚠️ Ошибка доступа! Убедитесь, что:",
              "1. Биллинг включен в Google Cloud Console",
              "2. Cloud Translation API включена",
              "3. API ключ верный"
            );
          }
        }
        return "";
      };

      return {
        kk: extractTranslation(kkRes) || "",
        ru: extractTranslation(ruRes) || "",
        en: extractTranslation(enRes) || "",
      };
    } catch (err: any) {
      console.error("Google Translate API failed:", err);
      // при ошибке возвращаем пометку об ошибке
      return {
        kk: `Ошибка: ${err?.message || err}`,
        ru: `Ошибка: ${err?.message || err}`,
        en: `Error: ${err?.message || err}`,
      };
    }
  }

  const metrics = [
    { label: "Точность", value: "99.9%" },
    { label: "Скорость", value: "<2s" },
    { label: "Языка", value: "3" },
  ];

  const features = [
    {
      id: "stt",
      title: "Speech to Text",
      description:
        "Преобразует аудиофайлы в текст с высокой точностью",
      details:
        "Поддерживает MP3, WAV и другие аудиоформаты. Использует передовые модели распознавания речи для точного преобразования звука в текст.",
    },
    {
      id: "itt",
      title: "Image to Text",
      description:
        "Извлекает текст из изображений и документов",
      details:
        "Работает с JPG, PNG, PDF и другими форматами. Идеально подходит для оцифровки документов и извлечения текста из скриншотов.",
    },
    {
      id: "tts",
      title: "Text to Speech",
      description: "Преобразует текст в естественную речь",
      details:
        "Поддерживает множество языков и голосов. Создает реалистичное аудио с правильной интонацией и ударением.",
    },
  ];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;

    if (!selected) {
      setFile(null);
    } else {
      setFile({ file: selected });
    }

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

      setManualText(data.text);
      // Автоматически формируем (заглушечные) переводы после извлечения текста
      const generated = await translateToLanguages(data.text);
      setTranslations(generated);
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

    await new Promise((r) => setTimeout(r, 700));

    const mockTranslation =
      "Example of translated text into English. In the real system this will be the translation of the text you entered or that was extracted from the file.";

    setTranslatedText(mockTranslation);

    // Формируем переводы (заглушка) для всех трёх языков
    const generated = await translateToLanguages(manualText || mockTranslation);
    setTranslations(generated);

    // Добавляем в историю
    const newEntry: TranslationHistory = {
      id: Date.now().toString(),
      fileName: file?.file.name || "Текст",
      text: manualText,
      translation: mockTranslation,
      timestamp: new Date(),
    };

    setHistory([newEntry, ...history]);
    setLoadingTranslate(false);
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">AUDAR</div>
          <div className="nav-links">
            <button
              className={`nav-link ${currentPage === "home" ? "active" : ""}`}
              onClick={() => setCurrentPage("home")}
            >
              Главная
            </button>
            <button
              className={`nav-link ${currentPage === "history" ? "active" : ""}`}
              onClick={() => setCurrentPage("history")}
            >
              История
            </button>
          </div>
        </div>
      </nav>

      {currentPage === "home" ? (
        <>
          {/* Hero Section */}
          <div className="hero">
            <h1 className="hero-title">
              AI Переводчик
              <br />
              <span className="gradient-text">НОВОГО ПОКОЛЕНИЯ</span>
            </h1>

            {/* Metrics */}
            <div className="metrics">
              {metrics.map((metric, idx) => (
                <div key={idx} className="metric-card">
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-label">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Section */}
          <div className="upload-section">
            <div className="upload-card">
              <div className="upload-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <h2 className="upload-title">Выберите файл для загрузки</h2>

              <p className="upload-description">
                Поддерживаемые форматы: MP3, WAV, JPG, PNG, PDF и другие
              </p>

              <label className="file-input-label">
                <input
                  type="file"
                  accept=".mp4,.webm,.mp3,.wav,.jpg,.jpeg,.png,.pdf,.txt"
                  onChange={handleChange}
                  className="file-input"
                />
                <span className="upload-button">Выбрать файл</span>
              </label>

              {file && (
                <div className="file-info">
                  <p>
                    <strong>✓ Выбран:</strong> {file.file.name}
                  </p>
                  <p className="file-size">
                    {Math.round(file.file.size / 1024)} КБ
                  </p>
                  <button
                    className="extract-button"
                    onClick={handleExtract}
                    disabled={loadingExtract}
                  >
                    {loadingExtract ? "Анализируем..." : "Проанализировать"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Manual Text Input */}
          <div className="text-section">
            <div className="text-container">
              <h3 className="section-title">Текст для обработки</h3>
              <p className="section-subtitle">
                Вставьте свой текст или используйте извлеченный из файла
              </p>

              <textarea
                className="text-input"
                rows={6}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Напишите или вставьте текст на русском..."
              />

              <button
                className="translate-button"
                onClick={handleTranslate}
                disabled={loadingTranslate || !manualText.trim()}
              >
                {loadingTranslate ? "Переводим..." : "Перевести"}
              </button>

              {/* Переводы на три языка */}
              <div className="translations">
                <div className="translation-card">
                  <div className="translation-lang">Қазақша</div>
                  <div className="translation-text">
                    {translations.kk || "Здесь появится перевод на казахский"}
                  </div>
                  <button
                    className="copy-inline"
                    onClick={() => navigator.clipboard?.writeText(translations.kk || "")}
                    disabled={!translations.kk}
                  >
                    Копировать
                  </button>
                </div>

                <div className="translation-card">
                  <div className="translation-lang">Русский</div>
                  <div className="translation-text">
                    {translations.ru || "Здесь появится перевод на русский"}
                  </div>
                  <button
                    className="copy-inline"
                    onClick={() => navigator.clipboard?.writeText(translations.ru || "")}
                    disabled={!translations.ru}
                  >
                    Копировать
                  </button>
                </div>

                <div className="translation-card">
                  <div className="translation-lang">English</div>
                  <div className="translation-text">
                    {translations.en || "The translation in English will appear here"}
                  </div>
                  <button
                    className="copy-inline"
                    onClick={() => navigator.clipboard?.writeText(translations.en || "")}
                    disabled={!translations.en}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Translation Result */}
          {translatedText && (
            <div className="result-section">
              <div className="result-container">
                <h3 className="section-title">Результат перевода</h3>
                <div className="result-box">
                  <p>{translatedText}</p>
                </div>
                <button className="copy-button">📋 Копировать</button>
              </div>
            </div>
          )}

          {/* Features Section */}
          <div className="features-section">
            <h2 className="features-title">Возможности AI</h2>

            {/* Feature Cards */}
            <div className="feature-cards">
              {features.map((feature) => (
                <div key={feature.id} className="feature-card">
                  <div className="feature-icon">
                    {feature.id === "stt" && "🎙️"}
                    {feature.id === "itt" && "📷"}
                    {feature.id === "tts" && "🔊"}
                  </div>
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Accordion */}
            <div className="accordion">
              <h3 className="accordion-title">Подробная информация</h3>
              {features.map((feature) => (
                <div key={feature.id} className="accordion-item">
                  <button
                    className="accordion-header"
                    onClick={() =>
                      setExpandedFeature(
                        expandedFeature === feature.id ? null : feature.id
                      )
                    }
                  >
                    <span>{feature.title}</span>
                    <span
                      className={`accordion-icon ${expandedFeature === feature.id ? "open" : ""}`}
                    >
                      ▼
                    </span>
                  </button>
                  {expandedFeature === feature.id && (
                    <div className="accordion-content">{feature.details}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* History Page */
        <div className="history-section">
          <h2 className="history-title">История переводов</h2>

          <div className="history-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск в истории..."
            />
            <select className="filter-select">
              <option value="">Все типы</option>
              <option value="stt">Аудио</option>
              <option value="itt">Изображение</option>
              <option value="text">Текст</option>
            </select>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>История переводов пуста</h3>
              <p>Начните перевод файла или текста, чтобы сохранить его здесь</p>
              <button
                className="empty-cta"
                onClick={() => setCurrentPage("home")}
              >
                Начать перевод
              </button>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-content">
                    <p className="history-filename">{item.fileName}</p>
                    <p className="history-text">{item.text.substring(0, 100)}...</p>
                  </div>
                  <p className="history-time">
                    {item.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;
