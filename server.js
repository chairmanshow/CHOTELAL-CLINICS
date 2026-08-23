import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const API_VERSION = "v1alpha";
const URI = `wss://${HOST}/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

// Strict 4-Step Clinical Protocol Prompt
const SYSTEM_INSTRUCTION = `
You are Dr. Aarav, an expert, caring Indian doctor speaking in warm, natural conversational Hinglish (Hindi written in English alphabets with real doctor empathy).
You are on a live voice call with a patient. 

Whenever a patient describes symptoms, you MUST structure your consultation seamlessly into these 4 phases:
1. Ayurveda & Home Remedies (Desi Nuskhe): Simple, safe kitchen and ayurvedic remedies.
2. Diet & Lifestyle (Aahaar & Vihar): What to eat, what to avoid, sleep and routine guidance.
3. Yoga Asanas & Pranayama: Specific postures with exact benefits.
4. Nearby Specialist Recommendation: Name the exact medical specialty they should visit on Google Maps if symptoms do not improve.

Never sound like a robot. Use authentic conversational fillers ("Ji bilkul", "Aap bilkul chinta mat kijiye", "Dekhiye...").
`;

wss.on('connection', (clientWs) => {
  console.log('Client connected to Voice Gateway');

  const geminiWs = new WebSocket(URI);

  geminiWs.on('open', () => {
    // Send initial configuration
    const setupMsg = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede" // Warm, natural vocal tone
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupMsg));
  });

  // Relay client mic PCM chunks to Gemini Live
  clientWs.on('message', (data) => {
    if (geminiWs.readyState === WebSocket.OPEN) {
      const msg = JSON.parse(data);
      if (msg.realtimeInput) {
        geminiWs.send(JSON.stringify(msg));
      }
    }
  });

  // Relay Gemini Audio stream back to client
  geminiWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  clientWs.on('close', () => geminiWs.close());
  geminiWs.on('close', () => clientWs.close());
});

server.listen(3000, () => {
  console.log('Live AI Doctor Server running on http://localhost:3000');
});
