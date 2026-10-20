import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import supabase_client


class TestSupabaseClient(unittest.TestCase):
    def test_disabled_when_no_credentials(self):
        with patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_SERVICE_KEY": "", "SUPABASE_KEY": ""}):
            supabase_client._client_initialized = False
            supabase_client._supabase_client = None
            self.assertFalse(supabase_client.is_supabase_enabled())
            self.assertIsNone(supabase_client.get_supabase_client())
            self.assertEqual(supabase_client.check_supabase_health()["status"], "disabled")
            self.assertIsNone(supabase_client.save_qa_interaction("test", "test", []))
            self.assertFalse(supabase_client.update_qa_feedback("uuid", 1))
            self.assertEqual(supabase_client.get_recent_qa_history(), [])
            self.assertEqual(supabase_client.get_bills_list(), [])

    @patch("supabase.create_client")
    def test_save_qa_interaction_with_client(self, mock_create):
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_insert = MagicMock()
        mock_execute = MagicMock()

        mock_execute.return_value.data = [{"id": "test-uuid-1234"}]
        mock_insert.execute = mock_execute
        mock_table.insert.return_value = mock_insert
        mock_client.table.return_value = mock_table
        mock_create.return_value = mock_client

        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_KEY": "dummy_key"}):
            supabase_client._client_initialized = False
            supabase_client._supabase_client = None

            res_id = supabase_client.save_qa_interaction(
                question="What is the bill?",
                answer="The bill amends the law.",
                sources=[{"bill_id": "LS-2026-155"}],
                bill_id="LS-2026-155",
            )
            self.assertEqual(res_id, "test-uuid-1234")
            mock_table.insert.assert_called_once()


if __name__ == "__main__":
    unittest.main()
