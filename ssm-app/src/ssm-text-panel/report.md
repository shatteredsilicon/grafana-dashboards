## Tuning

{{#tuning_reports}}

#### {{title}}

- current: {{current}}
- proposed: {{proposed}}

![]({{image.filename}}){width="100%"}

{{/tuning_reports}}

## Query

{{#query_reports}}

---

### {{abstract}} / {{checksum}}

Query:
```
{{example_func}}
```

Load %: {{percentage_func}}

Average time: {{query_time_avg_func}}

Count: {{query_count_func}}

---

{{/query_reports}}

## Toolkit Summary

```
{{ toolkit_summary }}
```