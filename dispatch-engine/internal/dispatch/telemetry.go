package dispatch

import (
	"math"
	"sync"
)

type TelemetryTracker struct {
	mu        sync.Mutex
	lastSeen  map[string]int64
	minETAsec int32
}

func NewTelemetryTracker() *TelemetryTracker {
	return &TelemetryTracker{
		lastSeen:  make(map[string]int64),
		minETAsec: 30,
	}
}

func (t *TelemetryTracker) Ingest(
	courierID string,
	observedAtEpochMS int64,
	speedMPS float64,
	distanceToDropoffMeters int32,
) (accepted bool, dropReason string, etaSeconds int32) {
	t.mu.Lock()
	defer t.mu.Unlock()

	last, hasLast := t.lastSeen[courierID]
	if hasLast && observedAtEpochMS <= last {
		return false, "OUT_OF_ORDER", 0
	}

	t.lastSeen[courierID] = observedAtEpochMS
	if distanceToDropoffMeters < 0 {
		distanceToDropoffMeters = 0
	}

	effectiveSpeed := speedMPS
	if effectiveSpeed <= 0 {
		effectiveSpeed = 4.0
	}

	eta := int32(math.Ceil(float64(distanceToDropoffMeters) / effectiveSpeed))
	if eta < t.minETAsec {
		eta = t.minETAsec
	}

	return true, "", eta
}
