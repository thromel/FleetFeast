package server

import (
	"context"
	"testing"
	"time"

	dispatchv1 "github.com/romel/foodpanda/dispatch-engine/internal/gen/dispatch/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestDispatchServiceScoreAndAssign(t *testing.T) {
	t.Parallel()

	srv, err := NewGRPCServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("new grpc server: %v", err)
	}

	if err := srv.Start(); err != nil {
		t.Fatalf("start grpc server: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		srv.Address(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		t.Fatalf("dial grpc server: %v", err)
	}
	defer conn.Close()

	client := dispatchv1.NewDispatchServiceClient(conn)
	scoreResponse, err := client.Score(ctx, &dispatchv1.ScoreRequest{
		OrderId:     "order-1",
		SlaPressure: 0.8,
		Candidates: []*dispatchv1.Candidate{
			{
				CourierId:        "courier-near",
				DistanceMeters:   500,
				Available:        true,
				ActiveOrders:     1,
				WithinRestWindow: true,
			},
			{
				CourierId:        "courier-far",
				DistanceMeters:   3800,
				Available:        true,
				ActiveOrders:     1,
				WithinRestWindow: true,
			},
		},
	})
	if err != nil {
		t.Fatalf("score rpc: %v", err)
	}

	if len(scoreResponse.Candidates) != 2 {
		t.Fatalf("expected 2 scored candidates, got %d", len(scoreResponse.Candidates))
	}
	if scoreResponse.Candidates[0].CourierId != "courier-near" {
		t.Fatalf("expected courier-near as top score, got %s", scoreResponse.Candidates[0].CourierId)
	}

	assignResponse, err := client.Assign(ctx, &dispatchv1.AssignRequest{
		OrderId:                     "order-1",
		SlaPressure:                 0.8,
		MerchantSelfDeliveryEnabled: true,
		Candidates: []*dispatchv1.Candidate{
			{
				CourierId:        "courier-near",
				DistanceMeters:   500,
				Available:        true,
				ActiveOrders:     1,
				WithinRestWindow: true,
			},
		},
	})
	if err != nil {
		t.Fatalf("assign rpc: %v", err)
	}

	if assignResponse.Mode != "COURIER" {
		t.Fatalf("expected COURIER assignment mode, got %s", assignResponse.Mode)
	}
	if assignResponse.CourierId != "courier-near" {
		t.Fatalf("expected courier-near assignment, got %s", assignResponse.CourierId)
	}
}

func TestDispatchServiceReassignEscalatesAfterRetryCap(t *testing.T) {
	t.Parallel()

	srv, err := NewGRPCServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("new grpc server: %v", err)
	}

	if err := srv.Start(); err != nil {
		t.Fatalf("start grpc server: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		srv.Address(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		t.Fatalf("dial grpc server: %v", err)
	}
	defer conn.Close()

	client := dispatchv1.NewDispatchServiceClient(conn)
	reassignResponse, err := client.Reassign(ctx, &dispatchv1.ReassignRequest{
		OrderId:                     "order-timeout",
		PreviousAssignmentId:        "asg_order_timeout_courier-old",
		ReasonCode:                  "COURIER_TIMEOUT",
		Attempt:                     3,
		MerchantSelfDeliveryEnabled: false,
		Candidates: []*dispatchv1.Candidate{
			{
				CourierId:        "courier-old",
				DistanceMeters:   1000,
				Available:        false,
				ActiveOrders:     0,
				WithinRestWindow: true,
			},
		},
		PreviousCourierId: "courier-old",
	})
	if err != nil {
		t.Fatalf("reassign rpc: %v", err)
	}

	if !reassignResponse.EscalatedToSupport {
		t.Fatalf("expected support escalation at retry cap")
	}
	if reassignResponse.Mode != "SUPPORT_QUEUE" {
		t.Fatalf("expected SUPPORT_QUEUE mode, got %s", reassignResponse.Mode)
	}
}

