import os
import re
import json
from datetime import datetime
from config.settings import WHISPER_MODEL, VOICE_NOTES_FILE


class VoiceTranscriber:
    """Transcribe WeChat voice notes using local faster-whisper."""

    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        """Load the Whisper model (downloads on first run)."""
        try:
            from faster_whisper import WhisperModel
            print(f"[Whisper] Loading {WHISPER_MODEL} model (first run downloads ~460MB)...")
            self.model = WhisperModel(
                WHISPER_MODEL,
                device="cpu",
                compute_type="int8"
            )
            print(f"[Whisper] Model loaded successfully")
        except ImportError:
            print("[Whisper] faster-whisper not installed. Voice transcription disabled.")
            print("[Whisper] Install with: pip install faster-whisper")
        except Exception as e:
            print(f"[Whisper] Failed to load model: {e}")

    def transcribe(self, audio_path: str) -> dict | None:
        """
        Transcribe an audio file and extract contact name if mentioned.

        Returns dict with keys: transcript, contact_name, timestamp, audio_path
        """
        if not self.model:
            print("[Whisper] Model not loaded, skipping transcription")
            return None

        if not os.path.exists(audio_path):
            print(f"[Whisper] Audio file not found: {audio_path}")
            return None

        try:
            segments, info = self.model.transcribe(
                audio_path,
                beam_size=5,
                language=None,  # auto-detect (handles Chinese + English)
                vad_filter=True
            )
            transcript = " ".join(segment.text.strip() for segment in segments)

            if not transcript:
                return None

            contact_name = self._extract_contact_name(transcript)

            result = {
                "transcript": transcript,
                "contact_name": contact_name,
                "timestamp": datetime.now().isoformat(),
                "audio_path": audio_path,
                "language": info.language,
                "duration_seconds": round(info.duration, 1)
            }

            self._save_voice_note(result)
            print(f"[Whisper] Transcribed ({info.duration:.0f}s, {info.language}): {transcript[:80]}...")

            return result

        except Exception as e:
            print(f"[Whisper] Transcription failed: {e}")
            return None

    def _extract_contact_name(self, transcript: str) -> str | None:
        """Try to extract a contact name from the beginning of a voice note."""
        patterns = [
            r"^(?:called|spoke (?:to|with)|talked to|note for|message for|regarding|re)\s+(.+?)[\s:,\-—]",
            r"^(.+?):\s",  # "David Lim: he said..."
            r"^(.+?)\s+(?:said|wants|confirmed|asked|mentioned|needs|called)",
        ]
        for pattern in patterns:
            match = re.match(pattern, transcript, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                # Basic validation — names are 2-4 words
                if 1 <= len(name.split()) <= 4 and len(name) <= 40:
                    return name
        return None

    def _save_voice_note(self, result: dict):
        """Append transcription to the voice notes log."""
        notes = []
        if os.path.exists(VOICE_NOTES_FILE):
            with open(VOICE_NOTES_FILE, "r") as f:
                try:
                    notes = json.load(f)
                except json.JSONDecodeError:
                    notes = []

        notes.append(result)

        with open(VOICE_NOTES_FILE, "w") as f:
            json.dump(notes, f, indent=2, ensure_ascii=False)

    def get_unprocessed_notes(self) -> list[dict]:
        """Get voice notes that haven't been included in a briefing yet."""
        if not os.path.exists(VOICE_NOTES_FILE):
            return []

        with open(VOICE_NOTES_FILE, "r") as f:
            try:
                notes = json.load(f)
            except json.JSONDecodeError:
                return []

        return [n for n in notes if not n.get("processed")]

    def mark_notes_processed(self):
        """Mark all current voice notes as processed."""
        if not os.path.exists(VOICE_NOTES_FILE):
            return

        with open(VOICE_NOTES_FILE, "r") as f:
            try:
                notes = json.load(f)
            except json.JSONDecodeError:
                return

        for note in notes:
            note["processed"] = True

        with open(VOICE_NOTES_FILE, "w") as f:
            json.dump(notes, f, indent=2, ensure_ascii=False)
