import unittest

from tfidf import score_pairs, tokenize


class SimilarityTests(unittest.TestCase):
    def test_technical_names_remain_distinct(self):
        self.assertEqual(tokenize("C C++ C# Node.js .NET"), ["c", "c++", "c#", "node.js", ".net"])

    def test_identical_unrelated_and_missing(self):
        rows = score_pairs([{"id": "s", "skills": "C++, Arduino"}], [
            {"id": "same", "skills": ["Arduino", "C++"]},
            {"id": "other", "skills": "C#, React"},
            {"id": "empty", "skills": ""}])
        self.assertAlmostEqual(rows[0]["cosine_similarity"], 1)
        self.assertEqual(rows[1]["cosine_similarity"], 0)
        self.assertFalse(rows[1]["missing_skills"])
        self.assertTrue(rows[2]["missing_skills"])

    def test_direct_overlap_beats_unrelated_skills(self):
        rows = score_pairs([{"id": "s", "skills": "Python SQL React"}], [
            {"id": "web", "skills": "React SQL TypeScript"},
            {"id": "hardware", "skills": "Arduino sensors"}])
        self.assertGreater(rows[0]["cosine_similarity"], rows[1]["cosine_similarity"])

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            score_pairs([{"id": "same"}, {"id": "same"}], [])


if __name__ == "__main__":
    unittest.main()
