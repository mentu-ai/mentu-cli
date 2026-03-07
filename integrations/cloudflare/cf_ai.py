"""
Cloudflare Workers AI - Python SDK
==================================

Unified interface for Cloudflare's AI models:
- Text Generation (Llama, DeepSeek, Mistral)
- Speech-to-Text (Whisper)
- Text-to-Speech (MeloTTS, Aura)
- Embeddings (BGE-M3)
- Image Generation (Stable Diffusion)

Usage:
    from cf_ai import CloudflareAI

    ai = CloudflareAI()  # Uses env vars

    # Text generation
    response = ai.chat("Hello, who are you?")

    # Speech to text
    text = ai.transcribe("audio.mp3", language="en")

    # Embeddings
    vectors = ai.embed(["Hello world", "Goodbye"])

    # Image generation
    image_bytes = ai.generate_image("A sunset over mountains")
"""

import os
import json
import base64
import requests
from pathlib import Path
from typing import List, Optional, Union, Dict, Any
from dataclasses import dataclass


@dataclass
class AIResponse:
    """Standardized response from AI models."""
    success: bool
    result: Any
    usage: Optional[Dict[str, int]] = None
    errors: Optional[List[str]] = None

    def __str__(self):
        if self.success:
            return str(self.result)
        return f"Error: {self.errors}"


