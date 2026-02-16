package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/romel/foodpanda/dispatch-engine/internal/server"
)

func main() {
	address := os.Getenv("DISPATCH_GRPC_ADDR")
	if address == "" {
		address = ":9090"
	}

	grpcServer, err := server.NewGRPCServer(address)
	if err != nil {
		log.Fatalf("[dispatch-engine] invalid grpc configuration: %v", err)
	}

	if err := grpcServer.Start(); err != nil {
		log.Fatalf("[dispatch-engine] failed to start grpc server: %v", err)
	}

	log.Printf("[dispatch-engine] grpc server listening on %s", grpcServer.Address())

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := grpcServer.Stop(ctx); err != nil {
		log.Printf("[dispatch-engine] shutdown with timeout: %v", err)
	}
}
