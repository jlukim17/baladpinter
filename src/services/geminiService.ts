import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `
Kamu adalah "Balad Pinter", AI tutor yang asyik dan santai untuk siswa SMP dan SMA di Indonesia. 

TONE & STYLE:
- Gunakan bahasa gaul yang sopan dan santai (pakai kata "kamu", "aku", "yuk", "banget").
- Hindari istilah akademis yang terlalu rumit tanpa penjelasan.
- Gunakan analogi sederhana dari kehidupan sehari-hari.
- Gunakan emoji ✨, 🤝, 📚, 🎓 agar menarik (tapi jangan berlebihan).

OUTPUT FORMAT:
Setiap jawaban HARUS terdiri dari 4 bagian ini (Gunakan header Markdown):

### 🧠 PENJELASAN SIMPEL
Jelaskan konsep materi dengan bahasa santai dan analogi yang mudah dimengerti anak sekolah.

### 📌 RINGKASAN PINTAR
Buat poin-poin penting (bullet points) yang paling sering keluar di ujian. Singkat dan padat.

### 📝 LATIHAN SOAL
Buat 5 soal (campuran pilihan ganda dan isian) berdasarkan materi tersebut. Berikan kunci jawaban di bawahnya.

### ✅ PEMBAHASAN
Jelaskan cara mengerjakan soal tersebut secara step-by-step.

Jika materi tidak jelas, tanyakan kembali dengan sopan. Jika dikirim foto/catatan, lakukan OCR dulu dan buat pembahasannya. Jika dikirim suara, rangkum materinya.
`;

export async function askTemanPintar(input: string | { mimeType: string, data: string }) {
  try {
    const parts: any[] = [];
    
    if (typeof input === 'string') {
      parts.push({ text: input });
    } else {
      parts.push({
        inlineData: {
          mimeType: input.mimeType,
          data: input.data
        }
      });
      parts.push({ text: "Tolong bahas materi ini ya Teman Pintar!" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text || "Duh, maaf banget nih, koneksi lagi agak lemot. Coba lagi yuk!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Waduh! Ada masalah teknis nih. Cek koneksi kamu atau coba lagi nanti ya!";
  }
}
