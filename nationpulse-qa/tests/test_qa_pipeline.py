import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from qa_pipeline import BillQAPipeline


class BillQAPipelineAccuracyTests(unittest.TestCase):
    def test_question_with_bill_title_scopes_to_matching_bill(self):
        config = {
            "retrieval": {
                "top_k": 5,
                "fetch_k": 15,
                "use_mmr": True,
                "mmr_lambda": 0.7,
            },
            "relevance_check": {"enabled": False, "max_refinement_iters": 1},
        }

        store = MagicMock()
        store.find_best_bill_title_match.return_value = "THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026"
        store.similarity_search.return_value = [
            {"text": "A BILL further to amend the Mines and Minerals Act.", "metadata": {"bill_title": "THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026", "bill_id": "LS-2026-154"}},
            {"text": "Another Bill text from a different title.", "metadata": {"bill_title": "THE PREVENTION OF INSULTS TO NATIONAL HONOUR (AMENDMENT) BILL, 2026", "bill_id": "RS-2026-LIX"}},
        ]
        generator = MagicMock()
        generator.chat.return_value = "This Bill amends the Mines and Minerals Act."

        pipeline = BillQAPipeline(config, store, generator)
        pipeline.answer("What is THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026")

        store.similarity_search.assert_called_with(
            "What is THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026",
            top_k=5,
            fetch_k=15,
            use_mmr=True,
            mmr_lambda=0.7,
            bill_id_filter=None,
            bill_title_filter="THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026",
        )

    def test_answer_continues_when_relevance_check_backend_fails(self):
        config = {
            "retrieval": {
                "top_k": 5,
                "fetch_k": 15,
                "use_mmr": True,
                "mmr_lambda": 0.7,
            },
            "relevance_check": {"enabled": True, "max_refinement_iters": 1},
        }

        store = MagicMock()
        store.similarity_search.return_value = [
            {"text": "This Bill changes the state name to Keralam.", "metadata": {"bill_title": "THE KERALA (ALTERATION OF NAME) BILL, 2026", "bill_id": "LS-2026-155"}},
        ]

        generator = MagicMock()
        generator.chat.side_effect = [RuntimeError("Gemini temporarily unavailable"), "The Bill renames the State to Keralam."]

        pipeline = BillQAPipeline(config, store, generator)
        result = pipeline.answer("What is the new name of Kerala?")

        self.assertIn("Keralam", result["answer"])
        self.assertEqual(result["refinement_iterations"], 1)


    def test_find_best_bill_title_match_with_various_phrasings(self):
        from vector_store import BillVectorStore
        store = BillVectorStore.__new__(BillVectorStore)
        store._titles_cache = [
            "THE KERALA (ALTERATION OF NAME) BILL, 2026",
            "THE TRIBUNALS REFORMS BILL, 2026",
            "THE PREVENTION OF INSULTS TO NATIONAL HONOUR (AMENDMENT) BILL, 2026",
            "THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026",
            "THE SUPREME COURT (NUMBER OF JUDGES) AMENDMENT BILL, 2026",
            "THE BANKERS' BOOKS EVIDENCE BILL, 2026",
        ]

        # Natural phrasings
        self.assertEqual(
            store.find_best_bill_title_match("Is there a deadline for adapting existing state laws after the Kerala name change?"),
            "THE KERALA (ALTERATION OF NAME) BILL, 2026",
        )
        self.assertEqual(
            store.find_best_bill_title_match("Who sits on the National Tribunals Commission?"),
            "THE TRIBUNALS REFORMS BILL, 2026",
        )
        self.assertEqual(
            store.find_best_bill_title_match("Can state governments impose taxes on mineral rights under the Mines and Minerals Amendment Bill?"),
            "THE MINES AND MINERALS (DEVELOPMENT AND REGULATION) AMENDMENT BILL, 2026",
        )
        self.assertEqual(
            store.find_best_bill_title_match("Can a bank officer be forced to appear as a witness under the Bankers' Books Evidence Bill?"),
            "THE BANKERS' BOOKS EVIDENCE BILL, 2026",
        )
        self.assertIsNone(
            store.find_best_bill_title_match("What is the weather today?"),
        )


if __name__ == "__main__":
    unittest.main()

