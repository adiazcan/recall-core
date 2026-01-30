# Feature Specification: Azure Infrastructure Landing Zone

**Feature Branch**: `007-infra-azure`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: User description: "Azure infrastructure spec (ACA API + Static Web App Frontend + Storage + Azure DocumentDB (MongoDB) + App Insights (OpenTelemetry) + Storage Queue)"

## Overview

This specification defines the Azure infrastructure required to deploy and run recall-core in the cloud. The infrastructure supports:

- **Backend**: Containerized .NET Minimal API secured with Entra authentication
- **Frontend**: React SPA hosted on Azure Static Web Apps
- **Messaging**: Azure Storage Queue for background work/enrichment processing
- **Data**: Azure DocumentDB (MongoDB-compatible) for persistence
- **Observability**: OpenTelemetry traces, metrics, and logs shipped to Application Insights

The goal is a **single-command deployment** per environment (dev/prod) using Bicep Infrastructure as Code, with secure defaults and minimal operational complexity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Infrastructure Deployment (Priority: P1)

As a **DevOps engineer**, I want to provision all Azure resources for an environment with a single command so that I can quickly set up or recreate environments without manual steps.

**Why this priority**: This is the foundation—without automated provisioning, no other feature can be deployed or tested consistently.

**Independent Test**: Run the Bicep deployment command against a new resource group and verify all resources are created with correct configuration.

**Acceptance Scenarios**:

1. **Given** valid Azure credentials and environment parameters, **When** I run the provisioning command, **Then** all required Azure resources are created in under 20 minutes.
2. **Given** an existing environment with identical parameters, **When** I run the provisioning command again, **Then** the deployment completes idempotently without errors or unnecessary changes.
3. **Given** invalid parameters (missing required values), **When** I run the provisioning command, **Then** the deployment fails with a clear error message before creating any resources.

---

### User Story 2 - API Deployment to Azure Container Apps (Priority: P1)

As a **developer**, I want the API to be deployed to Azure Container Apps and accessible via HTTPS so that the backend runs in a scalable, managed container environment.

**Why this priority**: The API is the core service that all other components depend on (frontend, enrichment jobs).

**Independent Test**: Deploy only the API container to ACA and verify it responds to health check requests at the `/health` endpoint.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the API container is deployed, **Then** the API health endpoint returns HTTP 200 within 60 seconds.
2. **Given** the API is deployed, **When** I access the API's public URL, **Then** HTTPS is enforced and the connection is secure.
3. **Given** the API requires scaling, **When** traffic increases, **Then** ACA scales the API replicas according to configured rules.
4. **Given** the API container app, **When** it starts, **Then** it retrieves configuration from App Configuration and secrets from Key Vault via managed identity.

---

### User Story 3 - Frontend Deployment to Static Web Apps (Priority: P1)

As a **user**, I want the web application available via a public URL so that I can access the recall-core interface from my browser.

**Why this priority**: Users interact primarily through the frontend; it must be deployable and integrated with the API.

**Independent Test**: Deploy the SWA and verify the application loads in a browser and can call the API.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the frontend is deployed to SWA, **Then** the application loads successfully in a browser.
2. **Given** the SWA is linked to the Container App backend, **When** the frontend calls `/api/*`, **Then** requests are routed to the ACA backend without CORS errors.
3. **Given** the SWA is deployed, **When** I access it via HTTP, **Then** the connection is automatically upgraded to HTTPS.
4. **Given** the SWA linked backend is not feasible, **When** using a separate domain, **Then** CORS is properly configured on the API as a documented fallback.

---

### User Story 4 - Database Connectivity (Priority: P1)

As a **developer**, I want the API to connect to Azure DocumentDB (MongoDB-compatible) so that data persists across deployments.

**Why this priority**: Without database connectivity, the API cannot store or retrieve any data.

**Independent Test**: Deploy the API and verify it can write and read a document from DocumentDB.

**Acceptance Scenarios**:

1. **Given** the infrastructure is provisioned, **When** the API starts, **Then** it establishes a connection to DocumentDB within 30 seconds.
2. **Given** the API is connected to DocumentDB, **When** a document is created, **Then** it persists and is retrievable after API restart.
3. **Given** DocumentDB connection string is stored in Key Vault, **When** the API starts, **Then** it retrieves the connection string securely via managed identity.

---

### User Story 5 - Storage Queue Messaging with Event-Driven Job (Priority: P2)

