---
name: "Campaign Analytics"
description: "Production-grade campaign performance analysis with multi-touch attribution modeling, funnel conversion analysis, and ROI calculation."
---

# Campaign Analytics

Production-grade campaign performance analysis with multi-touch attribution modeling, funnel conversion analysis, and ROI calculation.

## Input Requirements

### Attribution Analyzer
```json
{
  "journeys": [{
    "journey_id": "j1",
    "touchpoints": [
      {"channel": "organic_search", "timestamp": "2025-10-01T10:00:00", "interaction": "click"},
      {"channel": "email", "timestamp": "2025-10-05T14:30:00", "interaction": "open"},
      {"channel": "paid_search", "timestamp": "2025-10-08T09:15:00", "interaction": "click"}
    ],
    "converted": true,
    "revenue": 500.00
  }]
}
```

### Funnel Analyzer
```json
{
  "funnel": {
    "stages": ["Awareness", "Interest", "Consideration", "Intent", "Purchase"],
    "counts": [10000, 5200, 2800, 1400, 420]
  }
}
```

### Campaign ROI Calculator
```json
{
  "campaigns": [{
    "name": "Spring Email Campaign",
    "channel": "email",
    "spend": 5000.00,
    "revenue": 25000.00,
    "impressions": 50000,
    "clicks": 2500,
    "leads": 300,
    "customers": 45
  }]
}
```

## Five Attribution Models

| Model | Description | Best For |
|-------|-------------|----------|
| **First-Touch** | 100% credit to first interaction | Brand awareness campaigns |
| **Last-Touch** | 100% credit to last interaction | Direct response campaigns |
| **Linear** | Equal credit to all touchpoints | Balanced multi-channel evaluation |
| **Time-Decay** | More credit to recent touchpoints | Short sales cycles |
| **Position-Based** | 40/20/40 split (first/middle/last) | Full-funnel marketing |

## Funnel Analysis

Analyzes conversion funnels to identify bottlenecks:
- Stage-to-stage conversion rates and drop-off percentages
- Automatic bottleneck identification (largest absolute and relative drops)
- Overall funnel conversion rate

## ROI Metrics

- **ROI**: Return on investment percentage
- **ROAS**: Return on ad spend ratio
- **CPA**: Cost per acquisition
- **CPL**: Cost per lead
- **CAC**: Customer acquisition cost
- **CTR**: Click-through rate
- **CVR**: Conversion rate (leads to customers)

## Typical Analysis Workflow

```bash
# Step 1 — Attribution: understand which channels drive conversions
python scripts/attribution_analyzer.py campaign_data.json --model time-decay

# Step 2 — Funnel: identify where prospects drop off
python scripts/funnel_analyzer.py funnel_data.json

# Step 3 — ROI: calculate profitability and benchmark
python scripts/campaign_roi_calculator.py campaign_data.json
```

## Best Practices

1. **Use multiple attribution models** — Compare at least 3 models to triangulate channel value
2. **Set appropriate lookback windows** — Match time-decay half-life to average sales cycle
3. **Segment your funnels** — Compare segments (channel, cohort, geography)
4. **Benchmark against your own history first** — Historical data is most relevant comparison
5. **Run ROI analysis at regular intervals** — Weekly for active campaigns, monthly for strategic review
6. **Include all costs** — Factor in creative, tooling, and labor costs
7. **Document A/B tests rigorously** — Ensure statistical validity and clear decision criteria

## Limitations

- No statistical significance testing (descriptive metrics only)
- Offline analysis (static JSON snapshots, no real-time data)
- Single-currency (no currency conversion support)
- Simplified time-decay (exponential decay based on configurable half-life)
- No cross-device tracking (identity resolution handled upstream)

## Related Skills

- **analytics-tracking**: For setting up tracking
- **ab-test-setup**: For designing experiments
- **paid-ads**: For optimizing ad spend based on analytics findings