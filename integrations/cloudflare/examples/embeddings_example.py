#!/usr/bin/env python3
"""Example: Generate embeddings for RAG/search."""

import sys
sys.path.insert(0, "..")
from cf_ai import CloudflareAI
import json

ai = CloudflareAI()

# Single text embedding
print("=== Single Text Embedding ===")
response = ai.embed("What is machine learning?")
if response.success:
    data = response.result.get("data", [])
    if data:
        print(f"Embedding dimension: {len(data[0])}")
        print(f"First 5 values: {data[0][:5]}")

# Batch embeddings
print("\n=== Batch Embeddings ===")
texts = [
    "Machine learning is a subset of AI",
    "Python is a programming language",
    "The weather is sunny today",
    "Neural networks learn patterns"
]

response = ai.embed(texts)
if response.success:
    embeddings = response.result.get("data", [])
    print(f"Generated {len(embeddings)} embeddings")
    print(f"Each with {len(embeddings[0])} dimensions")

# Semantic similarity (simple cosine)
print("\n=== Semantic Similarity ===")

def cosine_similarity(a, b):
    dot = sum(x*y for x,y in zip(a,b))
    norm_a = sum(x*x for x in a) ** 0.5
    norm_b = sum(x*x for x in b) ** 0.5
    return dot / (norm_a * norm_b)

query = "What is artificial intelligence?"
docs = [
    "AI and machine learning are transforming technology",
    "The cat sat on the mat",
    "Deep learning uses neural networks"
]

query_emb = ai.embed_texts([query])[0]
doc_embs = ai.embed_texts(docs)

print(f"Query: {query}\n")
for doc, emb in zip(docs, doc_embs):
    sim = cosine_similarity(query_emb, emb)
    print(f"  [{sim:.3f}] {doc}")

print("""

Usage for RAG:
    from cf_ai import CloudflareAI

    ai = CloudflareAI()

    # Index documents
    docs = ["doc1...", "doc2...", "doc3..."]
    embeddings = ai.embed_texts(docs)
    # Store embeddings in vector DB (pgvector, Pinecone, etc.)

    # Search
    query = "What is X?"
    query_emb = ai.embed_texts([query])[0]
    # Find similar embeddings in vector DB
""")
