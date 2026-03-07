#!/usr/bin/env python3
"""Example: Image generation with Stable Diffusion."""

import sys
sys.path.insert(0, "..")
from cf_ai import CloudflareAI

ai = CloudflareAI()

# Generate image
print("=== Image Generation ===")
try:
    path = ai.generate_image_to_file(
        prompt="A serene Japanese garden with cherry blossoms, koi pond, and wooden bridge, digital art style",
        output_path="japanese_garden.png",
        width=1024,
        height=1024,
        steps=20
    )
    print(f"Saved to: {path}")
except Exception as e:
    print(f"Error: {e}")

# With negative prompt
print("\n=== With Negative Prompt ===")
try:
    response = ai.generate_image(
        prompt="Professional portrait photo of a business executive",
        negative_prompt="cartoon, anime, blurry, low quality",
        width=768,
        height=1024
    )
    if response.success:
        with open("portrait.png", "wb") as f:
            f.write(response.result)
        print("Saved to: portrait.png")
except Exception as e:
    print(f"Error: {e}")

print("""
Usage:
    from cf_ai import CloudflareAI

    ai = CloudflareAI()

    # Quick save
    ai.generate_image_to_file(
        "A sunset over mountains",
        "sunset.png"
    )

    # With options
    ai.generate_image_to_file(
        prompt="...",
        output_path="output.png",
        negative_prompt="blurry, low quality",
        width=1024,
        height=1024,
        steps=30  # More steps = higher quality
    )

    # Get raw bytes
    response = ai.generate_image("...")
    image_bytes = response.result
""")
