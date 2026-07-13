import pytest

from app.llm import APIClient


def test_api_client_requires_complete_configuration():
    with pytest.raises(RuntimeError, match="API_MODEL"):
        APIClient("", "", "")


def test_api_payload_uses_selected_model_and_stream_mode():
    client = APIClient("portfolio-model", "https://provider.example/v1", "secret")
    try:
        payload = client._payload("grounded prompt", True)
        assert payload["model"] == "portfolio-model"
        assert payload["stream"] is True
        assert payload["messages"] == [{"role": "user", "content": "grounded prompt"}]
    finally:
        client.close()