func TestDispatchServiceTelemetryIngestAndOrdering(t *testing.T) {
	t.Parallel()

	srv, err := NewGRPCServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("new grpc server: %v", err)
	}

	if err := srv.Start(); err != nil {
		t.Fatalf("start grpc server: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		srv.Address(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		t.Fatalf("dial grpc server: %v", err)
	}
	defer conn.Close()

	client := dispatchv1.NewDispatchServiceClient(conn)
	first, err := client.UpdateTelemetry(ctx, &dispatchv1.UpdateTelemetryRequest{
		CourierId:               "courier-telemetry-1",
		Latitude:                40.7128,
		Longitude:               -74.0060,
		ObservedAtEpochMs:       1000,
		SpeedMps:                6.5,
		DistanceToDropoffMeters: 650,
	})
	if err != nil {
		t.Fatalf("update telemetry first call: %v", err)
	}

	if !first.Accepted {
		t.Fatalf("expected first telemetry point to be accepted")
	}
	if first.EtaSeconds <= 0 {
		t.Fatalf("expected positive eta seconds, got %d", first.EtaSeconds)
	}

	second, err := client.UpdateTelemetry(ctx, &dispatchv1.UpdateTelemetryRequest{
		CourierId:               "courier-telemetry-1",
		Latitude:                40.7138,
		Longitude:               -74.0070,
		ObservedAtEpochMs:       900,
		SpeedMps:                7.0,
		DistanceToDropoffMeters: 500,
	})
	if err != nil {
		t.Fatalf("update telemetry second call: %v", err)
	}

	if second.Accepted {
		t.Fatalf("expected out-of-order telemetry to be rejected")
	}
	if second.DropReason != "OUT_OF_ORDER" {
		t.Fatalf("expected OUT_OF_ORDER drop reason, got %s", second.DropReason)
	}
}

func TestDispatchServiceAssignRejectsCapacityViolations(t *testing.T) {
	t.Parallel()

	srv, err := NewGRPCServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("new grpc server: %v", err)
	}

	if err := srv.Start(); err != nil {
		t.Fatalf("start grpc server: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		srv.Address(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		t.Fatalf("dial grpc server: %v", err)
	}
	defer conn.Close()

	client := dispatchv1.NewDispatchServiceClient(conn)
	response, err := client.Assign(ctx, &dispatchv1.AssignRequest{
		OrderId:                     "order-capacity-1",
		MerchantSelfDeliveryEnabled: false,
		SlaPressure:                 0.8,
		Candidates: []*dispatchv1.Candidate{
			{
				CourierId:        "courier-over-capacity",
				DistanceMeters:   300,
				Available:        true,
				ActiveOrders:     5,
				WithinRestWindow: true,
			},
		},
	})
	if err != nil {
		t.Fatalf("assign rpc: %v", err)
	}

	if response.Mode != "UNASSIGNED" {
		t.Fatalf("expected UNASSIGNED when capacity policy fails, got %s", response.Mode)
	}
	containsCapacityReason := false
	for _, reasonCode := range response.ReasonCodes {
		if reasonCode == "CAPACITY_LIMIT_EXCEEDED" {
			containsCapacityReason = true
			break
		}
	}
	if !containsCapacityReason {
		t.Fatalf("expected CAPACITY_LIMIT_EXCEEDED reason code, got %v", response.ReasonCodes)
	}
}

func TestDispatchServiceMerchantFallbackPolicyForTightSLA(t *testing.T) {
	t.Parallel()

	srv, err := NewGRPCServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("new grpc server: %v", err)
	}

	if err := srv.Start(); err != nil {
		t.Fatalf("start grpc server: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		ctx,
		srv.Address(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		t.Fatalf("dial grpc server: %v", err)
	}
	defer conn.Close()

	client := dispatchv1.NewDispatchServiceClient(conn)
	response, err := client.Assign(ctx, &dispatchv1.AssignRequest{
		OrderId:                     "order-tight-sla",
		MerchantSelfDeliveryEnabled: true,
		SlaPressure:                 0.99,
		Candidates: []*dispatchv1.Candidate{
			{
				CourierId:        "courier-unavailable",
				DistanceMeters:   500,
				Available:        false,
				ActiveOrders:     0,
				WithinRestWindow: true,
			},
		},
	})
	if err != nil {
		t.Fatalf("assign rpc: %v", err)
	}

	if response.Mode != "SUPPORT_QUEUE" {
		t.Fatalf("expected SUPPORT_QUEUE for tight SLA fallback policy, got %s", response.Mode)
	}
}
