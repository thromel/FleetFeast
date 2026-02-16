package dispatch

import (
	"fmt"
	"math"
	"sort"
	"strings"

	dispatchv1 "github.com/romel/foodpanda/dispatch-engine/internal/gen/dispatch/v1"
)

type Engine struct {
	minCourierScore                float64
	maxActiveOrders                int32
	maxMerchantFallbackSLAPressure float64
}

func NewEngine() *Engine {
	return &Engine{
		minCourierScore:                15,
		maxActiveOrders:                4,
		maxMerchantFallbackSLAPressure: 0.9,
	}
}

func (e *Engine) ScoreCandidates(
	candidates []*dispatchv1.Candidate,
	slaPressure float64,
) []*dispatchv1.CandidateScore {
	scored := make([]*dispatchv1.CandidateScore, 0, len(candidates))
	for _, candidate := range candidates {
		scored = append(scored, e.scoreCandidate(candidate, slaPressure))
	}

	sort.Slice(scored, func(i, j int) bool {
		if scored[i].Score == scored[j].Score {
			return scored[i].CourierId < scored[j].CourierId
		}
		return scored[i].Score > scored[j].Score
	})

	return scored
}

func (e *Engine) Assign(
	orderID string,
	candidates []*dispatchv1.Candidate,
	slaPressure float64,
	merchantSelfDeliveryEnabled bool,
) *dispatchv1.AssignResponse {
	scored := e.ScoreCandidates(candidates, slaPressure)
	candidateByID := make(map[string]*dispatchv1.Candidate, len(candidates))
	for _, candidate := range candidates {
		candidateByID[candidate.CourierId] = candidate
	}

	if len(scored) > 0 && scored[0].Score >= e.minCourierScore {
		selected := scored[0]
		candidate := candidateByID[selected.CourierId]
		if candidate != nil && candidate.Available && candidate.WithinRestWindow {
			etaSeconds := int32(180 + int(math.Ceil(float64(candidate.DistanceMeters)/8.0)))
			return &dispatchv1.AssignResponse{
				AssignmentId: fmt.Sprintf("asg_%s_%s", sanitize(orderID), sanitize(selected.CourierId)),
				Mode:         "COURIER",
				CourierId:    selected.CourierId,
				EtaSeconds:   etaSeconds,
				ReasonCodes:  selected.ReasonCodes,
			}
		}
	}

	if merchantSelfDeliveryEnabled && slaPressure <= e.maxMerchantFallbackSLAPressure {
		return &dispatchv1.AssignResponse{
			Mode: "MERCHANT_SELF_DELIVERY",
			ReasonCodes: dedupeReasonCodes(append(
				[]string{"NO_ELIGIBLE_COURIER", "FALLBACK_MERCHANT_SELF_DELIVERY"},
				topCandidateReasons(scored)...,
			)),
		}
	}

	if merchantSelfDeliveryEnabled && slaPressure > e.maxMerchantFallbackSLAPressure {
		return &dispatchv1.AssignResponse{
			Mode: "SUPPORT_QUEUE",
			ReasonCodes: dedupeReasonCodes(append(
				[]string{"NO_ELIGIBLE_COURIER", "SLA_TOO_TIGHT_FOR_MERCHANT_FALLBACK"},
				topCandidateReasons(scored)...,
			)),
		}
	}

	return &dispatchv1.AssignResponse{
		Mode: "UNASSIGNED",
		ReasonCodes: dedupeReasonCodes(append(
			[]string{"NO_ELIGIBLE_COURIER"},
			topCandidateReasons(scored)...,
		)),
	}
}

