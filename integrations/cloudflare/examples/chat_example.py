#!/usr/bin/env python3
"""Example: Text generation with different models."""

import sys
sys.path.insert(0, "..")
from cf_ai import CloudflareAI

ai = CloudflareAI()

# Simple chat
print("=== Llama 3 ===")
response = ai.chat("What are the benefits of Python for data science?")
if response.success:
    print(response.result.get("response"))
    print(f"\nTokens used: {response.result.get('usage')}")

# With system prompt
print("\n=== With System Prompt ===")
response = ai.chat(
    "Explain quantum computing",
    system="You are a teacher explaining to a 10-year-old. Use simple words.",
    max_tokens=200
)
if response.success:
    print(response.result.get("response"))

# Using DeepSeek for complex reasoning
print("\n=== DeepSeek (Complex Reasoning) ===")
response = ai.chat(
    "What is 15% of 847, then divide by 3?",
    model="deepseek"
)
if response.success:
    print(response.result.get("response"))
