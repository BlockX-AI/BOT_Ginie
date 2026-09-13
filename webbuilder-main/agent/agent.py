import os
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
load_dotenv()

# OpenAI (preferred if key is set)
openai_key = os.getenv("OPENAI_API_KEY")
llm_gpt4 = None
llm_gpt5 = None
if openai_key:
    llm_gpt4 = ChatOpenAI(
        model="gpt-4o",
        api_key=openai_key,
        temperature=0,
        max_retries=2,
        request_timeout=90,
    )
    # GPT-5 for premium frontend generation.
    # NOTE: GPT-5 only supports the default temperature (1), so we do not override it.
    # GPT-5 uses reasoning tokens that count toward max_tokens, so we set a high
    # budget to avoid running out mid-generation during multi-step agent builds.
    gpt5_model = os.getenv("OPENAI_FRONTEND_MODEL", "gpt-5")
    llm_gpt5 = ChatOpenAI(
        model=gpt5_model,
        api_key=openai_key,
        max_retries=3,
        request_timeout=180,
        max_tokens=16000,
    )

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("[WARNING] GOOGLE_API_KEY not set - falling back to OpenAI if available.")
    api_key = "placeholder-key"

# Configure LLMs with retry settings for rate limiting
llm_gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro", 
    google_api_key=api_key,
    max_retries=5,
    request_timeout=120,
)
llm_gemini_pro = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro", 
    google_api_key=api_key,
    max_retries=5,
    request_timeout=120,
)

llm_gemini_flash = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", 
    google_api_key=api_key,
    max_retries=5,
    request_timeout=120,
)

# Use GPT-4 as default if available, else Gemini
llm = llm_gpt4 if llm_gpt4 else llm_gemini

# Optional: Claude (only if API key is provided)
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
llm_claude = None
if anthropic_key:
    llm_claude = ChatAnthropic(
        model="claude-sonnet-4-5-20250929", 
        anthropic_api_key=anthropic_key,
        temperature=0, 
    )


def get_llm_by_name(model_name: str):
    """
    Get LLM instance based on model name from frontend
    
    Supported models:
    - gpt-4 (default when OPENAI_API_KEY is set)
    - gemini-2.5-pro
    - gemini-2.5-flash
    - claude-3
    """
    model_name_lower = model_name.lower().replace(" ", "-")
    
    if "gpt-5" in model_name_lower or "gpt5" in model_name_lower:
        if llm_gpt5:
            return llm_gpt5
        if llm_gpt4:
            print("GPT-5 requested but not configured, falling back to GPT-4o")
            return llm_gpt4
        print("GPT-5 requested but no OpenAI key, falling back to Gemini")
        return llm_gemini_pro
    elif "gpt" in model_name_lower:
        if llm_gpt4:
            return llm_gpt4
        print("GPT-4 requested but not configured, falling back to Gemini")
        return llm_gemini_pro
    elif "gemini" in model_name_lower and "flash" in model_name_lower:
        return llm_gemini_flash
    elif "gemini" in model_name_lower:
        return llm_gemini_pro
    elif "claude" in model_name_lower:
        if llm_claude:
            return llm_claude
        else:
            print("Claude requested but not configured, falling back to Gemini")
            return llm_gemini_pro
    else:
        # Default: GPT-4 if available, else Gemini Pro
        return llm_gpt4 if llm_gpt4 else llm_gemini_pro

