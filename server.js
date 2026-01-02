import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = 3000;

/* ---------- dirname ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- middleware ---------- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- clients ---------- */
const eleven = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

/* ---------- root ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =====================================================
   SCRIPT GENERATION (FIXED STRUCTURE)
   ===================================================== */
app.post('/generate-script', async (req, res) => {
  const { businessName, service, targetAudience } = req.body;

  try {
    const prompt = `
Generate a 30-second Marathi audio advertisement script.

MANDATORY RULES:
- FOLLOW THIS EXACT STRUCTURE
- Use emotion cues ONLY in SQUARE BRACKETS
- Emotion cues must be in ENGLISH
- Do NOT use emojis
- Do NOT change the order
- Simple, spoken Marathi
- Suitable for audio / radio ads

STRUCTURE (DO NOT CHANGE):
[soft, emotional]
2 lines showing emotional problem

[hopeful]
1 reassuring transition line

[happy, energetic]
Introduce the solution and how it works (2–3 lines)

[confident]
Benefits and results (1–2 lines)

[strong, energetic]
Clear call to action (1–2 lines)

Business Name: ${businessName}
Service / App Purpose: ${service}
Target Audience: ${targetAudience}
`;

    const result = await gemini.generateContent(prompt);
    const script = result.response.text();

    if (script && script.trim()) {
      return res.json({ script: script.trim() });
    }

    throw new Error('Empty Gemini response');

  } catch (err) {
    console.warn('⚠️ Gemini failed, using structured fallback');

    /* ---------- GUARANTEED STRUCTURED FALLBACK ---------- */
    const fallback = `
[soft, emotional]
व्यवसाय वाढवायचा आहे…
पण दररोज आकर्षक पोस्ट बनवायला वेळच मिळत नाही?

[hopeful]
पण आता ही चिंता मागे ठेवा…

[happy, energetic]
आता काळजी सोडा!
${businessName} सोबत ${service} झाले अगदी सोपे.
नाव, फोटो आणि माहिती टाका —
आणि तयार सुंदर पोस्ट, एका क्लिकमध्ये!

[confident]
तुमचा ब्रँड दिसेल प्रोफेशनल
आणि ग्राहकही होतील अधिक आकर्षित!

[strong, energetic]
आजच डाउनलोड करा ${businessName}
आणि तुमच्या व्यवसायाला द्या नवी दिशा!
`;

    return res.json({ script: fallback.trim() });
  }
});

/* =====================================================
   ELEVENLABS TEXT-TO-SPEECH
   ===================================================== */
app.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const audioStream = await eleven.textToSpeech.convert(
      'AtX6p0vItOfWBULsG7XF', // example voice id
      {
        text,
        modelId: 'eleven_v3',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75
        }
      }
    );

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ ElevenLabs Error:', error);
    res.status(500).json({ error: 'Voice generation failed' });
  }
});

/* ---------- start ---------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
