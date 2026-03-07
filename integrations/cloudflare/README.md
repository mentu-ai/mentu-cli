# Cloudflare Workers AI - Python SDK

Unified Python interface for Cloudflare's AI models.

## Features

| Capability | Models | Use Cases |
|------------|--------|-----------|
| **Text Generation** | Llama 3, DeepSeek, Mistral | Chat, completion, reasoning |
| **Speech-to-Text** | Whisper | Transcription (en, es, +20 languages) |
| **Text-to-Speech** | MeloTTS, Aura-2 | Voice generation (en, es) |
| **Embeddings** | BGE-M3 | RAG, semantic search, clustering |
| **Image Generation** | SDXL, Stable Diffusion | Art, product images, concepts |
| **Vision** | LLaVA | Image description, analysis |

## Installation

```bash
cd mentu-ai/integrations/cloudflare
pip install -e .
```

Or just copy `cf_ai.py` to your project.

## Configuration

Set environment variables:

```bash
export CLOUDFLARE_ACCOUNT_ID="87c0cdbd93616c844386ed9f3d702ba1"
export CLOUDFLARE_API_TOKEN="your-token"
```

Or pass directly:

```python
ai = CloudflareAI(
    account_id="...",
    api_token="..."
)
```

## Quick Start

```python
from cf_ai import CloudflareAI

ai = CloudflareAI()

# Chat
response = ai.chat("What is Python?")
print(response.result["response"])

# Transcribe audio
text = ai.transcribe_file("meeting.mp3", language="en")

# Generate speech
ai.speak_to_file("Hello world", "hello.mp3")

# Embeddings for RAG
vectors = ai.embed_texts(["doc1", "doc2", "doc3"])

# Generate image
ai.generate_image_to_file("A sunset", "sunset.png")
```

## CLI Usage

```bash
# Chat
cf-ai chat "What is the capital of France?"

# Transcribe
cf-ai transcribe audio.mp3 --language es

# Text-to-speech
cf-ai speak "Hello world" -o hello.mp3

# Embeddings
cf-ai embed "Hello" "World"

# Image generation
cf-ai image "A mountain landscape" -o mountain.png

# Test connection
cf-ai test

# List models
cf-ai models
```

## Available Models

### Text Generation
- `llama` → @cf/meta/llama-3-8b-instruct
- `llama-3.2` → @cf/meta/llama-3.2-3b-instruct (128k context)
- `deepseek` → @cf/deepseek-ai/deepseek-r1-distill-qwen-32b
- `mistral` → @cf/mistral/mistral-7b-instruct-v0.1

### Speech
- `whisper` → @cf/openai/whisper (speech-to-text)
- `tts` → @cf/myshell-ai/melotts (English TTS)
- `tts-es` → @cf/deepgram/aura-2-es (Spanish TTS)

### Embeddings
- `embed` → @cf/baai/bge-m3 (multilingual, 60k context)

### Image
- `sdxl` → @cf/stabilityai/stable-diffusion-xl-base-1.0

## Pricing (Pay-per-use)

| Model | Cost |
|-------|------|
| Llama 3 8B | $0.28/M input, $0.83/M output tokens |
| Llama 3.2 3B | $0.051/M input, $0.34/M output tokens |
| Whisper | $0.00045/audio minute |
| BGE-M3 Embeddings | $0.012/M tokens |
| MeloTTS | $0.0002/audio minute |

## Examples

See `examples/` directory:
- `chat_example.py` - Text generation
- `transcribe_example.py` - Speech to text
- `tts_example.py` - Text to speech
- `embeddings_example.py` - RAG/search embeddings
- `image_example.py` - Image generation

## Integration with Mentu Ecosystem

```python
# From mentu-ai or any sibling project
from integrations.cloudflare.cf_ai import CloudflareAI

ai = CloudflareAI()
```

## License

MIT
