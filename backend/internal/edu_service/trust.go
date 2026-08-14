package edu_service

func CalculateTrustScore(questionQuality, explanationQuality, reflectionDepth int) int {
	score := clamp(questionQuality) + clamp(explanationQuality) + clamp(reflectionDepth)
	if score > 100 {
		return 100
	}
	return score
}

func TrustPolicyFor(score int) TrustPolicy {
	score = clamp(score)
	switch {
	case score < 30:
		return TrustPolicy{
			Score:       score,
			Level:       "locked",
			Permission:  "question_only",
			Description: "只允许被提问，不提供提示。",
		}
	case score < 60:
		return TrustPolicy{
			Score:       score,
			Level:       "hint",
			Permission:  "hint_allowed",
			CanHint:     true,
			Description: "允许提供提示。",
		}
	case score < 80:
		return TrustPolicy{
			Score:       score,
			Level:       "partial",
			Permission:  "partial_answer_allowed",
			CanHint:     true,
			CanPartial:  true,
			Description: "允许提供部分答案。",
		}
	default:
		return TrustPolicy{
			Score:       score,
			Level:       "explain",
			Permission:  "full_explanation_allowed",
			CanHint:     true,
			CanPartial:  true,
			CanExplain:  true,
			Description: "允许提供完整解释。",
		}
	}
}

func clamp(value int) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}
