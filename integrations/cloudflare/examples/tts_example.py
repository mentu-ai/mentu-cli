#!/usr/bin/env python3
"""Example: Text to speech generation."""

import sys
sys.path.insert(0, "..")
from cf_ai import CloudflareAI

ai = CloudflareAI()

# English TTS
print("=== English Text-to-Speech ===")
try:
    path = ai.speak_to_file(
        "Hello! Welcome to Cloudflare Workers AI. This is a demonstration of text to speech.",
        "output_english.mp3",
        language="en"
    )
    print(f"Saved to: {path}")
except Exception as e:
    print(f"Error: {e}")

# Spanish TTS (uses Aura-2)
print("\n=== Spanish Text-to-Speech ===")
try:
    path = ai.speak_to_file(
        "Hola! Bienvenidos a Cloudflare Workers AI. Esta es una demostración de texto a voz.",
        "output_spanish.mp3",
        language="es"
    )
    print(f"Saved to: {path}")
except Exception as e:
    print(f"Error: {e}")

print("""
Usage:
    from cf_ai import CloudflareAI

    ai = CloudflareAI()

    # Generate and save
    ai.speak_to_file("Hello world", "hello.mp3", language="en")
    ai.speak_to_file("Hola mundo", "hola.mp3", language="es")

    # Get raw bytes
    response = ai.speak("Hello world")
    audio_bytes = response.result
""")
