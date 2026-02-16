package server

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync"

	"github.com/romel/foodpanda/dispatch-engine/internal/dispatch"
	dispatchv1 "github.com/romel/foodpanda/dispatch-engine/internal/gen/dispatch/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

type GRPCServer struct {
	addr     string
	server   *grpc.Server
	listener net.Listener
	mu       sync.Mutex
}

func NewGRPCServer(address string) (*GRPCServer, error) {
	if strings.TrimSpace(address) == "" {
		return nil, errors.New("grpc address is required")
	}

	grpcServer := grpc.NewServer()
	healthService := health.NewServer()
	healthService.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(grpcServer, healthService)
	dispatchv1.RegisterDispatchServiceServer(grpcServer, NewDispatchService(dispatch.NewEngine()))

	return &GRPCServer{
		addr:   address,
		server: grpcServer,
	}, nil
}

func (g *GRPCServer) Start() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.listener != nil {
		return nil
	}

	listener, err := net.Listen("tcp", g.addr)
	if err != nil {
		return err
	}

	g.listener = listener
	go func() {
		_ = g.server.Serve(listener)
	}()

	return nil
}

func (g *GRPCServer) Address() string {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.listener == nil {
		return g.addr
	}

	return g.listener.Addr().String()
}

func (g *GRPCServer) Stop(ctx context.Context) error {
	done := make(chan struct{})
	go func() {
		g.server.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		g.server.Stop()
		<-done
		return ctx.Err()
	}
}
