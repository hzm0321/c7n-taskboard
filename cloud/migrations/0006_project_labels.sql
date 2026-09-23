ALTER TABLE projects
ADD COLUMN labels TEXT NOT NULL DEFAULT '["缺陷","特性","改进","文档","测试","维护"]';

WITH catalog AS (
  SELECT
    projects.id AS project_id,
    default_labels.value AS label,
    0 AS source_order,
    printf('%08d', default_labels.key) AS label_order
  FROM projects, json_each('["缺陷","特性","改进","文档","测试","维护"]') AS default_labels

  UNION ALL

  SELECT
    tasks.project_id,
    task_labels.value,
    1,
    tasks.created_at || ':' || tasks.id || ':' || printf('%08d', task_labels.key)
  FROM tasks, json_each(tasks.labels) AS task_labels
)
UPDATE projects
SET labels = (
  SELECT json_group_array(label)
  FROM (
    SELECT label
    FROM catalog
    WHERE catalog.project_id = projects.id
    GROUP BY label
    ORDER BY MIN(source_order), MIN(label_order)
  )
);