As a **developer**, I want background jobs triggered by Azure Storage Queue messages so that asynchronous work (enrichment) is processed reliably and cost-effectively.

**Why this priority**: Enrichment is important but not blocking for MVP—users can still save and retrieve items without it.

**Independent Test**: Send a message to the queue and verify the Container Apps Job processes it.

**Acceptance Scenarios**:

1. **Given** the API publishes a message to the Storage Queue, **When** the Container Apps Job is triggered, **Then** the message is received and processed within 60 seconds.
2. **Given** a message is processed successfully, **When** processing completes, **Then** the message is deleted from the queue.
3. **Given** a message processing fails, **When** the failure occurs, **Then** the message is returned to the queue for retry (up to configured max attempts).
4. **Given** the queue is empty, **When** no messages arrive, **Then** the Container Apps Job scales to zero and incurs no compute costs.

---

### User Story 6 - Blob Storage for Assets (Priority: P2)

As a **developer**, I want the API to store and retrieve thumbnails from Azure Blob Storage so that enriched content assets persist durably.

**Why this priority**: Thumbnails enhance UX but are not critical for core functionality.

**Independent Test**: Upload a blob via the API and verify it can be retrieved.

**Acceptance Scenarios**:

1. **Given** the API has managed identity access to Blob Storage, **When** a thumbnail is uploaded, **Then** it is stored in the `thumbnails` container.
2. **Given** a thumbnail exists in Blob Storage, **When** requested, **Then** it is retrievable via a time-limited SAS URL or direct access (depending on implementation).

---

### User Story 7 - Observability via Application Insights (Priority: P2)

As an **operations engineer**, I want to view traces, metrics, and logs in Application Insights so that I can monitor and troubleshoot the system.

**Why this priority**: Observability is critical for production readiness but not required for initial deployment validation.

**Independent Test**: Make API requests and verify traces appear in Application Insights within 5 minutes.

**Acceptance Scenarios**:

1. **Given** the API sends OpenTelemetry data, **When** I open Application Insights, **Then** I see distributed traces for API requests.
2. **Given** the enrichment job logs events, **When** I query Application Insights logs, **Then** I see log entries with correlation IDs.
3. **Given** an error occurs in the API, **When** I search Application Insights, **Then** I find the exception with full stack trace and request context.
4. **Given** basic alerts are configured, **When** error rate exceeds threshold, **Then** an alert is triggered.

---

### User Story 8 - CI/CD Workflow Deployment (Priority: P2)

As a **DevOps engineer**, I want GitHub Actions workflows to deploy infrastructure and applications so that deployments are automated and repeatable.

**Why this priority**: Manual deployments are error-prone; automation ensures consistency across environments.

**Independent Test**: Trigger the deployment workflow and verify resources are provisioned.

**Acceptance Scenarios**:

1. **Given** the infrastructure workflow is triggered, **When** manual approval is granted, **Then** infrastructure changes are applied to the specified environment.
2. **Given** the API deployment workflow runs, **When** triggered with environment parameters, **Then** the API image is built, pushed to ACR, and deployed to ACA.
3. **Given** the frontend workflow runs, **When** triggered, **Then** the React app is built and deployed to SWA.
4. **Given** a deployment fails, **When** I check the workflow logs, **Then** I can identify the failure cause and remediate.

---

### Edge Cases

- **DocumentDB unavailability**: API should fail health checks and report degraded status; startup should retry with exponential backoff.
- **Storage Queue message timeout**: Messages should return to queue after visibility timeout; poison messages go to dead-letter after max retries.
- **Application Insights throttling**: OpenTelemetry SDK should buffer and retry; no data loss for transient throttling.
- **SWA linked backend failure**: If linked backend configuration fails, fallback to CORS configuration is documented in runbook.
- **Container Apps Job stuck**: Jobs have configured timeout; failed executions are logged and alerted.
- **Key Vault access denied**: Clear error surfaced in logs; managed identity permissions documented in runbook.

## Requirements *(mandatory)*

### Functional Requirements

#### Resource Topology (Baseline)

- **FR-001**: System MUST provision a dedicated resource group per environment (dev/prod) with the naming pattern `rg-recall-{env}`.
- **FR-002**: System MUST deploy all resources in a configurable Azure region (default: West Europe for dev, West Europe for prod).
- **FR-003**: System MUST use documented naming convention: `{resource-abbrev}-recall-{env}` (e.g., `aca-recall-dev`, `kv-recall-prod`).

#### Azure Container Apps Environment

