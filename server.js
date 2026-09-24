import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(
  express.json({
    limit: "15mb",
  })
);

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ==========================================
// TEST
// ==========================================

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "VISIONGLISH + SOZTAP AI server is running",
    endpoints: {
      english: "/api/discover",
      kazakh: "/api/discover-kz",
    },
  });
});

// ==========================================
// HELPER
// ==========================================

function getBase64Image(image) {
  return image.includes(",") ? image.split(",")[1] : image;
}

function cleanAIResponse(text) {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

// ==========================================
// VISIONGLISH — ENGLISH
// ==========================================

app.post("/api/discover", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "Image is required.",
      });
    }

    const base64Image = getBase64Image(image);

    const prompt = `
You are the AI Vision system of an English learning platform
for 6th-grade students.

A student is deliberately holding ONE object close to the camera.

Your task:

1. Identify the main object the student is intentionally showing.
2. Ignore the student's face, hands, walls, furniture and background objects.
3. Give the most common simple English name for the object.
4. Give a short beginner-friendly English definition.
5. Give one simple example sentence using the word.
6. Give one short question about the object for an English learner.
7. Estimate your confidence from 0 to 100.

Important rules:

- Focus on the object closest to the camera.
- Use vocabulary appropriate for a 6th-grade English learner.
- Prefer a simple everyday word.
- Do NOT identify or describe any person.
- If no clear object is being shown, set "recognized" to false.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not add text outside JSON.

Return exactly this structure:

{
  "recognized": true,
  "object": "pen",
  "article": "a",
  "definition": "A tool used for writing.",
  "example": "I write with a pen.",
  "question": "What color is your pen?",
  "confidence": 96
}
`;

    console.log("VISIONGLISH: Analyzing camera image...");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    const text = response.text?.trim();

    console.log("VISIONGLISH Gemini response:", text);

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const cleanedText = cleanAIResponse(text);

    let result;

    try {
      result = JSON.parse(cleanedText);
    } catch {
      console.error("Invalid English JSON:", cleanedText);

      return res.status(500).json({
        success: false,
        error: "AI returned an invalid response.",
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("VISIONGLISH ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "AI Vision could not analyze the image.",
    });
  }
});

// ==========================================
// SÖZTAP — ҚАЗАҚ ТІЛІ
// ==========================================

app.post("/api/discover-kz", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "Сурет жіберілмеді.",
      });
    }

    const base64Image = getBase64Image(image);

    const prompt = `
Сен қазақ тілін үйретуге арналған SÖZTAP білім беру
платформасының AI Vision жүйесісің.

Платформаны 5–7-сынып оқушылары қолданады.

Оқушы камераға әдейі БІР нақты затты көрсетіп тұр.

Сенің міндетің:

1. Камераға әдейі көрсетілген негізгі затты анықта.
2. Оқушының қолын, бетін, қабырғаны және фондағы басқа
   заттарды елеме.
3. Заттың әдеби нормаға сай ең кең таралған ҚАЗАҚША атауын бер.
4. Заттың мағынасын қазақ тілінде қысқа әрі түсінікті түсіндір.
5. Сол сөзді қолданып бір қарапайым қазақша сөйлем құрастыр.
6. Сөздің сөз табын анықта.
7. Сөзге қойылатын сұрақты анықта.
8. Сөзді буынға дұрыс бөл.
9. Буын санын анықта.
10. Әріп санын анықта.
11. Дыбыс санын анықта.
12. Сөздің көпше түрін бер.
13. Оқушыға сол зат туралы бір қарапайым сұрақ құрастыр.
14. Затты тану сенімділігін 0-ден 100-ге дейін бағала.
15. Затты мына төрт санаттың біріне жатқыз:
    "home", "school", "outdoor", "play".

МАҢЫЗДЫ ЕРЕЖЕЛЕР:

- Камераға ең жақын және әдейі көрсетілген затқа назар аудар.
- Бір ғана негізгі затты анықта.
- Зат атауын міндетті түрде қазақ тілінде бер.
- Қазақ тілінің әдеби нормасын сақта.
- Орысша немесе ағылшынша атауды қолданба.
- Мүмкіндігінше қалыптасқан қазақша баламаны таңда.
- Сөзді негізгі сөздік тұлғасында бер.
- Адамды анықтама және сипаттама.
- Егер зат анық көрінбесе, "recognized": false деп қайтар.
- "syllables" өрісінде буындарды "-" таңбасымен бөл.
- letterCount, soundCount және syllableCount бүтін сан болуы керек.
- Тек жарамды JSON қайтар.
- Markdown қолданба.
- JSON-нан тыс ешқандай мәтін жазба.

Дәл мына құрылымда жауап бер:

{
  "recognized": true,
  "object": "қалам",
  "definition": "Жазуға арналған құрал.",
  "example": "Мен көк қаламмен жаздым.",
  "partOfSpeech": "зат есім",
  "questionWord": "не?",
  "syllables": "қа-лам",
  "syllableCount": 2,
  "letterCount": 5,
  "soundCount": 5,
  "plural": "қаламдар",
  "question": "Сенің қаламың қандай түсті?",
  "category": "school",
  "confidence": 96
}

Егер зат анық танылмаса:

{
  "recognized": false,
  "object": "",
  "definition": "",
  "example": "",
  "partOfSpeech": "",
  "questionWord": "",
  "syllables": "",
  "syllableCount": 0,
  "letterCount": 0,
  "soundCount": 0,
  "plural": "",
  "question": "",
  "category": "",
  "confidence": 0
}
`;

    console.log("SOZTAP: Камерадағы зат талдануда...");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    const text = response.text?.trim();

    console.log("SOZTAP Gemini response:", text);

    if (!text) {
      throw new Error("Gemini бос жауап қайтарды.");
    }

    const cleanedText = cleanAIResponse(text);

    let result;

    try {
      result = JSON.parse(cleanedText);
    } catch {
      console.error("Invalid Kazakh JSON:", cleanedText);

      return res.status(500).json({
        success: false,
        error: "AI жауабын өңдеу мүмкін болмады.",
      });
    }

    if (typeof result.recognized !== "boolean") {
      result.recognized = Boolean(result.object);
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("SOZTAP ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Жасанды интеллект камерадағы затты талдай алмады.",
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log(" VISIONGLISH + SOZTAP AI SERVER");
  console.log(` http://localhost:${PORT}`);
  console.log("");
  console.log(" EN: /api/discover");
  console.log(" KZ: /api/discover-kz");
  console.log("========================================");
  console.log("");
});