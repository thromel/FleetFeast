package dispatch

import (
	"testing"

	dispatchv1 "github.com/romel/foodpanda/dispatch-engine/internal/gen/dispatch/v1"
)

func TestScoreCandidatesRanksByAvailabilityDistanceAndCapacity(t *testing.T) {
	t.Parallel()

	engine := NewEngine()
	scores := engine.ScoreCandidates([]*dispatchv1.Candidate{
		{
			CourierId:        "courier-near",
			DistanceMeters:   450,
			Available:        true,
			ActiveOrders:     1,
			WithinRestWindow: true,
		},
		{
			CourierId:        "courier-far",
			DistanceMeters:   4200,
			Available:        true,
			ActiveOrders:     2,
			WithinRestWindow: true,
		},
		{
			CourierId:        "courier-offline",
			DistanceMeters:   200,
			Available:        false,
			ActiveOrders:     0,
			WithinRestWindow: true,
		},
	}, 0.8)

	if len(scores) != 3 {
		t.Fatalf("expected 3 scores, got %d", len(scores))
	}

	if scores[0].CourierId != "courier-near" {
		t.Fatalf("expected top candidate courier-near, got %s", scores[0].CourierId)
	}

	if scores[2].CourierId != "courier-offline" {
		t.Fatalf("expected unavailable candidate last, got %s", scores[2].CourierId)
	}
}

func TestAssignFallsBackToMerchantWhenNoEligibleCourier(t *testing.T) {
	t.Parallel()

	engine := NewEngine()
	result := engine.Assign(
		"order-1",
		[]*dispatchv1.Candidate{
			{
				CourierId:        "courier-unavailable",
				DistanceMeters:   600,
				Available:        false,
				ActiveOrders:     0,
				WithinRestWindow: true,
			},
		},
		0.7,
		true,
	)

	if result.Mode != "MERCHANT_SELF_DELIVERY" {
		t.Fatalf("expected fallback mode MERCHANT_SELF_DELIVERY, got %s", result.Mode)
	}

	if result.CourierId != "" {
		t.Fatalf("expected empty courier id on merchant fallback, got %s", result.CourierId)
	}
}

func TestReassignPrefersNewCourierWhenPreviousDeclined(t *testing.T) {
	t.Parallel()

	engine := NewEngine()
	result := engine.Reassign(
		"order-2",
		"asg_order_2_courier-old",
		"COURIER_DECLINED",
		[]*dispatchv1.Candidate{
			{
				CourierId:        "courier-old",
				DistanceMeters:   350,
				Available:        true,
				ActiveOrders:     0,
				WithinRestWindow: true,
			},
			{
				CourierId:        "courier-new",
				DistanceMeters:   700,
				Available:        true,
				ActiveOrders:     1,
				WithinRestWindow: true,
			},
		},
		0.7,
		1,
		true,
		"courier-old",
	)

	if result.CourierId != "courier-new" {
		t.Fatalf("expected courier-new reassignment, got %s", result.CourierId)
	}
	if result.EscalatedToSupport {
		t.Fatalf("did not expect support escalation for successful reassignment")
	}
}

func TestCapacityLimitAndRestWindowBlockAssignment(t *testing.T) {
	t.Parallel()

	engine := NewEngine()
	scores := engine.ScoreCandidates([]*dispatchv1.Candidate{
		{
			CourierId:        "courier-over-capacity",
			DistanceMeters:   300,
			Available:        true,
			ActiveOrders:     5,
			WithinRestWindow: true,
		},
		{
			CourierId:        "courier-rest-violation",
			DistanceMeters:   250,
			Available:        true,
			ActiveOrders:     1,
			WithinRestWindow: false,
		},
	}, 0.9)

	if len(scores) != 2 {
		t.Fatalf("expected 2 scores, got %d", len(scores))
	}

	if scores[0].Score != 0 || scores[1].Score != 0 {
		t.Fatalf("expected blocked candidates to have zero score")
	}

	result := engine.Assign(
		"order-capacity",
		[]*dispatchv1.Candidate{
			{
				CourierId:        "courier-over-capacity",
				DistanceMeters:   300,
				Available:        true,
				ActiveOrders:     5,
				WithinRestWindow: true,
			},
		},
		0.9,
		false,
	)

	if result.Mode != "UNASSIGNED" {
		t.Fatalf("expected UNASSIGNED mode when capacity blocked, got %s", result.Mode)
	}
}

func TestMerchantFallbackPolicyEscalatesWhenSLAIsTooTight(t *testing.T) {
	t.Parallel()

	engine := NewEngine()
	result := engine.Assign(
		"order-sla-tight",
		[]*dispatchv1.Candidate{
			{
				CourierId:        "courier-unavailable",
				DistanceMeters:   600,
				Available:        false,
				ActiveOrders:     0,
				WithinRestWindow: true,
			},
		},
		0.98,
		true,
	)

	if result.Mode != "SUPPORT_QUEUE" {
		t.Fatalf("expected SUPPORT_QUEUE for tight SLA fallback decision, got %s", result.Mode)
	}
}
