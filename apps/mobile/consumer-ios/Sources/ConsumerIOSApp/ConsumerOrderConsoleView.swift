import SwiftUI

struct ConsumerOrderConsoleView: View {
    @StateObject private var model = ConsumerOrderConsoleViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                ConsumerPalette.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        heroCard
                        metricsStrip
                        presetSection
                        controlsSection
                        orderSection
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("FleetFeast")
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Consumer Demo")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(1.3)
                        .foregroundStyle(Color.white.opacity(0.78))

                    Text("Order a live meal, then watch the courier handoff land in real time.")
                        .font(.system(size: 31, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.white)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 12)

                if model.isBusy {
                    ProgressView()
                        .tint(.white)
                }
            }

            HStack(spacing: 12) {
                summaryChip(title: model.stageDescriptor.label, value: model.stageDescriptor.persona)
                summaryChip(title: "Draft Total", value: formatCurrency(cents: model.draftTotalCents))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(model.stageDescriptor.headline)
                    .font(.headline)
                    .foregroundStyle(.white)

                Text(model.stageDescriptor.detail)
                    .font(.footnote)
                    .foregroundStyle(Color.white.opacity(0.82))
            }

            ProgressView(value: model.stageDescriptor.progress)
                .tint(.white)
                .progressViewStyle(.linear)

            HStack(spacing: 10) {
                Button {
                    Task {
                        await model.runDemo()
                    }
                } label: {
                    Label("Run Demo", systemImage: "sparkles")
                }
                .buttonStyle(ConsumerPrimaryButtonStyle())
                .disabled(model.isBusy)

                Button {
                    Task {
                        await model.refreshOrder()
                    }
                } label: {
                    Label("Refresh Status", systemImage: "arrow.clockwise")
                }
                .buttonStyle(ConsumerGhostButtonStyle())
                .disabled(model.isBusy || model.order == nil)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [ConsumerPalette.heroStart, ConsumerPalette.heroEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "takeoutbag.and.cup.and.straw.fill")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.14))
                .padding(18)
        }
        .shadow(color: ConsumerPalette.heroStart.opacity(0.22), radius: 22, x: 0, y: 14)
    }

    private var metricsStrip: some View {
        HStack(spacing: 12) {
            metricCard(title: "Session", value: model.session == nil ? "Offline" : model.session?.session.userId ?? "Ready")
            metricCard(title: "Merchant", value: model.merchantId)
            metricCard(title: "Timeline", value: model.order.map { "v\($0.timelineVersion)" } ?? "Not started")
        }
    }

    private var presetSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                eyebrow: "Meal Composer",
                title: "Choose a memorable demo order",
                copy: "Presets keep the walkthrough fast while still posting a real basket through consumer-bff."
            )

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(ConsumerMenuPreset.allCases) { preset in
                        Button {
                            model.applyPreset(preset)
                        } label: {
                            ConsumerPresetCard(
                                preset: preset,
                                isSelected: model.selectedPreset == preset
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var controlsSection: some View {
        VStack(spacing: 14) {
            controlCard(
                eyebrow: "Connection",
                title: "Backend and session",
                content: {
                    VStack(alignment: .leading, spacing: 10) {
                        baseURLField
                            .font(.callout.monospaced())
                            .padding(12)
                            .consumerFieldChrome()

                        oidcTokenField
                            .font(.callout.monospaced())
                            .padding(12)
                            .consumerFieldChrome()

                        HStack(spacing: 10) {
                            Button {
                                Task {
                                    await model.signIn()
                                }
                            } label: {
                                Label("Sign In", systemImage: "person.crop.circle.badge.checkmark")
                            }
                            .buttonStyle(ConsumerPrimaryButtonStyle())
                            .disabled(model.isBusy)

                            Button {
                                Task {
                                    await model.refreshSession()
                                }
                            } label: {
                                Label("Refresh Session", systemImage: "key.horizontal")
                            }
                            .buttonStyle(ConsumerSecondaryButtonStyle())
                            .disabled(model.isBusy || model.session == nil)
                        }

                        if let session = model.session {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Signed in as \(session.session.userId)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(ConsumerPalette.text)

                                Text("Refresh token id: \(session.session.refreshTokenId)")
                                    .font(.caption)
                                    .foregroundStyle(ConsumerPalette.muted)
                            }
                        } else {
                            Text("Default simulator backend: http://127.0.0.1:4101")
                                .font(.caption)
                                .foregroundStyle(ConsumerPalette.muted)
                        }
                    }
                }
            )

            controlCard(
                eyebrow: "Draft",
                title: "Tune the live basket",
                content: {
                    VStack(alignment: .leading, spacing: 12) {
                        TextField("Consumer ID", text: $model.consumerId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(12)
                            .consumerFieldChrome()

                        TextField("Merchant ID", text: $model.merchantId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(12)
                            .consumerFieldChrome()

                        TextField("Item name", text: $model.itemName)
                            .padding(12)
                            .consumerFieldChrome()

                        HStack(spacing: 12) {
                            quantityControl
                            priceControl
                        }

                        HStack(spacing: 12) {
                            TextField("Modifier name", text: $model.modifierName)
                                .padding(12)
                                .consumerFieldChrome()

                            modifierControl
                        }

                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Live basket total")
                                    .font(.caption)
                                    .foregroundStyle(ConsumerPalette.muted)
                                Text(formatCurrency(cents: model.draftTotalCents))
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(ConsumerPalette.text)
                            }

                            Spacer()

                            Button {
                                Task {
                                    await model.createOrder()
                                }
                            } label: {
                                Label("Create Live Order", systemImage: "cart.badge.plus")
                            }
                            .buttonStyle(ConsumerPrimaryButtonStyle())
                            .disabled(model.isBusy)
                        }
                    }
                }
            )
        }
    }

    private var orderSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                eyebrow: "Live Status",
                title: "Present the current handoff",
                copy: "This state comes from the real order timeline. Refresh after merchant and courier actions."
            )

            VStack(alignment: .leading, spacing: 14) {
                if let order = model.order {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(order.id)
                                .font(.headline.monospaced())
                                .foregroundStyle(ConsumerPalette.text)
                                .textSelection(.enabled)

                            Text(model.stageDescriptor.headline)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(ConsumerPalette.text)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 6) {
                            statusCapsule(text: order.status)
                            Text("timeline v\(order.timelineVersion)")
                                .font(.caption)
                                .foregroundStyle(ConsumerPalette.muted)
                        }
                    }

                    ProgressView(value: model.stageDescriptor.progress)
                        .tint(ConsumerPalette.brand)
                        .progressViewStyle(.linear)

                    Text(model.stageDescriptor.detail)
                        .font(.footnote)
                        .foregroundStyle(ConsumerPalette.muted)

                    HStack(spacing: 10) {
                        stageStep(title: "Consumer", isActive: true)
                        stageStep(title: "Merchant", isActive: model.stageDescriptor.progress >= 0.32)
                        stageStep(title: "Dispatch", isActive: model.stageDescriptor.progress >= 0.56)
                        stageStep(title: "Courier", isActive: model.stageDescriptor.progress >= 0.74)
                        stageStep(title: "Delivered", isActive: model.stageDescriptor.progress >= 1.0)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("No order created yet")
                            .font(.headline)
                            .foregroundStyle(ConsumerPalette.text)

                        Text("Pick a preset or adjust the draft, then create a live order to unlock the handoff story.")
                            .font(.footnote)
                            .foregroundStyle(ConsumerPalette.muted)
                    }
                }

                if let error = model.lastError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(ConsumerPalette.error)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(ConsumerPalette.error.opacity(0.08))
                        )
                }
            }
            .padding(18)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(ConsumerPalette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(ConsumerPalette.stroke, lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var quantityControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quantity")
                .font(.caption.weight(.semibold))
                .foregroundStyle(ConsumerPalette.muted)

            Stepper(value: $model.quantity, in: 1...20) {
                Text("\(model.quantity)")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ConsumerPalette.text)
            }
            .padding(12)
            .consumerFieldChrome()
        }
    }

    @ViewBuilder
    private var priceControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Unit price")
                .font(.caption.weight(.semibold))
                .foregroundStyle(ConsumerPalette.muted)

            Stepper(value: $model.unitPriceCents, in: 100...50_000, step: 25) {
                Text(formatCurrency(cents: model.unitPriceCents))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ConsumerPalette.text)
            }
            .padding(12)
            .consumerFieldChrome()
        }
    }

    @ViewBuilder
    private var modifierControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Modifier")
                .font(.caption.weight(.semibold))
                .foregroundStyle(ConsumerPalette.muted)

            Stepper(value: $model.modifierPriceCents, in: 0...10_000, step: 25) {
                Text(formatCurrency(cents: model.modifierPriceCents))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(ConsumerPalette.text)
            }
            .padding(12)
            .consumerFieldChrome()
        }
    }

    @ViewBuilder
    private func controlCard<Content: View>(
        eyebrow: String,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(eyebrow)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(ConsumerPalette.brand)

            Text(title)
                .font(.title3.weight(.bold))
                .foregroundStyle(ConsumerPalette.text)

            content()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(ConsumerPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(ConsumerPalette.stroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func sectionHeader(eyebrow: String, title: String, copy: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(ConsumerPalette.brand)

            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(ConsumerPalette.text)

            Text(copy)
                .font(.footnote)
                .foregroundStyle(ConsumerPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(ConsumerPalette.muted)

            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(ConsumerPalette.text)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(ConsumerPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(ConsumerPalette.stroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func summaryChip(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.white.opacity(0.72))
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.14))
        )
    }

    @ViewBuilder
    private func statusCapsule(text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(ConsumerPalette.brand.opacity(0.14))
            )
            .foregroundStyle(ConsumerPalette.brand)
    }

    @ViewBuilder
    private func stageStep(title: String, isActive: Bool) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(isActive ? ConsumerPalette.accent.opacity(0.18) : ConsumerPalette.stroke)
            )
            .foregroundStyle(isActive ? ConsumerPalette.accent : ConsumerPalette.muted)
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

private enum ConsumerPalette {
    static let background = Color(red: 0.97, green: 0.94, blue: 0.89)
    static let surface = Color(red: 1.0, green: 0.98, blue: 0.95)
    static let surfaceSelected = Color(red: 1.0, green: 0.94, blue: 0.88)
    static let text = Color(red: 0.16, green: 0.19, blue: 0.15)
    static let muted = Color(red: 0.43, green: 0.45, blue: 0.39)
    static let stroke = Color(red: 0.88, green: 0.83, blue: 0.76)
    static let brand = Color(red: 0.91, green: 0.37, blue: 0.17)
    static let accent = Color(red: 0.19, green: 0.42, blue: 0.29)
    static let heroStart = Color(red: 0.93, green: 0.43, blue: 0.18)
    static let heroEnd = Color(red: 0.77, green: 0.22, blue: 0.15)
    static let error = Color(red: 0.74, green: 0.12, blue: 0.18)
}

private struct ConsumerPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(ConsumerPalette.text.opacity(configuration.isPressed ? 0.85 : 1.0))
            )
    }
}

