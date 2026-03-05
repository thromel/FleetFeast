import SwiftUI

struct CourierJobConsoleView: View {
    @StateObject private var model = CourierJobConsoleViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Backend")
                            .font(.headline)

                        baseURLField
                            .font(.callout.monospaced())
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Text("Default for simulator: http://127.0.0.1:4102. For device, use your Mac's LAN IP.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Courier")
                            .font(.headline)

                        TextField("Courier ID", text: $model.courierId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        HStack(spacing: 12) {
                            Button {
                                Task {
                                    await model.loadJobs()
                                }
                            } label: {
                                Label("Load Jobs", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.isBusy)

                            Spacer()

                            if model.isBusy {
                                ProgressView()
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Jobs")
                            .font(.headline)

                        if model.jobs.isEmpty {
                            Text("No jobs loaded.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(model.jobs, id: \.jobId) { job in
                                VStack(alignment: .leading, spacing: 10) {
                                    Text(job.jobId)
                                        .font(.callout.monospaced())
                                        .textSelection(.enabled)

                                    Text("Order \(job.orderId)")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)

                                    HStack(spacing: 10) {
                                        Text(job.status)
                                            .font(.subheadline.weight(.semibold))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .fleetFeastFieldBackground(in: Capsule())

                                        if let courierId = job.courierId {
                                            Text(courierId)
                                                .font(.footnote.monospaced())
                                                .foregroundStyle(.secondary)
                                        }
                                    }

                                    HStack(spacing: 8) {
                                        Button("Accept") {
                                            Task {
                                                await model.accept(jobId: job.jobId)
                                            }
                                        }
                                        .buttonStyle(.bordered)
                                        .disabled(model.isBusy || job.status != "AVAILABLE")

                                        Button("Pickup") {
                                            Task {
                                                await model.pickup(jobId: job.jobId)
                                            }
                                        }
                                        .buttonStyle(.bordered)
                                        .disabled(model.isBusy || job.status != "ACCEPTED")

                                        Button("Dropoff") {
                                            Task {
                                                await model.dropoff(jobId: job.jobId)
                                            }
                                        }
                                        .buttonStyle(.bordered)
                                        .disabled(model.isBusy || job.status != "PICKED_UP")
                                    }
                                }
                                .padding(12)
                                .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                        }

                        if let error = model.lastError {
                            Text("Error: \(error)")
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle("FleetFeast Courier")
        }
    }

    @ViewBuilder
    private var baseURLField: some View {
        #if os(iOS)
        TextField("Courier BFF Base URL", text: $model.baseURLString)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled(true)
            .textContentType(.URL)
            .keyboardType(.URL)
        #else
        TextField("Courier BFF Base URL", text: $model.baseURLString)
            .autocorrectionDisabled(true)
        #endif
    }
}

private extension View {
    @ViewBuilder
    func fleetFeastTextInputAutocapitalizationNever() -> some View {
        #if os(iOS)
        self.textInputAutocapitalization(.never)
        #else
        self
        #endif
    }

    @ViewBuilder
    func fleetFeastFieldBackground<S: Shape>(in shape: S) -> some View {
        #if os(iOS)
        self.background(.thinMaterial, in: shape)
        #else
        self.background(Color.secondary.opacity(0.10), in: shape)
        #endif
    }
}