class CloudflareAI:
    """
    Cloudflare Workers AI Client.

    Environment Variables:
        CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
        CLOUDFLARE_API_TOKEN: API token with Workers AI access
    """

    # Model aliases for convenience
    MODELS = {
        # Text Generation
        "llama": "@cf/meta/llama-3-8b-instruct",
        "llama-3": "@cf/meta/llama-3-8b-instruct",
        "llama-3.2": "@cf/meta/llama-3.2-3b-instruct",
        "deepseek": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        "mistral": "@cf/mistral/mistral-7b-instruct-v0.1",

        # Speech
        "whisper": "@cf/openai/whisper",
        "tts": "@cf/myshell-ai/melotts",
        "tts-es": "@cf/deepgram/aura-2-es",

        # Embeddings
        "embed": "@cf/baai/bge-m3",
        "embed-jp": "@cf/pfnet/plamo-embedding-1b",

        # Image
        "sdxl": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        "sd": "@cf/runwayml/stable-diffusion-v1-5-img2img",
        "sd-inpaint": "@cf/runwayml/stable-diffusion-v1-5-inpainting",

        # Vision
        "llava": "@cf/llava-hf/llava-1.5-7b-hf",
    }

    def __init__(
        self,
        account_id: Optional[str] = None,
        api_token: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        self.account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN")

        if not self.account_id or not self.api_token:
            raise ValueError(
                "Missing credentials. Set CLOUDFLARE_ACCOUNT_ID and "
                "CLOUDFLARE_API_TOKEN environment variables."
            )

        self.base_url = base_url or f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        })

    def _resolve_model(self, model: str) -> str:
        """Resolve model alias to full model name."""
        return self.MODELS.get(model, model)

    def _request(self, model: str, payload: Dict[str, Any]) -> AIResponse:
        """Make request to Cloudflare AI API."""
        model = self._resolve_model(model)
        url = f"{self.base_url}/{model}"

        try:
            response = self.session.post(url, json=payload)
            data = response.json()

            if data.get("success"):
                return AIResponse(
                    success=True,
                    result=data.get("result"),
                    usage=data.get("result", {}).get("usage")
                )
            else:
                return AIResponse(
                    success=False,
                    result=None,
                    errors=[e.get("message", str(e)) for e in data.get("errors", [])]
                )
        except Exception as e:
            return AIResponse(success=False, result=None, errors=[str(e)])

    # =========================================================================
    # TEXT GENERATION
    # =========================================================================

    def chat(
        self,
        prompt: str,
        model: str = "llama",
        system: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream: bool = False
    ) -> AIResponse:
        """
        Generate text using LLM.

        Args:
            prompt: User message
            model: Model alias or full name (llama, deepseek, mistral)
            system: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-2)
            stream: Whether to stream response

        Returns:
            AIResponse with generated text in result.response
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }

        return self._request(model, payload)

    def complete(
        self,
        prompt: str,
        model: str = "llama",
        max_tokens: int = 512
    ) -> AIResponse:
        """
        Simple text completion (non-chat format).

        Args:
            prompt: Text prompt
            model: Model alias or full name
            max_tokens: Maximum tokens to generate

        Returns:
            AIResponse with generated text
        """
        payload = {
            "prompt": prompt,
            "max_tokens": max_tokens
        }
        return self._request(model, payload)

    # =========================================================================
    # SPEECH TO TEXT
    # =========================================================================

    def transcribe(
        self,
        audio: Union[str, Path, bytes],
        language: str = "en",
        model: str = "whisper"
    ) -> AIResponse:
        """
        Transcribe audio to text using Whisper.

        Args:
            audio: Path to audio file or raw bytes
            language: Language code (en, es, fr, de, etc.)
            model: Model to use (default: whisper)

        Returns:
            AIResponse with transcription in result.text
        """
        if isinstance(audio, (str, Path)):
            audio_path = Path(audio)
            if not audio_path.exists():
                return AIResponse(success=False, result=None, errors=[f"File not found: {audio}"])
            audio_bytes = audio_path.read_bytes()
        else:
            audio_bytes = audio

        # Whisper expects base64 or raw audio
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        model_name = self._resolve_model(model)
        url = f"{self.base_url}/{model_name}"

        # Use multipart form for audio
        response = self.session.post(
            url,
            headers={"Content-Type": "application/json"},
            json={"audio": audio_b64, "language": language}
        )

        data = response.json()
        if data.get("success"):
            return AIResponse(success=True, result=data.get("result"))
        return AIResponse(success=False, result=None, errors=data.get("errors", []))

    def transcribe_file(
        self,
        file_path: Union[str, Path],
        language: str = "en"
    ) -> str:
        """
        Convenience method to transcribe a file and return text directly.

        Args:
            file_path: Path to audio file
            language: Language code

        Returns:
            Transcribed text string
        """
        response = self.transcribe(file_path, language)
        if response.success:
            return response.result.get("text", "")
        raise Exception(f"Transcription failed: {response.errors}")

    # =========================================================================
    # TEXT TO SPEECH
    # =========================================================================

    def speak(
        self,
        text: str,
        language: str = "en",
        model: Optional[str] = None
    ) -> AIResponse:
        """
        Convert text to speech.

        Args:
            text: Text to speak
            language: Language (en, es)
            model: TTS model (auto-selected based on language if not provided)

        Returns:
            AIResponse with audio bytes in result
        """
        if model is None:
            model = "tts-es" if language == "es" else "tts"

        payload = {"text": text}

        model_name = self._resolve_model(model)
        url = f"{self.base_url}/{model_name}"

        response = self.session.post(url, json=payload)

        # TTS returns binary audio
        if response.status_code == 200 and response.headers.get("content-type", "").startswith("audio"):
            return AIResponse(success=True, result=response.content)

        try:
            data = response.json()
            return AIResponse(success=False, result=None, errors=data.get("errors", []))
        except:
            return AIResponse(success=True, result=response.content)

    def speak_to_file(
        self,
        text: str,
        output_path: Union[str, Path],
        language: str = "en"
    ) -> Path:
        """
        Generate speech and save to file.

        Args:
            text: Text to speak
            output_path: Where to save audio file
            language: Language code

        Returns:
            Path to saved audio file
        """
        response = self.speak(text, language)
        if response.success:
            output = Path(output_path)
            output.write_bytes(response.result)
            return output
        raise Exception(f"TTS failed: {response.errors}")

    # =========================================================================
    # EMBEDDINGS
    # =========================================================================

    def embed(
        self,
        texts: Union[str, List[str]],
        model: str = "embed"
    ) -> AIResponse:
        """
        Generate embeddings for text(s).

        Args:
            texts: Single text or list of texts
            model: Embedding model (embed, embed-jp)

        Returns:
            AIResponse with embeddings in result.data
        """
        if isinstance(texts, str):
            texts = [texts]

        payload = {"text": texts}
        return self._request(model, payload)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Convenience method to get raw embedding vectors.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        response = self.embed(texts)
        if response.success:
            return response.result.get("data", [])
        raise Exception(f"Embedding failed: {response.errors}")

    # =========================================================================
    # IMAGE GENERATION
    # =========================================================================

    def generate_image(
        self,
        prompt: str,
        model: str = "sdxl",
        negative_prompt: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        steps: int = 20
    ) -> AIResponse:
        """
        Generate image from text prompt.

        Args:
            prompt: Image description
            model: Model (sdxl, sd)
            negative_prompt: What to avoid in image
            width: Image width
            height: Image height
            steps: Number of diffusion steps

        Returns:
            AIResponse with image bytes in result
        """
        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_steps": steps
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt

        model_name = self._resolve_model(model)
        url = f"{self.base_url}/{model_name}"

        response = self.session.post(url, json=payload)

        # Image gen returns binary
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            if "image" in content_type or len(response.content) > 1000:
                return AIResponse(success=True, result=response.content)

        try:
            data = response.json()
            if data.get("success"):
                return AIResponse(success=True, result=data.get("result"))
            return AIResponse(success=False, result=None, errors=data.get("errors", []))
        except:
            return AIResponse(success=True, result=response.content)

    def generate_image_to_file(
        self,
        prompt: str,
        output_path: Union[str, Path],
        **kwargs
    ) -> Path:
        """
        Generate image and save to file.

        Args:
            prompt: Image description
            output_path: Where to save image
            **kwargs: Additional args for generate_image

        Returns:
            Path to saved image
        """
        response = self.generate_image(prompt, **kwargs)
        if response.success:
            output = Path(output_path)
            output.write_bytes(response.result)
            return output
        raise Exception(f"Image generation failed: {response.errors}")

    # =========================================================================
    # VISION (Image to Text)
    # =========================================================================

    def describe_image(
        self,
        image: Union[str, Path, bytes],
        prompt: str = "Describe this image in detail.",
        model: str = "llava"
    ) -> AIResponse:
        """
        Describe an image using vision model.

        Args:
            image: Path to image or raw bytes
            prompt: Question about the image
            model: Vision model to use

        Returns:
            AIResponse with description
        """
        if isinstance(image, (str, Path)):
            image_path = Path(image)
            if not image_path.exists():
                return AIResponse(success=False, result=None, errors=[f"File not found: {image}"])
            image_bytes = image_path.read_bytes()
        else:
            image_bytes = image

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "prompt": prompt,
            "image": image_b64
        }

        return self._request(model, payload)

    # =========================================================================
    # UTILITIES
    # =========================================================================

    def list_models(self) -> Dict[str, str]:
        """Return available model aliases."""
        return self.MODELS.copy()

    def test_connection(self) -> bool:
        """Test API connection."""
        response = self.complete("Hi", max_tokens=5)
        return response.success


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """Command-line interface."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Cloudflare Workers AI CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  cf-ai chat "What is Python?"
  cf-ai transcribe audio.mp3 --language es
  cf-ai speak "Hello world" --output hello.mp3
  cf-ai embed "Hello world"
  cf-ai image "A sunset over mountains" --output sunset.png
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command")

    # Chat
    chat_p = subparsers.add_parser("chat", help="Generate text")
    chat_p.add_argument("prompt", help="User message")
    chat_p.add_argument("--model", default="llama", help="Model to use")
    chat_p.add_argument("--system", help="System prompt")

    # Transcribe
    trans_p = subparsers.add_parser("transcribe", help="Speech to text")
    trans_p.add_argument("audio", help="Audio file path")
    trans_p.add_argument("--language", default="en", help="Language code")

    # Speak
    speak_p = subparsers.add_parser("speak", help="Text to speech")
    speak_p.add_argument("text", help="Text to speak")
    speak_p.add_argument("--output", "-o", required=True, help="Output file")
    speak_p.add_argument("--language", default="en", help="Language")

    # Embed
    embed_p = subparsers.add_parser("embed", help="Generate embeddings")
    embed_p.add_argument("texts", nargs="+", help="Text(s) to embed")

    # Image
    image_p = subparsers.add_parser("image", help="Generate image")
    image_p.add_argument("prompt", help="Image description")
    image_p.add_argument("--output", "-o", required=True, help="Output file")
    image_p.add_argument("--width", type=int, default=1024)
    image_p.add_argument("--height", type=int, default=1024)

    # Test
    subparsers.add_parser("test", help="Test connection")

    # Models
    subparsers.add_parser("models", help="List available models")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    ai = CloudflareAI()

    if args.command == "chat":
        response = ai.chat(args.prompt, model=args.model, system=args.system)
        if response.success:
            print(response.result.get("response", response.result))
        else:
            print(f"Error: {response.errors}")

    elif args.command == "transcribe":
        response = ai.transcribe(args.audio, language=args.language)
        if response.success:
            print(response.result.get("text", response.result))
        else:
            print(f"Error: {response.errors}")

    elif args.command == "speak":
        try:
            path = ai.speak_to_file(args.text, args.output, language=args.language)
            print(f"Saved to: {path}")
        except Exception as e:
            print(f"Error: {e}")

    elif args.command == "embed":
        response = ai.embed(args.texts)
        if response.success:
            print(json.dumps(response.result, indent=2))
        else:
            print(f"Error: {response.errors}")

    elif args.command == "image":
        try:
            path = ai.generate_image_to_file(
                args.prompt, args.output,
                width=args.width, height=args.height
            )
            print(f"Saved to: {path}")
        except Exception as e:
            print(f"Error: {e}")

    elif args.command == "test":
        if ai.test_connection():
            print("✓ Connection successful")
        else:
            print("✗ Connection failed")

    elif args.command == "models":
        for alias, full_name in ai.list_models().items():
            print(f"  {alias:15} → {full_name}")


if __name__ == "__main__":
    main()
