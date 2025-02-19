## Grafana dashboards for MySQL and MongoDB monitoring using Prometheus

This is a set of Grafana dashboards for database and system monitoring using Prometheus datasource.
 
 
 * Advanced Data Exploration
 * Advisor Tuning
 * Amazon RDS / Aurora MySQL metrics (CloudWatch datasource)
 * Compare System Parameters
 * CPU Utilization Details (Cores)
 * Cross Server Graphs
 * Disk Performance
 * Disk Space
 * Health Check
 * Home Dashboard
 * MongoDB Cluster Summary
 * MongoDB InMemory
 * MongoDB MMAPv1
 * MongoDB Overview
 * MongoDB ReplSet
 * MongoDB RocksDB
 * MongoDB WiredTiger
 * MySQL Amazon Aurora Metrics
 * MySQL Command Handler Counters Compare
 * MySQL InnoDB Metrics
 * MySQL InnoDB Metrics Advanced
 * MySQL InnoDB Compression
 * MySQL MyISAM/Aria Metrics
 * MySQL MyRocks Metrics
 * MySQL Overview
 * MySQL Performance Schema
 * MySQL Performance Schema Wait Event Analyses
 * MySQL Query Response Time
 * MySQL Replication
 * MySQL Table Statistics
 * MySQL TokuDB Metrics
 * MySQL User Statistics
 * Network Overview
 * NUMA Overview
 * PostgreSQL Overview
 * ProxySQL Overview
 * Prometheus
 * Prometheus Exporter Status
 * Prometheus Exporters Overview
 * PXC/Galera Cluster Overview
 * PXC/Galera Graphs
 * Summary Dashboard
 * System Overview
 * Trends Dashboard
 * SSM Add Instance
 * SSM Monitored Instances
 * SSM Query Analytics Settings
 * SSM System Summary


These dashboards are also a part of [Shattered Silicon Monitoring](https://shatteredsilicon.net/software/ssm/documentation/latest/) project.

### Setup instructions

#### Add datasource in Grafana

The datasource should be named `Prometheus` so it is automatically picked up by the graphs.

![image](assets/datasource.png)

#### Prometheus config

The dashboards use built-in `instance` label to filter on individual hosts.
It is recommended you give the good names to your instances. Here is some example:

    scrape_configs:
      - job_name: prometheus
        static_configs:
          - targets: ['localhost:9090']
            labels:
              instance: prometheus

      - job_name: linux
        static_configs:
          - targets: ['192.168.1.7:9100']
            labels:
              instance: db1

      - job_name: mysql
        static_configs:
          - targets: ['192.168.1.7:9104']
            labels:
              instance: db1

How you name jobs is not important. However, "Prometheus" dashboard assumes the job name is `prometheus`.

#### Exporter options

Here is the minimal set of options for the exporters:

 * node_exporter: `-collectors.enabled="diskstats,filefd,filesystem,loadavg,meminfo,netdev,stat,time,uname,vmstat"`
 * mysqld_exporter: `-collect.binlog_size=true -collect.info_schema.processlist=true`
 * mongodb_exporter: the defaults are fine.

### Graph samples

Here is some sample graphs.

![image](assets/sample1.png)

![image](assets/sample2.png)

![image](assets/sample3.png)

![image](assets/sample4.png)

![image](assets/sample5.png)

![image](assets/sample6.png)

![image](assets/sample7.png)

![image](assets/sample8.png)

