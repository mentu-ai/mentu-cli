from setuptools import setup

setup(
    name="cf-ai",
    version="1.0.0",
    py_modules=["cf_ai"],
    install_requires=["requests>=2.28.0"],
    entry_points={
        "console_scripts": [
            "cf-ai=cf_ai:main",
        ],
    },
    author="Rashid Azarang",
    description="Cloudflare Workers AI Python SDK",
    python_requires=">=3.8",
)
