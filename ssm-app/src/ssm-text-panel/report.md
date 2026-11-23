| | |
|---|---|
| | ![](ss-logo.png){width=99%} |

# Onboarding / Performance Report:

# {{instance}}

\newpage

## Tuning

{{#tuning_reports}}

#### {{title}}

- current: {{current}}
- proposed: {{proposed}}

![]({{image.filename}}){width="100%"} {{^conclusion}}{{delimiter}}{{/conclusion}}
{{#conclusion}}

{{conclusion}} {{delimiter}}
{{/conclusion}}

{{/tuning_reports}}

## Query

{{#query_reports}}

### {{abstract}} / {{checksum}}

Query:
```
{{example_func}}
```

Load %: {{percentage_func}}

Average time: {{query_time_avg_func}}

Count: {{query_count_func}}

\newpage

{{/query_reports}}

## Toolkit Summary

```
{{ toolkit_summary }}
```