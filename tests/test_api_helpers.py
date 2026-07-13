import json

import pytest

from main import ModelOptions, sse, unsupported_reply, validate_model_options


def test_sse_is_unicode_safe_and_well_framed():
    event = sse("token", token="الحج")
    assert event.endswith("\n\n")
    payload = json.loads(event.removeprefix("data: ").strip())
    assert payload == {"type": "token", "token": "الحج"}


def test_unsupported_reply_matches_query_language():
    assert unsupported_reply("What is this?").startswith("I do not")
    assert unsupported_reply("ما هذا؟").startswith("لا أملك")


def test_api_provider_requires_credentials():
    with pytest.raises(ValueError, match="base URL, model, and API key"):
        validate_model_options(ModelOptions(provider="api"))


def test_api_provider_requires_https_except_for_localhost():
    with pytest.raises(ValueError, match="must use HTTPS"):
        validate_model_options(ModelOptions(
            provider="api",
            api_model="model",
            api_base_url="http://remote.example/v1",
            api_key="secret",
        ))
    options = ModelOptions(
        provider="api",
        api_model="model",
        api_base_url="http://localhost:8080/v1",
        api_key="secret",
    )
    validate_model_options(options)
    assert options.provider == "api"
