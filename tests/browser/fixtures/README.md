These three recordings are synthetic English speech generated with Windows System.Speech at 16 kHz, mono, PCM16. They contain no customer or merchant recordings. `rice.wav` is the Chromium fake-microphone input. `onion.wav` exercises file decoding and VAD. `welcome.wav` is the controlled TTS response.

- rice: “One kilogram of rice. Add two packets of milk. Please read the total.”
- onion: “Two kilograms of onions and one litre of oil.”
- welcome: “Welcome to Kirana. Your shop, your language, your pace.”

The controlled test provider returns a fixed transcript. These fixtures verify the browser audio path, not real ASR accuracy or Indian-language pronunciation. Live Hindi, Tamil and English golden comparisons remain a provider-credentials acceptance check.