- **FR-004**: System MUST provision an Azure Container Apps environment with Log Analytics workspace integration.
- **FR-005**: System MUST provision an Azure Container Registry (ACR) for storing container images.

#### Container App: recall-api

- **FR-006**: System MUST deploy the API as a Container App with HTTPS ingress enabled and external traffic allowed.
- **FR-007**: System MUST configure the API Container App with revision mode (single or multiple based on environment).
- **FR-008**: System MUST enable managed identity on the API Container App.
- **FR-009**: System MUST configure scale rules for the API (min: 1 for prod, min: 0 for dev; max configurable).
- **FR-010**: System MUST configure the API to retrieve secrets via Key Vault references.
- **FR-011**: System MUST configure the API to retrieve app settings from Azure App Configuration.

#### Azure Static Web App: recall-web

- **FR-012**: System MUST provision an Azure Static Web App resource for the React frontend.
- **FR-013**: System MUST configure SWA to build and deploy from the GitHub repository.
- **FR-014**: System MUST configure SWA to route `/api/*` requests to the Container App backend via linked backend (preferred) or document CORS fallback.
- **FR-015**: If linked backend is used, the `/api` prefix routing must comply with SWA constraints.

#### Azure Storage Account

- **FR-016**: System MUST provision an Azure Storage Account per environment with the naming pattern `strecall{env}` (no hyphens).
- **FR-017**: System MUST create a blob container named `thumbnails` with private access.
- **FR-018**: System MUST create a Storage Queue named `enrichment-queue` for messaging.
- **FR-019**: System MUST configure RBAC roles for managed identity access from Container Apps to Storage (Blob Data Contributor, Queue Data Contributor).

#### Azure DocumentDB (MongoDB-compatible)

- **FR-020**: System MUST provision an Azure DocumentDB account (vCore-based Azure Cosmos DB for MongoDB).
- **FR-021**: System MUST create the database named `recall` during provisioning.
- **FR-022**: MongoDB collections MUST be created by the application on first use (not via Bicep).
- **FR-023**: System MUST store DocumentDB connection string in Key Vault.

#### Application Insights + Log Analytics

- **FR-024**: System MUST provision a workspace-based Application Insights resource.
- **FR-025**: System MUST provision a Log Analytics workspace for Container Apps and Application Insights.
- **FR-026**: System MUST configure the API to export OpenTelemetry traces, metrics, and logs to Application Insights.
- **FR-027**: System MUST configure the enrichment job to export logs to Application Insights.
- **FR-028**: System SHOULD configure basic alerts for error rate, request latency, dependency failures, and job failures.

#### Azure Key Vault

- **FR-029**: System MUST provision an Azure Key Vault per environment.
- **FR-030**: System MUST store DocumentDB connection string in Key Vault.
- **FR-031**: System MUST store any OAuth/Entra app secrets in Key Vault.
- **FR-032**: System MUST configure RBAC permissions for managed identities (Key Vault Secrets User role).

#### Azure App Configuration

- **FR-033**: System MUST provision an Azure App Configuration resource per environment.
- **FR-034**: System MUST store non-secret app settings (endpoints, tenant IDs, feature flags) in App Configuration.
- **FR-035**: System MUST grant App Configuration Data Reader role to Container App managed identities.

#### Background Processing (Container Apps Job)

- **FR-036**: System MUST provision an Azure Container Apps Job (event-driven) that triggers on Storage Queue messages.
- **FR-037**: The job MUST be configured to poll `enrichment-queue` for new messages.
- **FR-038**: The job MUST scale to zero when no messages are in the queue.
- **FR-039**: The job MUST have managed identity with access to Key Vault, App Configuration, Storage, and DocumentDB.

#### Security and Networking

- **FR-040**: System MUST use managed identities for service-to-service authentication (no connection strings in app config where avoidable).
- **FR-041**: System MUST enforce HTTPS for all public endpoints.
- **FR-042**: System MUST restrict DocumentDB network access to secure defaults (no public endpoint if possible; document upgrade path for Private Link).
- **FR-043**: API ingress MUST be protected by Entra authentication; public access without auth is not allowed.

#### CI/CD (GitHub Actions)

- **FR-044**: System MUST provide a GitHub Actions workflow for infrastructure provisioning with manual approval per environment.
- **FR-045**: System MUST provide a GitHub Actions workflow for building and deploying the API image to ACR and ACA with manual approval per environment.
- **FR-046**: System MUST provide a GitHub Actions workflow for deploying the frontend to SWA with manual approval per environment.
- **FR-047**: Workflows MUST support parameterized deployment for dev and prod environments.