func (e *Engine) Reassign(
	orderID string,
	previousAssignmentID string,
	reasonCode string,
	candidates []*dispatchv1.Candidate,
	slaPressure float64,
	attempt int32,
	merchantSelfDeliveryEnabled bool,
	previousCourierID string,
) *dispatchv1.ReassignResponse {
	filteredCandidates := make([]*dispatchv1.Candidate, 0, len(candidates))
	for _, candidate := range candidates {
		if previousCourierID != "" && candidate.CourierId == previousCourierID {
			continue
		}
		filteredCandidates = append(filteredCandidates, candidate)
	}

	assignResult := e.Assign(orderID, filteredCandidates, slaPressure, merchantSelfDeliveryEnabled)
	reasonCodes := make([]string, 0, len(assignResult.ReasonCodes)+3)
	if reasonCode != "" {
		reasonCodes = append(reasonCodes, reasonCode)
	}
	reasonCodes = append(reasonCodes, assignResult.ReasonCodes...)

	if assignResult.Mode == "COURIER" {
		reasonCodes = append(reasonCodes, "REASSIGNED")
		return &dispatchv1.ReassignResponse{
			AssignmentId:       assignResult.AssignmentId,
			CourierId:          assignResult.CourierId,
			EtaSeconds:         assignResult.EtaSeconds,
			ReasonCodes:        reasonCodes,
			Mode:               "COURIER",
			EscalatedToSupport: false,
		}
	}

	if attempt >= 3 && assignResult.Mode == "UNASSIGNED" {
		reasonCodes = append(reasonCodes, "MAX_REASSIGNMENT_ATTEMPTS_REACHED")
		if previousAssignmentID != "" {
			reasonCodes = append(reasonCodes, fmt.Sprintf("PREVIOUS_ASSIGNMENT_%s", sanitize(previousAssignmentID)))
		}

		return &dispatchv1.ReassignResponse{
			ReasonCodes:        reasonCodes,
			Mode:               "SUPPORT_QUEUE",
			EscalatedToSupport: true,
		}
	}

	return &dispatchv1.ReassignResponse{
		AssignmentId:       assignResult.AssignmentId,
		CourierId:          assignResult.CourierId,
		EtaSeconds:         assignResult.EtaSeconds,
		ReasonCodes:        reasonCodes,
		Mode:               assignResult.Mode,
		EscalatedToSupport: false,
	}
}

func (e *Engine) scoreCandidate(
	candidate *dispatchv1.Candidate,
	slaPressure float64,
) *dispatchv1.CandidateScore {
	score := 100.0
	reasonCodes := make([]string, 0, 4)

	if candidate.DistanceMeters <= 1000 {
		reasonCodes = append(reasonCodes, "DISTANCE_NEAR")
	} else {
		reasonCodes = append(reasonCodes, "DISTANCE_FAR")
	}

	if candidate.ActiveOrders <= 1 {
		reasonCodes = append(reasonCodes, "CAPACITY_AVAILABLE")
	} else if candidate.ActiveOrders <= 3 {
		reasonCodes = append(reasonCodes, "CAPACITY_MEDIUM")
	} else {
		reasonCodes = append(reasonCodes, "CAPACITY_HIGH")
	}

	if !candidate.Available {
		reasonCodes = append(reasonCodes, "COURIER_UNAVAILABLE")
		return &dispatchv1.CandidateScore{
			CourierId:   candidate.CourierId,
			Score:       0,
			ReasonCodes: reasonCodes,
		}
	}

	if !candidate.WithinRestWindow {
		reasonCodes = append(reasonCodes, "LEGAL_REST_REQUIRED")
		return &dispatchv1.CandidateScore{
			CourierId:   candidate.CourierId,
			Score:       0,
			ReasonCodes: reasonCodes,
		}
	}

	if candidate.ActiveOrders >= e.maxActiveOrders {
		reasonCodes = append(reasonCodes, "CAPACITY_LIMIT_EXCEEDED")
		return &dispatchv1.CandidateScore{
			CourierId:   candidate.CourierId,
			Score:       0,
			ReasonCodes: reasonCodes,
		}
	}

	score -= math.Min(60, float64(candidate.DistanceMeters)/100.0)
	score -= float64(candidate.ActiveOrders) * 12
	score += math.Max(0, math.Min(1.0, slaPressure)) * 15
	if score < 0 {
		score = 0
	}

	reasonCodes = append(reasonCodes, "ELIGIBLE")
	return &dispatchv1.CandidateScore{
		CourierId:   candidate.CourierId,
		Score:       score,
		ReasonCodes: reasonCodes,
	}
}

func sanitize(value string) string {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")
	if normalized == "" {
		return "na"
	}

	return normalized
}

func topCandidateReasons(scored []*dispatchv1.CandidateScore) []string {
	if len(scored) == 0 {
		return nil
	}

	return scored[0].ReasonCodes
}

func dedupeReasonCodes(reasonCodes []string) []string {
	if len(reasonCodes) == 0 {
		return reasonCodes
	}

	deduped := make([]string, 0, len(reasonCodes))
	seen := make(map[string]struct{}, len(reasonCodes))
	for _, reasonCode := range reasonCodes {
		if reasonCode == "" {
			continue
		}
		if _, exists := seen[reasonCode]; exists {
			continue
		}

		seen[reasonCode] = struct{}{}
		deduped = append(deduped, reasonCode)
	}

	return deduped
}
