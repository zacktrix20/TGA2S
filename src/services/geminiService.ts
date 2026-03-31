import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const getAgriculturalAdvice = async (query: string, imageBase64?: string, mimeType?: string) => {
  try {
    const parts: any[] = [{ text: query }];
    
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: `Wewe ni mtaalamu wa kilimo nchini Tanzania (Tanzania Agricultural Expert). 
        Jibu maswali ya wakulima kwa Kiswahili fasaha. 
        Ikiwa mkulima ametoa picha ya mmea, chagua ugonjwa au tatizo linaloonekana na utoe ushauri wa tiba na udhibiti.
        Toa ushauri wa kitaalamu kuhusu kilimo bora, udhibiti wa wadudu, na matumizi ya mbolea kulingana na mazingira ya Tanzania.
        Kuwa mtaalamu, mwenye kutia moyo, na utumie lugha rahisi kueleweka na mkulima wa kawaida.`,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Samahani, nimepata tatizo kidogo katika kuchakata ombi lako. Tafadhali jaribu tena baadae.";
  }
};

export const getSpeechFromText = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Soma ujumbe huu kwa sauti ya upole na ya kitaalamu ya Kiswahili: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};
