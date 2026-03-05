import SwiftUI

struct ConsumerOrderConsoleView: View {
    @StateObject private var model = ConsumerOrderConsoleViewModel()

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

                        Text("Default for simulator: http://127.0.0.1:4101. For device, use your Mac's LAN IP.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Session")
                            .font(.headline)

                        oidcTokenField
                            .font(.callout.monospaced())
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        HStack(spacing: 12) {
                            Button {
                                Task {
                                    await model.signIn()
                                }
                            } label: {
                                Label("Sign In", systemImage: "person.crop.circle.badge.checkmark")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.isBusy)

                            Button {
                                Task {
                                    await model.refreshSession()
                                }
                            } label: {
                                Label("Refresh Session", systemImage: "key.horizontal")
                            }
                            .buttonStyle(.bordered)
                            .disabled(model.isBusy || model.session == nil)
                        }

                        if let session = model.session {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(session.session.userId)
                                    .font(.callout.monospaced())
                                    .textSelection(.enabled)

                                Text("refresh token id: \(session.session.refreshTokenId)")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Text("No active session.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Order Draft")
                            .font(.headline)

                        TextField("Consumer ID", text: $model.consumerId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        TextField("Merchant ID", text: $model.merchantId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        TextField("Item name", text: $model.itemName)
                            .padding(10)
                            .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                        HStack(spacing: 12) {
                            Stepper(value: $model.quantity, in: 1...20) {
                                Text("Qty: \(model.quantity)")
                                    .font(.callout)
                            }

                            Stepper(value: $model.unitPriceCents, in: 1...50_000, step: 50) {
                                Text("Price: \(model.unitPriceCents)c")
                                    .font(.callout)
                            }
                        }

                        HStack(spacing: 12) {
                            TextField("Modifier name (optional)", text: $model.modifierName)
                                .padding(10)
                                .fleetFeastFieldBackground(in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                            Stepper(value: $model.modifierPriceCents, in: 0...10_000, step: 25) {
                                Text("+\(model.modifierPriceCents)c")
                                    .font(.callout)
                            }
                        }

                        HStack(spacing: 12) {
                            Button {
                                Task {
                                    await model.createOrder()
                                }
                            } label: {
                                Label("Create", systemImage: "cart.badge.plus")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.isBusy)

                            Button {
                                Task {
                                    await model.refreshOrder()
                                }
                            } label: {
                                Label("Refresh", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(.bordered)
                            .disabled(model.isBusy || model.order == nil)

                            Spacer()

                            if model.isBusy {
                                ProgressView()
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Current")
                            .font(.headline)

                        if let order = model.order {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(order.id)
                                    .font(.callout.monospaced())
                                    .textSelection(.enabled)

                                HStack(spacing: 10) {
                                    Text(order.status)
                                        .font(.subheadline.weight(.semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 4)
                                        .fleetFeastFieldBackground(in: Capsule())

                                    Text("timeline v\(order.timelineVersion)")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } else {
                            Text("No order yet.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
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
            .navigationTitle("FleetFeast")
        }
    }

    @ViewBuilder
    private var baseURLField: some View {
        #if os(iOS)
        TextField("Consumer BFF Base URL", text: $model.baseURLString)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled(true)
            .textContentType(.URL)
            .keyboardType(.URL)
        #else
        TextField("Consumer BFF Base URL", text: $model.baseURLString)
            .autocorrectionDisabled(true)
        #endif
    }

    @ViewBuilder
    private var oidcTokenField: some View {
        #if os(iOS)
        TextField("OIDC token", text: $model.oidcToken)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled(true)
        #else
        TextField("OIDC token", text: $model.oidcToken)
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
        // `Material`/`.thinMaterial` isn't available consistently on macOS SwiftUI targets.
        self.background(Color.secondary.opacity(0.10), in: shape)
        #endif
    }
}
