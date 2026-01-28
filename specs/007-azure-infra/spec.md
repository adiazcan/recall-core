# Feature Specification: Azure Infrastructure Landing Zone

**Feature Branch**: `007-azure-infra`  
**Created**: 2026-01-28  
**Status**: Draft  
**Input**: User description: "Azure infrastructure spec (ACA API + Static Web App Frontend + Storage + Azure DocumentDB (MongoDB) + App Insights (OpenTelemetry) + Storage Queue)"

## Overview

This specification defines the Azure infrastructure required to deploy and run recall-core in the cloud. The infrastructure supports a containerized .NET Minimal API backend, a React SPA frontend, MongoDB-compatible persistence, queue-based messaging for background work, and centralized observability via Application Insights.

The goal is a **single-command deployment** per environment (dev/prod) using Infrastructure as Code, with secure defaults and minimal operational complexity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Infrastructure Deployment (Priority: P1)

As a **DevOps engineer**, I want to provision all Azure resources for an environment with a single command so that I can quickly set up or recreate environments without manual steps.

**Why this priority**: This is the foundation—without automated provisioning, no other feature can be deployed or tested consistently.

**Independent Test**: Run the deployment command against a new resource group and verify all resources are created with correct configuration.

**Acceptance Scenarios**:

1. **Given** valid Azure credentials and environment parameters, **When** I run the provisioning command, **Then** all required Azure resources are created in under 20 minutes.
2. **Given** an existing environment with identical parameters, **When** I run the provisioning command again, **Then** the deployment completes idempotently without errors or unnecessary changes.
3. **Given** invalid parameters (e.g., missing required values), **When** I run the provisioning command, **Then** the deployment fails with a clear error message before creating any resources.

---

### User Story 2 - API Deployment to Azure Container Apps (Priority: P1)

As a **developer**, I want the API to be deployed to Azure Container Apps and accessible via HTTPS so that the backend is running in a scalable, managed container environment.

**Why this priority**: The API is the core service that all other components depend on (frontend, enrichment jobs).

**Independent Test**: Deploy only the API container to ACA and verify it responds to health check requests.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the API container is deployed, **Then** the API health endpoint returns HTTP 200 within 60 seconds.
2. **Given** the API is deployed, **When** I access the API's public URL, **Then** HTTPS is enforced and the connection is secure.
3. **Given** the API requires scaling, **When** traffic increases, **Then** ACA scales the API replicas according to configured rules.

---

### User Story 3 - Frontend Deployment to Static Web Apps (Priority: P1)

As a **user**, I want the web application available via a public URL so that I can access the recall-core interface from my browser.

**Why this priority**: Users interact primarily through the frontend; it must be deployable and integrated with the API.

**Independent Test**: Deploy the SWA and verify the application loads in a browser.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the frontend is deployed to SWA, **Then** the application loads successfully in a browser.
2. **Given** the frontend is deployed, **When** the frontend calls the API, **Then** requests succeed without CORS errors (via linked backend or configuration).
3. **Given** the SWA is deployed, **When** I access it via HTTP, **Then** the connection is automatically upgraded to HTTPS.

---

### User Story 4 - Database Connectivity (Priority: P1)

As a **developer**, I want the API to connect to Azure DocumentDB (MongoDB-compatible) so that data persists across deployments.

**Why this priority**: Without database connectivity, the API cannot store or retrieve any data.

**Independent Test**: Deploy the API and verify it can write and read a document from DocumentDB.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the API starts, **Then** it establishes a connection to DocumentDB within 30 seconds.
2. **Given** the API is connected to DocumentDB, **When** a document is created, **Then** it persists and is retrievable after API restart.
3. **Given** DocumentDB credentials are rotated, **When** the credential rotation process completes, **Then** the API reconnects without downtime (using connection string refresh or managed identity).

---

### User Story 5 - Storage Queue Messaging (Priority: P2)

As a **developer**, I want background jobs to receive messages from Azure Storage Queue so that asynchronous work (enrichment) can be processed reliably.

**Why this priority**: Enrichment is important but not blocking for MVP—users can still save and retrieve items without it.

**Independent Test**: Send a message to the queue and verify the enrichment worker processes it.

**Acceptance Scenarios**:

1. **Given** the API publishes a message to the Storage Queue, **When** the enrichment worker polls the queue, **Then** the message is received within 30 seconds.
2. **Given** a message is processed successfully, **When** processing completes, **Then** the message is deleted from the queue.
3. **Given** a message processing fails, **When** the failure occurs, **Then** the message is returned to the queue for retry (up to configured max attempts).

