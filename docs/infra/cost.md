# Cost Guide

## Cost Drivers
Primary monthly cost contributors:
- DocumentDB (MongoDB vCore) tier
- Log Analytics ingestion and retention
- Container Apps compute usage
- Static Web Apps (Standard SKU in prod)
- Container Registry storage and network egress

## Dev vs Prod Baseline
| Resource | Dev SKU | Prod SKU |
|----------|---------|----------|
| Container Apps | Consumption | Consumption |
| Container Apps Job | Consumption | Consumption |
| Static Web Apps | Free | Standard |
| Key Vault | Standard | Standard |
| App Configuration | Free | Standard |
| Storage Account | Standard_LRS | Standard_GRS |
| Application Insights | Pay-per-use | Pay-per-use |
| Log Analytics | Pay-per-GB | Pay-per-GB |
| DocumentDB (vCore) | M25 | M40 |
| Container Registry | Basic | Standard |

## Cost Optimization Levers
- Reduce Log Analytics retention in dev
- Keep dev Container Apps min replicas at 0
- Use Free/Basic SKUs in dev where available
- Review DocumentDB tier size for actual workload
- Limit log volume (sampling, filter noisy logs)

## Monitoring & Budgets
- Use Azure Cost Management budgets and alerts per environment
- Tag-based cost tracking: `environment`, `project`, `costCenter`

## Suggested Reviews
- Weekly cost review during first month
- Re-evaluate DocumentDB tier after usage patterns stabilize

## References
- specs/007-infra-azure/plan.md
- specs/007-infra-azure/quickstart.md