#### Documentation

- **FR-048**: System MUST include a runbook documenting: deployment procedures, secret rotation, monitoring, and troubleshooting.
- **FR-049**: System MUST document the naming convention and resource topology.
- **FR-050**: System MUST document the upgrade path for Private Link, VNet integration, and multi-region (out of scope for MVP).

### Non-Functional Requirements

- **NFR-001**: Infrastructure provisioning MUST complete in under 20 minutes for a fresh environment.
- **NFR-002**: IaC MUST be idempotent—running the same deployment twice produces no changes.
- **NFR-003**: IaC MUST use Bicep as the Infrastructure as Code tool.
- **NFR-004**: All Bicep modules MUST be stored in `/infra` directory in the repository.

### Key Entities

- **Resource Group**: Logical container for all environment resources; one per environment.
- **Container Apps Environment**: Shared compute environment for API and enrichment job.
- **Container App (API)**: The .NET Minimal API backend container.
- **Container Apps Job (Enrichment)**: Event-driven background job triggered by Storage Queue messages.
- **Static Web App**: The React SPA frontend host.
- **DocumentDB Account**: MongoDB-compatible database for persistence.
- **Storage Account**: Blob and Queue storage for assets and messaging.
- **Application Insights**: Observability destination for traces, metrics, logs.
- **Key Vault**: Secure storage for connection strings and secrets.
- **App Configuration**: Central store for non-secret application settings.
- **Log Analytics Workspace**: Backend for Container Apps logs and Application Insights data.
- **Container Registry (ACR)**: Private registry for container images.

### Excluded from Scope

- Multi-region active-active replication (documented as future upgrade)
- Advanced WAF or CDN configuration
- Private Link for all services (documented as future upgrade)
- Azure API Management (APIM)
- Complex VNet integration (focus on secure defaults; documented upgrade path)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new environment (all resources) is provisioned with a single command in under 20 minutes.
- **SC-002**: Re-running the deployment on an unchanged environment completes with zero resource changes.
- **SC-003**: The API health endpoint responds with HTTP 200 within 2 minutes of deployment.
- **SC-004**: The frontend application loads in a browser within 2 minutes of deployment.
- **SC-005**: API calls from the frontend to the backend succeed without CORS errors (via linked backend or configured CORS).
- **SC-006**: A document written to DocumentDB via the API persists and is retrievable after API restart.
- **SC-007**: A message sent to Storage Queue triggers the enrichment job and is processed within 60 seconds.
- **SC-008**: API request traces appear in Application Insights within 5 minutes of the request.
- **SC-009**: GitHub Actions workflows successfully deploy both dev and prod environments when triggered with manual approval.
- **SC-010**: Runbook documentation covers deployment, secret rotation, monitoring, and troubleshooting procedures.

## Assumptions

- Team has Azure subscription(s) with sufficient permissions to create resource groups and all resource types (Contributor role or equivalent).
- GitHub Actions has federated identity (OIDC) or service principal configured for Azure deployment.
- The existing .NET API is containerized and ready to be pushed to ACR.
- The existing React frontend is configured for SWA deployment.
- Entra ID authentication configuration is handled by spec 004; this spec focuses on infrastructure only.
- Development environment uses lower SKUs/tiers to reduce cost; production uses recommended tiers for reliability.
- Azure DocumentDB vCore is available in the selected region.
- SWA linked backend feature is available and supports the required routing patterns.

## Dependencies

- **Spec 004 (Entra External Auth)**: Authentication configuration for the API.
- **Spec 005 (Bookmark Enrichment)**: Defines the enrichment worker logic that runs on the Container Apps Job.
- Azure subscription with Contributor role or equivalent.
- GitHub repository with Actions enabled.
- Azure CLI and Bicep CLI installed for local development.

## Risk Considerations

- **DocumentDB provisioning time**: New DocumentDB vCore accounts may take 10-15 minutes to provision; factored into deployment time budget.
- **SWA linked backend limitations**: If linked backend doesn't support all API patterns, CORS fallback will increase complexity.
- **Cost management**: DocumentDB vCore and Container Apps can accumulate costs; monitoring and alerts are important.
- **Region availability**: Ensure all resources (especially DocumentDB vCore) are available in the selected region.
- **Container Apps Job scaling**: Event-driven jobs have minimum polling interval; latency may be 30+ seconds for first message after idle.