---

### User Story 6 - Blob Storage for Assets (Priority: P2)

As a **developer**, I want the API to store and retrieve thumbnails from Azure Blob Storage so that enriched content assets persist durably.

**Why this priority**: Thumbnails enhance UX but are not critical for core functionality.

**Independent Test**: Upload a blob via the API and verify it can be retrieved.

**Acceptance Scenarios**:

1. **Given** the API has managed identity access to Blob Storage, **When** a thumbnail is uploaded, **Then** it is stored in the configured container.
2. **Given** a thumbnail exists in Blob Storage, **When** requested, **Then** it is retrievable via a time-limited SAS URL or direct access.

---

### User Story 7 - Observability via Application Insights (Priority: P2)

As an **operations engineer**, I want to view traces, metrics, and logs in Application Insights so that I can monitor and troubleshoot the system.

**Why this priority**: Observability is critical for production readiness but not required for initial deployment validation.

**Independent Test**: Make API requests and verify traces appear in Application Insights within 5 minutes.

**Acceptance Scenarios**:

1. **Given** the API sends OpenTelemetry data, **When** I open Application Insights, **Then** I see distributed traces for API requests.
2. **Given** the enrichment worker logs events, **When** I query Application Insights logs, **Then** I see log entries with correlation IDs.
3. **Given** an error occurs in the API, **When** I search Application Insights, **Then** I find the exception with full stack trace and request context.

---

### User Story 8 - CI/CD Workflow Deployment (Priority: P2)

As a **DevOps engineer**, I want GitHub Actions workflows to deploy infrastructure and applications so that deployments are automated and repeatable.

**Why this priority**: Manual deployments are error-prone; automation ensures consistency across environments.

**Independent Test**: Trigger the deployment workflow and verify resources are provisioned.

**Acceptance Scenarios**:

1. **Given** code is pushed to the main branch, **When** the deployment workflow runs, **Then** infrastructure changes are applied and applications are deployed.
2. **Given** the workflow runs for the dev environment, **When** triggered with prod parameters, **Then** it deploys to the prod environment with prod-specific configuration.
3. **Given** a deployment fails, **When** I check the workflow logs, **Then** I can identify the failure cause and remediate.

---

### Edge Cases

- What happens when Azure DocumentDB is temporarily unavailable? API should fail health checks and report degraded status.
- How does the system handle Storage Queue message processing timeouts? Messages should return to queue after visibility timeout.
- What happens when Application Insights ingestion is throttled? OpenTelemetry SDK should buffer and retry.
- What if SWA-to-API linked backend configuration fails? Fallback to CORS configuration documented.
- How are failed deployments rolled back? Documented rollback procedure in runbook.

## Requirements *(mandatory)*

### Functional Requirements

#### Resource Provisioning

- **FR-001**: System MUST provision a dedicated resource group per environment (dev/prod) with consistent naming.
- **FR-002**: System MUST create all resources in a single Azure region per environment (region documented and parameterized).
- **FR-003**: System MUST use a documented naming convention: `{project}-{resource-type}-{environment}` (e.g., `recall-aca-dev`).

#### Compute - Azure Container Apps

- **FR-004**: System MUST provision an Azure Container Apps environment with managed networking.
- **FR-005**: System MUST deploy the API as a Container App with HTTPS ingress enabled.
- **FR-006**: System MUST deploy the Enrichment worker as a Container App with queue-based scaling.
- **FR-007**: System MUST configure managed identity for Container Apps to access other Azure resources.

#### Frontend - Azure Static Web Apps

- **FR-008**: System MUST provision an Azure Static Web App resource for the React frontend.
- **FR-009**: System MUST configure the SWA to route API calls to the Container Apps API backend (via linked backend or CORS configuration).

#### Data - Azure DocumentDB (MongoDB-compatible)

- **FR-010**: System MUST provision an Azure DocumentDB account with MongoDB API compatibility.
- **FR-011**: System MUST create the required database during provisioning; MongoDB collections MUST be created by the application on first use (not via Terraform).
- **FR-012**: System MUST provide connection credentials securely to the API (via Key Vault or managed identity).

#### Storage - Azure Storage Account

- **FR-013**: System MUST provision an Azure Storage Account per environment.
- **FR-014**: System MUST create a blob container named `thumbnails` for asset storage.
- **FR-015**: System MUST create a Storage Queue named `enrichment-queue` for messaging.
- **FR-016**: System MUST configure managed identity access from Container Apps to Storage Account.

