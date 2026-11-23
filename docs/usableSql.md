-- 查看 SQL 执行统计（按执行次数排序）
SELECT 
    DIGEST_TEXT AS 'SQL 模版',
    COUNT_STAR AS '执行次数',
    AVG_TIMER_WAIT/1000000000000 AS '平均耗时(秒)',
    MAX_TIMER_WAIT/1000000000000 AS '最大耗时(秒)',
    SUM_ROWS_SENT AS '返回总行数',
    SUM_ROWS_EXAMINED AS '扫描总行数',
    FIRST_SEEN AS '首次出现',
    LAST_SEEN AS '最近出现'
FROM performance_schema.events_statements_summary_by_digest 
WHERE SCHEMA_NAME IS NOT NULL
ORDER BY COUNT_STAR DESC 
LIMIT 100;

-- 查看各 IP 的事务提交次数（历史累计）
SELECT 
    HOST AS '客户端IP',
    EVENT_NAME AS '事件类型',
    COUNT_STAR AS '事务次数',
    SUM_TIMER_WAIT/1000000000000 AS '总耗时(秒)',
    AVG_TIMER_WAIT/1000000000000 AS '平均耗时(秒)',
    COUNT_READ_WRITE AS '读写事务数',
    COUNT_READ_ONLY AS '只读事务数'
FROM performance_schema.events_transactions_summary_by_host_by_event_name
WHERE HOST IS NOT NULL 
  AND COUNT_STAR > 0
ORDER BY COUNT_STAR DESC
LIMIT 10;

-- 重置统计（需要 PROCESS 权限）
TRUNCATE TABLE performance_schema.events_transactions_summary_by_host_by_event_name;

-- SQL 语句统计表
TRUNCATE TABLE performance_schema.events_statements_summary_by_digest;
TRUNCATE TABLE performance_schema.events_statements_summary_by_program;

-- 按用户/主机/账号的统计
TRUNCATE TABLE performance_schema.events_statements_summary_by_user_by_event_name;
TRUNCATE TABLE performance_schema.events_statements_summary_by_host_by_event_name;
TRUNCATE TABLE performance_schema.events_statements_summary_by_account_by_event_name;

-- 全局 SQL 统计
TRUNCATE TABLE performance_schema.events_statements_summary_global_by_event_name;

-- 表 I/O 统计（如果也想要重置）
TRUNCATE TABLE performance_schema.table_io_waits_summary_by_table;
TRUNCATE TABLE performance_schema.table_io_waits_summary_by_index_usage;

-- 查询每张表的操作次数
SELECT 
    OBJECT_SCHEMA, 
    OBJECT_NAME, 
    COUNT_UPDATE, 
    COUNT_INSERT, 
    COUNT_DELETE
FROM 
    performance_schema.table_io_waits_summary_by_table
ORDER BY 
    COUNT_UPDATE DESC 
LIMIT 10;


// 数据库备份
mysqldump -u root -p   --all-databases   --single-transaction   --quick   --lock-tables=false   --routines --events   > all_databases_backup_$(date +%Y%m%d%H%M%S).sql