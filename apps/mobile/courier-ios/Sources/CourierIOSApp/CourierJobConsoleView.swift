import SwiftUI

struct CourierJobConsoleView: View {
    @StateObject private var model = CourierJobConsoleViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                CourierPalette.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        heroCard
                        metricsStrip
                        controlsSection
                        jobsSection
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("Courier")
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Courier Demo")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(1.3)
                        .foregroundStyle(Color.white.opacity(0.78))

                    Text("Keep one job in focus and drive the final mile with clear action states.")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 12)

                if model.isBusy {
                    ProgressView()
                        .tint(.white)
                }
            }

            HStack(spacing: 12) {
                heroChip(title: model.focusDescriptor.label, value: model.focusDescriptor.persona)
                heroChip(title: "Courier", value: model.courierId)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(model.focusDescriptor.headline)
                    .font(.headline)
                    .foregroundStyle(.white)

                Text(model.focusDescriptor.detail)
                    .font(.footnote)
                    .foregroundStyle(Color.white.opacity(0.82))
            }

            ProgressView(value: model.focusDescriptor.progress)
                .tint(.white)
                .progressViewStyle(.linear)

            HStack(spacing: 10) {
                Button {
                    Task {
                        await model.runDemo()
                    }
                } label: {
                    Label("Run Demo", systemImage: "bolt.fill")
                }
                .buttonStyle(CourierPrimaryButtonStyle())
                .disabled(model.isBusy)

                Button {
                    Task {
                        await model.loadJobs()
                    }
                } label: {
                    Label("Reload Jobs", systemImage: "arrow.clockwise")
                }
                .buttonStyle(CourierGhostButtonStyle())
                .disabled(model.isBusy)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [CourierPalette.heroStart, CourierPalette.heroEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "bicycle.circle.fill")
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.14))
                .padding(18)
        }
        .shadow(color: CourierPalette.heroEnd.opacity(0.24), radius: 22, x: 0, y: 14)
    }

    private var metricsStrip: some View {
        HStack(spacing: 12) {
            metricCard(title: "Active", value: "\(model.jobs.filter { ["ASSIGNED", "ACCEPTED", "PICKED_UP"].contains($0.status) }.count)")
            metricCard(title: "Queued", value: "\(model.jobs.filter { $0.status == "AVAILABLE" }.count)")
            metricCard(title: "Delivered", value: "\(model.jobs.filter { ["DELIVERED", "DROPPED_OFF"].contains($0.status) }.count)")
        }
    }

    private var controlsSection: some View {
        VStack(spacing: 14) {
            panelCard(
                eyebrow: "Connection",
                title: "Backend and session",
                content: {
                    VStack(alignment: .leading, spacing: 10) {
                        baseURLField
                            .font(.callout.monospaced())
                            .padding(12)
                            .courierFieldChrome()

                        oidcTokenField
                            .font(.callout.monospaced())
                            .padding(12)
                            .courierFieldChrome()

                        TextField("Courier ID", text: $model.courierId)
                            .fleetFeastTextInputAutocapitalizationNever()
                            .autocorrectionDisabled(true)
                            .padding(12)
                            .courierFieldChrome()

                        HStack(spacing: 10) {
                            Button {
                                Task {
                                    await model.signIn()
                                }
                            } label: {
                                Label("Sign In", systemImage: "person.crop.circle.badge.checkmark")
                            }
                            .buttonStyle(CourierPrimaryButtonStyle())
                            .disabled(model.isBusy)

                            Button {
                                Task {
                                    await model.refreshSession()
                                }
                            } label: {
                                Label("Refresh Session", systemImage: "key.horizontal")
                            }
                            .buttonStyle(CourierSecondaryButtonStyle())
                            .disabled(model.isBusy || model.session == nil)
                        }

                        if let session = model.session {
                            Text("Signed in as \(session.session.userId)")
                                .font(.caption)
                                .foregroundStyle(CourierPalette.muted)
                        } else {
                            Text("Default simulator backend: http://127.0.0.1:4102")
                                .font(.caption)
                                .foregroundStyle(CourierPalette.muted)
                        }
                    }
                }
            )

            if let focusJob = model.focusJob {
                panelCard(
                    eyebrow: "Focus Job",
                    title: focusJob.jobId,
                    content: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Order \(focusJob.orderId)")
                                        .font(.headline)
                                        .foregroundStyle(CourierPalette.text)

                                    Text(model.focusDescriptor.headline)
                                        .font(.footnote)
                                        .foregroundStyle(CourierPalette.muted)
                                }

                                Spacer()

                                statusCapsule(text: focusJob.status)
                            }

                            actionRow(for: focusJob)
                        }
                    }
                )
            }
        }
    }

    private var jobsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                eyebrow: "Job Queue",
                title: "Run the live courier board",
                copy: "Accept, pickup, and dropoff still hit the real courier-bff routes. The UI now keeps the highest-value job at the top of the story."
            )

            if model.jobs.isEmpty {
                panelCard(
                    eyebrow: "Queue Empty",
                    title: "No jobs loaded yet",
                    content: {
                        Text("Request dispatch from the merchant demo, then reload the courier board.")
                            .font(.footnote)
                            .foregroundStyle(CourierPalette.muted)
                    }
                )
            } else {
                VStack(spacing: 12) {
                    ForEach(model.jobs, id: \.jobId) { job in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(job.jobId)
                                        .font(.system(.headline, design: .monospaced))
                                        .foregroundStyle(CourierPalette.text)
                                        .textSelection(.enabled)

                                    Text("Order \(job.orderId)")
                                        .font(.caption)
                                        .foregroundStyle(CourierPalette.muted)
                                }

                                Spacer()

                                statusCapsule(text: job.status)
                            }

                            if job.jobId == model.focusJob?.jobId {
                                Text(model.focusDescriptor.detail)
                                    .font(.footnote)
                                    .foregroundStyle(CourierPalette.muted)
                            }

                            actionRow(for: job)
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 26, style: .continuous)
                                .fill(job.jobId == model.focusJob?.jobId ? CourierPalette.surfaceSelected : CourierPalette.surface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 26, style: .continuous)
                                .stroke(job.jobId == model.focusJob?.jobId ? CourierPalette.brand : CourierPalette.stroke, lineWidth: 1)
                        )
                    }
                }
            }

            if let error = model.lastError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(CourierPalette.error)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(CourierPalette.error.opacity(0.08))
                    )
            }
        }
    }

    @ViewBuilder
    private func actionRow(for job: CourierJob) -> some View {
        HStack(spacing: 10) {
            Button("Accept") {
                Task {
                    await model.accept(jobId: job.jobId)
                }
            }
            .buttonStyle(CourierPrimaryButtonStyle())
            .disabled(model.isBusy || !canAccept(job.status))

            Button("Pickup") {
                Task {
                    await model.pickup(jobId: job.jobId)
                }
            }
            .buttonStyle(CourierSecondaryButtonStyle())
            .disabled(model.isBusy || !canPickup(job.status))

            Button("Dropoff") {
                Task {
                    await model.dropoff(jobId: job.jobId)
                }
            }
            .buttonStyle(CourierSecondaryButtonStyle())
            .disabled(model.isBusy || !canDropoff(job.status))
        }
    }

    private func canAccept(_ status: String) -> Bool {
        status == "AVAILABLE"
    }

    private func canPickup(_ status: String) -> Bool {
        status == "ASSIGNED" || status == "ACCEPTED"
    }

    private func canDropoff(_ status: String) -> Bool {
        status == "PICKED_UP"
    }

    @ViewBuilder
    private func panelCard<Content: View>(
        eyebrow: String,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(eyebrow)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(CourierPalette.brand)

            Text(title)
                .font(.title3.weight(.bold))
                .foregroundStyle(CourierPalette.text)

            content()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(CourierPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(CourierPalette.stroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func sectionHeader(eyebrow: String, title: String, copy: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .tracking(1.1)
                .foregroundStyle(CourierPalette.brand)

            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(CourierPalette.text)

            Text(copy)
                .font(.footnote)
                .foregroundStyle(CourierPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(CourierPalette.muted)

            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(CourierPalette.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(CourierPalette.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(CourierPalette.stroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func heroChip(title: String, value: String) -> some View {
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
                .fill(Color.white.opacity(0.12))
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
                    .fill(CourierPalette.brand.opacity(0.14))
            )
            .foregroundStyle(CourierPalette.brand)
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

private enum CourierPalette {
    static let background = Color(red: 0.93, green: 0.95, blue: 0.92)
    static let surface = Color(red: 0.98, green: 0.99, blue: 0.97)
    static let surfaceSelected = Color(red: 0.92, green: 0.97, blue: 0.93)
    static let text = Color(red: 0.12, green: 0.17, blue: 0.15)
    static let muted = Color(red: 0.39, green: 0.44, blue: 0.41)
    static let stroke = Color(red: 0.8, green: 0.85, blue: 0.8)
    static let brand = Color(red: 0.18, green: 0.49, blue: 0.31)
    static let heroStart = Color(red: 0.16, green: 0.39, blue: 0.28)
    static let heroEnd = Color(red: 0.07, green: 0.22, blue: 0.18)
    static let error = Color(red: 0.74, green: 0.12, blue: 0.18)
}

private struct CourierPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(CourierPalette.brand.opacity(configuration.isPressed ? 0.82 : 1.0))
            )
    }
}

private struct CourierSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CourierPalette.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(CourierPalette.surfaceSelected.opacity(configuration.isPressed ? 0.72 : 1.0))
            )
    }
}

private struct CourierGhostButtonStyle: ButtonStyle {
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

    func courierFieldChrome() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.95))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(CourierPalette.stroke, lineWidth: 1)
            )
    }
}
