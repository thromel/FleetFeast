package server

import (
	"context"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func TestGRPCServerServesHealthChecks(t *testing.T) {
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

	client := healthpb.NewHealthClient(conn)
	response, err := client.Check(ctx, &healthpb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("health check: %v", err)
	}

	if response.Status != healthpb.HealthCheckResponse_SERVING {
		t.Fatalf("expected SERVING, got %s", response.Status.String())
	}
}
