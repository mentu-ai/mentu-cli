#!/usr/bin/env python3
"""Example: Speech to text with Whisper."""

import sys
sys.path.insert(0, "..")
from cf_ai import CloudflareAI

ai = CloudflareAI()

# Transcribe English audio
print("=== English Transcription ===")
# response = ai.transcribe("english_audio.mp3", language="en")
# print(response.result.get("text"))

# Transcribe Spanish audio
print("=== Spanish Transcription ===")
# response = ai.transcribe("spanish_audio.mp3", language="es")
# print(response.result.get("text"))

# Quick method
# text = ai.transcribe_file("audio.mp3", language="en")
# print(text)

print("""
Usage:
    from cf_ai import CloudflareAI

    ai = CloudflareAI()

    # English
    result = ai.transcribe("meeting.mp3", language="en")
    print(result.result["text"])

    # Spanish
    result = ai.transcribe("entrevista.mp3", language="es")
    print(result.result["text"])

    # Quick method
    text = ai.transcribe_file("audio.mp3")

Supported languages: en, es, fr, de, it, pt, nl, pl, ru, zh, ja, ko, ar, hi
""")
