import os
import sys
import unittest
from unittest.mock import MagicMock, patch

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from gemini_generator import GeminiGenerator


class GeminiGeneratorFallbackTests(unittest.TestCase):
    @patch("gemini_generator.requests.post")
    def test_chat_retries_on_503_with_next_model(self, mock_post):
        first_response = MagicMock(status_code=503)
        first_response.text = "Service Unavailable"
        first_response.raise_for_status.side_effect = Exception("HTTPError")

        second_response = MagicMock(status_code=200)
        second_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "fallback answer"}]}}]
        }

        mock_post.side_effect = [first_response, second_response]

        config = {
            "generation": {
                "temperature": 0.1,
                "top_p": 0.9,
                "max_new_tokens": 100,
                "gemini_model": "gemini-3.8-flash",
            }
        }

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}, clear=False):
            generator = GeminiGenerator(config)
            result = generator.chat("system", "question", max_new_tokens=50)

        self.assertEqual(result, "fallback answer")
        self.assertEqual(mock_post.call_count, 2)
        self.assertNotEqual(
            mock_post.call_args_list[0][0][0],
            mock_post.call_args_list[1][0][0],
        )

    @patch("gemini_generator.requests.post")
    def test_chat_retries_on_read_timeout_with_next_model(self, mock_post):
        mock_post.side_effect = [
            requests.exceptions.ReadTimeout("Read timed out"),
            MagicMock(
                status_code=200,
                json=lambda: {"candidates": [{"content": {"parts": [{"text": "timeout recovered"}]}}]},
            ),
        ]

        config = {
            "generation": {
                "temperature": 0.1,
                "top_p": 0.9,
                "max_new_tokens": 100,
                "gemini_model": "gemini-3.8-flash",
            }
        }

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}, clear=False):
            generator = GeminiGenerator(config)
            result = generator.chat("system", "question", max_new_tokens=50)

        self.assertEqual(result, "timeout recovered")
        self.assertEqual(mock_post.call_count, 2)


if __name__ == "__main__":
    unittest.main()