private struct ConsumerPresetCard: View {
    let preset: ConsumerMenuPreset
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(preset.badge)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(ConsumerPalette.accent.opacity(0.18))
                    )
                    .foregroundStyle(ConsumerPalette.accent)

                Spacer()

                Image(systemName: preset.symbolName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(ConsumerPalette.brand)
            }

            Text(preset.title)
                .font(.headline)
                .foregroundStyle(ConsumerPalette.text)

            Text(preset.subtitle)
                .font(.footnote)
                .foregroundStyle(ConsumerPalette.muted)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 4)

            HStack {
                Text(formatCurrency(cents: preset.unitPriceCents + preset.modifierPriceCents))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(ConsumerPalette.text)

                Spacer()

                if isSelected {
                    Label("Selected", systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ConsumerPalette.brand)
                }
            }
        }
        .frame(width: 220, alignment: .topLeading)
        .frame(minHeight: 190, alignment: .topLeading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(isSelected ? ConsumerPalette.surfaceSelected : ConsumerPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(isSelected ? ConsumerPalette.brand : ConsumerPalette.stroke, lineWidth: 1)
        )
    }
}

private struct ConsumerSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(ConsumerPalette.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(ConsumerPalette.surfaceSelected.opacity(configuration.isPressed ? 0.72 : 1.0))
            )
    }
}

private struct ConsumerGhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(Color.white.opacity(configuration.isPressed ? 0.18 : 0.12))
            )
            .overlay(
                Capsule()
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
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

    func consumerFieldChrome() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.94))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ConsumerPalette.stroke, lineWidth: 1)
            )
    }
}