#### Observability - Application Insights

- **FR-017**: System MUST provision a workspace-based Application Insights resource.
- **FR-018**: System MUST configure the API to export OpenTelemetry traces, metrics, and logs to Application Insights.
- **FR-019**: System MUST configure the Enrichment worker to export logs to Application Insights.

#### Security

- **FR-020**: System MUST use managed identities for service-to-service authentication where supported.
- **FR-021**: System MUST store sensitive configuration (connection strings, keys) in Azure Key Vault.
- **FR-022**: System MUST enforce HTTPS for all public endpoints.
- **FR-023**: System MUST restrict network access to secure defaults (no public endpoints for DocumentDB unless required).

#### CI/CD

- **FR-024**: System MUST provide GitHub Actions workflow(s) for infrastructure provisioning.
- **FR-025**: System MUST provide GitHub Actions workflow(s) for application deployment.
- **FR-026**: System MUST support parameterized deployment for dev and prod environments.

#### Documentation

- **FR-027**: System MUST include a runbook documenting: deployment, secret rotation, monitoring, and troubleshooting.
- **FR-028**: System MUST document the naming convention and resource topology.

### Non-Functional Requirements

- **NFR-001**: Infrastructure provisioning MUST complete in under 20 minutes for a fresh environment.
- **NFR-002**: IaC MUST be idempotent—running the same deployment twice produces no changes.
- **NFR-003**: IaC MUST use Bicep or Terraform (team's existing preference if any, otherwise Bicep as Azure-native).

### Key Entities

- **Resource Group**: Logical container for all environment resources; one per environment.
- **Container Apps Environment**: Shared compute environment for API and Enrichment containers.
- **Container App (API)**: The .NET Minimal API backend container.
- **Container App (Enrichment)**: The background worker container for async processing.
- **Static Web App**: The React SPA frontend host.
- **DocumentDB Account**: MongoDB-compatible database for persistence.
- **Storage Account**: Blob and Queue storage for assets and messaging.
- **Application Insights**: Observability destination for traces, metrics, logs.
- **Key Vault**: Secure storage for connection strings and secrets.
- **Log Analytics Workspace**: Backend for Application Insights data storage.

### Excluded from Scope

- Multi-region active-active replication
- Advanced WAF or CDN configuration
- Private Link for all services (secure defaults only)
- Azure API Management (APIM)
- VNet integration (unless required by secure defaults)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new environment (all resources) is provisioned with a single command in under 20 minutes.
- **SC-002**: Re-running the deployment on an unchanged environment completes with zero resource changes.
- **SC-003**: The API health endpoint responds with HTTP 200 within 2 minutes of deployment.
- **SC-004**: The frontend application loads in a browser within 2 minutes of deployment.
- **SC-005**: API calls from the frontend to the backend succeed without CORS errors.
- **SC-006**: A document written to DocumentDB via the API persists and is retrievable after API restart.
- **SC-007**: A message sent to Storage Queue is processed by the Enrichment worker within 60 seconds.
- **SC-008**: API request traces appear in Application Insights within 5 minutes of the request.
- **SC-009**: GitHub Actions workflow successfully deploys both dev and prod environments when triggered.
- **SC-010**: Runbook documentation covers deployment, secret rotation, monitoring, and troubleshooting procedures.

## Assumptions

- Team has Azure subscription(s) with sufficient permissions to create resource groups and all resource types.
- GitHub Actions has federated identity or service principal configured for Azure deployment.
- The existing .NET API and React frontend are containerized or ready to be deployed to their respective targets.
- Entra ID authentication configuration is handled separately (spec 004); this spec focuses on infrastructure only.
- Development environment may use lower SKUs/tiers to reduce cost; production uses recommended tiers for reliability.

## Dependencies

- **Spec 004 (Entra External Auth)**: Authentication configuration for the API.
- **Spec 005 (Bookmark Enrichment)**: Defines the enrichment worker logic that runs on the infrastructure.
- Azure subscription with Contributor role or equivalent.
- GitHub repository with Actions enabled.

## Risk Considerations

- **DocumentDB availability**: New accounts may take up to 10 minutes to provision; factor into deployment time budget.
- **SWA linked backend limitations**: If linked backend doesn't support all scenarios, CORS fallback must be documented.
- **Cost management**: Production tiers (DocumentDB, ACA) can accumulate costs; monitoring and alerts should be configured.
