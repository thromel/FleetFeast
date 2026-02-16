package server

import (
	"context"

	"github.com/romel/foodpanda/dispatch-engine/internal/dispatch"
	dispatchv1 "github.com/romel/foodpanda/dispatch-engine/internal/gen/dispatch/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type DispatchService struct {
	dispatchv1.UnimplementedDispatchServiceServer
	engine           *dispatch.Engine
	telemetryTracker *dispatch.TelemetryTracker
}

func NewDispatchService(engine *dispatch.Engine) *DispatchService {
	return &DispatchService{
		engine:           engine,
		telemetryTracker: dispatch.NewTelemetryTracker(),
	}
}

func (d *DispatchService) Score(
	_ context.Context,
	request *dispatchv1.ScoreRequest,
) (*dispatchv1.ScoreResponse, error) {
	if request.GetOrderId() == "" {
		return nil, status.Error(codes.InvalidArgument, "order_id is required")
	}

	candidates := d.engine.ScoreCandidates(request.GetCandidates(), request.GetSlaPressure())
	return &dispatchv1.ScoreResponse{
		Candidates: candidates,
	}, nil
}

func (d *DispatchService) Assign(
	_ context.Context,
	request *dispatchv1.AssignRequest,
) (*dispatchv1.AssignResponse, error) {
	if request.GetOrderId() == "" {
		return nil, status.Error(codes.InvalidArgument, "order_id is required")
	}

	return d.engine.Assign(
		request.GetOrderId(),
		request.GetCandidates(),
		request.GetSlaPressure(),
		request.GetMerchantSelfDeliveryEnabled(),
	), nil
}

func (d *DispatchService) Reassign(
	_ context.Context,
	request *dispatchv1.ReassignRequest,
) (*dispatchv1.ReassignResponse, error) {
	if request.GetOrderId() == "" {
		return nil, status.Error(codes.InvalidArgument, "order_id is required")
	}

	return d.engine.Reassign(
		request.GetOrderId(),
		request.GetPreviousAssignmentId(),
		request.GetReasonCode(),
		request.GetCandidates(),
		request.GetSlaPressure(),
		request.GetAttempt(),
		request.GetMerchantSelfDeliveryEnabled(),
		request.GetPreviousCourierId(),
	), nil
}

func (d *DispatchService) UpdateTelemetry(
	_ context.Context,
	request *dispatchv1.UpdateTelemetryRequest,
) (*dispatchv1.UpdateTelemetryResponse, error) {
	if request.GetCourierId() == "" {
		return nil, status.Error(codes.InvalidArgument, "courier_id is required")
	}

	accepted, dropReason, etaSeconds := d.telemetryTracker.Ingest(
		request.GetCourierId(),
		request.GetObservedAtEpochMs(),
		request.GetSpeedMps(),
		request.GetDistanceToDropoffMeters(),
	)

	return &dispatchv1.UpdateTelemetryResponse{
		Accepted:   accepted,
		DropReason: dropReason,
		EtaSeconds: etaSeconds,
	}, nil
}
