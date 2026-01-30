````markdown
# Data Model: Azure Infrastructure Landing Zone

**Feature Branch**: `007-infra-azure`  
**Created**: 2026-01-30

---

## Overview

This document describes the Azure resource topology for recall-core infrastructure. It defines the resource hierarchy, relationships, and deployment dependencies.

---

## Resource Topology Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Azure Subscription                                            │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Resource Group: rg-recall-{env}                               │   │
│  │                    Region: West Europe                                           │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Observability Layer                                   │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────┐     ┌────────────────────────────────┐         │    │   │
│  │  │   │ Log Analytics      │◄────│ Application Insights           │         │    │   │
│  │  │   │ log-recall-{env}   │     │ appi-recall-{env}              │         │    │   │
│  │  │   │                    │     │                                │         │    │   │
│  │  │   │ • Container logs   │     │ • OpenTelemetry traces        │         │    │   │
│  │  │   │ • Diagnostics      │     │ • Custom metrics              │         │    │   │
│  │  │   │ • Query workspace  │     │ • Distributed tracing         │         │    │   │
│  │  │   └────────────────────┘     └────────────────────────────────┘         │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Secrets & Configuration Layer                         │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────┐     ┌────────────────────────────────┐         │    │   │
│  │  │   │ Key Vault          │     │ App Configuration              │         │    │   │
│  │  │   │ kv-recall-{env}    │     │ appcs-recall-{env}             │         │    │   │
│  │  │   │                    │     │                                │         │    │   │
│  │  │   │ Secrets:           │     │ Settings:                      │         │    │   │
│  │  │   │ • DocumentDB conn  │     │ • TenantId                     │         │    │   │
│  │  │   │ • OAuth secrets    │     │ • ClientId                     │         │    │   │
│  │  │   │                    │     │ • API endpoints                │         │    │   │
│  │  │   │ RBAC: SecretUser   │     │ RBAC: DataReader               │         │    │   │
│  │  │   └────────────────────┘     └────────────────────────────────┘         │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Container Registry                                    │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │   │ Azure Container Registry: crrecall{env}                        │    │    │   │
│  │  │   │ SKU: Basic (dev) / Standard (prod)                             │    │    │   │
│  │  │   │                                                                │    │    │   │
│  │  │   │ Images:                                                        │    │    │   │
│  │  │   │ • recall-api:{tag}                                             │    │    │   │
│  │  │   │ • recall-enrichment:{tag}                                      │    │    │   │
│  │  │   │                                                                │    │    │   │
│  │  │   │ Access: Managed identity pull (RBAC: AcrPull)                  │    │    │   │
│  │  │   └────────────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Container Apps Environment                            │    │   │
│  │  │                    cae-recall-{env}                                      │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌─────────────────────────────┐   ┌───────────────────────────────┐   │    │   │
│  │  │   │ Container App               │   │ Container Apps Job            │   │    │   │
│  │  │   │ aca-recall-api-{env}        │   │ acj-recall-enrichment-{env}   │   │    │   │
│  │  │   │                             │   │                               │   │    │   │
│  │  │   │ • System-assigned MI        │   │ • System-assigned MI          │   │    │   │
│  │  │   │ • HTTPS ingress (external)  │   │ • Queue trigger               │   │    │   │
│  │  │   │ • Scale: 0-3 (dev), 1-10    │   │ • Scale: 0-5 executions       │   │    │   │
│  │  │   │ • CPU: 0.5, Memory: 1Gi     │   │ • CPU: 1.0, Memory: 2Gi       │   │    │   │
│  │  │   │ • Health probes (/health)   │   │ • Timeout: 5 minutes          │   │    │   │
│  │  │   │                             │   │                               │   │    │   │
│  │  │   │ RBAC Roles:                 │   │ RBAC Roles:                   │   │    │   │
│  │  │   │ • KV Secrets User           │   │ • KV Secrets User             │   │    │   │
│  │  │   │ • Blob Data Contributor     │   │ • Blob Data Contributor       │   │    │   │
│  │  │   │ • Queue Data Contributor    │   │ • Queue Data Contributor      │   │    │   │
│  │  │   │ • AppConfig Data Reader     │   │ • AcrPull                     │   │    │   │
│  │  │   │ • AcrPull                   │   │                               │   │    │   │
│  │  │   └─────────────────────────────┘   └───────────────────────────────┘   │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Data Layer                                            │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │   │ Azure DocumentDB (Cosmos DB for MongoDB vCore)                  │    │    │   │
│  │  │   │ cosmos-recall-{env}                                             │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ • Tier: M25 (dev) / M40 (prod)                                  │    │    │   │
│  │  │   │ • Database: recall                                              │    │    │   │
│  │  │   │ • Collections: (created by app)                                 │    │    │   │
│  │  │   │   - items                                                       │    │    │   │
│  │  │   │   - collections                                                 │    │    │   │
│  │  │   │ • Firewall: Azure services only                                 │    │    │   │
│  │  │   │ • Connection string → Key Vault                                 │    │    │   │
│  │  │   └────────────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Storage Layer                                         │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │   │ Storage Account: strecall{env}                                  │    │    │   │
│  │  │   │ SKU: Standard_LRS (dev) / Standard_GRS (prod)                   │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ ┌──────────────────┐    ┌──────────────────────────────────┐   │    │    │   │
│  │  │   │ │ Blob Container   │    │ Queue                            │   │    │    │   │
│  │  │   │ │ thumbnails       │    │ enrichment-queue                 │   │    │    │   │
│  │  │   │ │                  │    │                                  │   │    │    │   │
│  │  │   │ │ • Private access │    │ • ACA Job trigger                │   │    │    │   │
│  │  │   │ │ • {userId}/      │    │ • Enrichment messages            │   │    │    │   │
│  │  │   │ │   {itemId}.jpg   │    │ • Visibility timeout: 30s       │   │    │    │   │
│  │  │   │ └──────────────────┘    └──────────────────────────────────┘   │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ Security:                                                       │    │    │   │
│  │  │   │ • Public access disabled                                        │    │    │   │
│  │  │   │ • Shared key access disabled                                    │    │    │   │
│  │  │   │ • TLS 1.2 minimum                                               │    │    │   │
│  │  │   │ • Managed identity access only                                  │    │    │   │
│  │  │   └────────────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Frontend Layer                                        │    │   │
│  │  │                                                                          │    │   │
│  │  │   ┌────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │   │ Azure Static Web App: swa-recall-{env}                          │    │    │   │
│  │  │   │ SKU: Free (dev) / Standard (prod)                               │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ • Source: GitHub (adiazcan/recall-core)                         │    │    │   │
│  │  │   │ • App location: src/web                                         │    │    │   │
│  │  │   │ • Output: dist                                                  │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ Linked Backend (prod only):                                     │    │    │   │
│  │  │   │ • /api/* → aca-recall-api-{env}                                 │    │    │   │
│  │  │   │                                                                 │    │    │   │
│  │  │   │ CORS Fallback (dev):                                            │    │    │   │
│  │  │   │ • API allows SWA hostname origin                                │    │    │   │
│  │  │   └────────────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Dependency Graph

```
┌─────────────────────┐
│ Resource Group      │
└─────────┬───────────┘
          │
          ├──────────────────────┬──────────────────────┬───────────────────────┐
          │                      │                      │                       │
          ▼                      ▼                      ▼                       ▼
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ Log Analytics   │   │ Container        │   │ Storage Account │   │ App Configuration│
│ Workspace       │   │ Registry (ACR)   │   │                 │   │                  │
└────────┬────────┘   └────────┬─────────┘   └────────┬────────┘   └────────┬─────────┘
         │                     │                      │                     │
         │                     │                      │                     │
         ▼                     │                      │                     │
┌─────────────────┐            │                      │                     │
│ Application     │            │                      │                     │
│ Insights        │◄───────────┼──────────────────────┼─────────────────────┘
└────────┬────────┘            │                      │
         │                     │                      │
         ├─────────────────────┼──────────────────────┤
         │                     │                      │
         ▼                     │                      │
┌─────────────────┐            │                      │
│ Key Vault       │            │                      │
└────────┬────────┘            │                      │
         │                     │                      │
         │        ┌────────────┘                      │
         │        │                                   │
         ▼        ▼                                   │
┌─────────────────────────────────────────┐          │
│ Azure DocumentDB (MongoDB vCore)        │          │
│ (connection string → Key Vault)         │          │
└────────┬────────────────────────────────┘          │
         │                                            │
         │        ┌───────────────────────────────────┘
         │        │
         ▼        ▼
┌─────────────────────────────────────────┐
│ Container Apps Environment              │
│                                         │
│  ┌─────────────────┐  ┌─────────────┐  │
│  │ Container App   │  │ ACA Job     │  │
│  │ (API)           │  │ (Enrichment)│  │
│  │                 │  │             │  │
│  │ Depends on:     │  │ Depends on: │  │
│  │ • Key Vault     │  │ • Key Vault │  │
│  │ • App Config    │  │ • Storage Q │  │
│  │ • ACR           │  │ • ACR       │  │
│  │ • App Insights  │  │ • App Ins.  │  │
│  │ • DocumentDB    │  │ • DocumentDB│  │
│  └────────┬────────┘  └─────────────┘  │
│           │                             │
└───────────┼─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Static Web App                          │
│ (linked backend → API)                  │
└─────────────────────────────────────────┘
```

---

## Deployment Order

Bicep handles dependencies automatically, but the logical deployment order is:

| Phase | Resources | Dependencies |
|-------|-----------|--------------|
| 1 | Resource Group | None |
| 2 | Log Analytics Workspace | Resource Group |
| 3 | Application Insights | Log Analytics |
| 4 | Key Vault | Resource Group |
| 5 | App Configuration | Resource Group |
| 6 | Container Registry | Resource Group |
| 7 | Storage Account (+ containers, queues) | Resource Group |
| 8 | DocumentDB | Key Vault (for secret storage) |
| 9 | Container Apps Environment | Log Analytics |
| 10 | Container App (API) | CAE, ACR, KV, AppConfig, DocumentDB, Storage |
| 11 | Container Apps Job | CAE, ACR, KV, Storage Queue |
| 12 | Static Web App | API Container App (linked backend) |
| 13 | RBAC Role Assignments | All identities created |
| 14 | Alerts (prod only) | Application Insights |

---

## Environment Matrix

| Resource | Dev Name | Prod Name | Dev SKU | Prod SKU |
|----------|----------|-----------|---------|----------|
| Resource Group | rg-recall-dev | rg-recall-prod | N/A | N/A |
| Log Analytics | log-recall-dev | log-recall-prod | Pay-per-GB | Pay-per-GB |
| App Insights | appi-recall-dev | appi-recall-prod | Pay-per-use | Pay-per-use |
| Key Vault | kv-recall-dev | kv-recall-prod | Standard | Standard |
| App Configuration | appcs-recall-dev | appcs-recall-prod | Free | Standard |
| Container Registry | crrecalldev | crrecallprod | Basic | Standard |
| Storage Account | strecalldev | strecallprod | Standard_LRS | Standard_GRS |
| DocumentDB | cosmos-recall-dev | cosmos-recall-prod | M25 | M40 |
| CA Environment | cae-recall-dev | cae-recall-prod | Consumption | Consumption |
| Container App (API) | aca-recall-api-dev | aca-recall-api-prod | 0.5 CPU/1Gi | 0.5 CPU/1Gi |
| ACA Job | acj-recall-enrichment-dev | acj-recall-enrichment-prod | 1.0 CPU/2Gi | 1.0 CPU/2Gi |
| Static Web App | swa-recall-dev | swa-recall-prod | Free | Standard |

---

## Security Model

### Managed Identity Access Matrix

| Source | Target | Role | Purpose |
|--------|--------|------|---------|
| aca-recall-api-{env} | crrecall{env} | AcrPull | Pull container images |
| aca-recall-api-{env} | kv-recall-{env} | Key Vault Secrets User | Read DocumentDB connection string |
| aca-recall-api-{env} | appcs-recall-{env} | App Configuration Data Reader | Read app settings |
| aca-recall-api-{env} | strecall{env} | Storage Blob Data Contributor | Upload/download thumbnails |
| aca-recall-api-{env} | strecall{env} | Storage Queue Data Contributor | Send enrichment messages |
| acj-recall-enrichment-{env} | crrecall{env} | AcrPull | Pull container images |
| acj-recall-enrichment-{env} | kv-recall-{env} | Key Vault Secrets User | Read DocumentDB connection string |
| acj-recall-enrichment-{env} | strecall{env} | Storage Blob Data Contributor | Upload thumbnails |
| acj-recall-enrichment-{env} | strecall{env} | Storage Queue Data Contributor | Delete processed messages |
| GitHub Actions SP | rg-recall-{env} | Contributor | Deploy infrastructure |
| GitHub Actions SP | crrecall{env} | AcrPush | Push container images |

### Network Security

| Resource | Public Access | Restrictions |
|----------|---------------|--------------|
| Container App (API) | Yes (HTTPS ingress) | None (Entra auth at app level) |
| Static Web App | Yes | None |
| Key Vault | Yes | RBAC only, no access policies |
| App Configuration | Yes | RBAC only, local auth disabled |
| Storage Account | Yes | No shared key, no public blob access |
| DocumentDB | Yes | Firewall allows Azure services only |
| Container Registry | Yes | Anonymous pull disabled |

---

## Tags

All resources receive the following tags:

```json
{
  "environment": "dev|prod",
  "project": "recall-core",
  "managedBy": "bicep",
  "costCenter": "recall-dev|recall-prod"
}
```

````