import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createTaskboardServer } from "../server/app.mjs";

for (const initialDescription of ["<p>Original description</p>", undefined, null, {}, "", "<p><br></p>"]) {
test(`Choerodon sync accepts description ${JSON.stringify(initialDescription)} and re-syncs remote changes`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "choerodon-description-"));
  let app;
  try {
    await writeFile(path.join(directory, "choerodon-connection.json"), JSON.stringify({
      authorization: "Bearer test",
      organization: { id: "1", name: "Organization" },
      project: { id: "2", name: "Project" },
      board: { id: "3", name: "Board" },
    }));
    let description = initialDescription;
    let detailReads = 0;
    app = createTaskboardServer({
      dataDirectory: directory,
      choerodonFetch: async (url) => {
        if (url.includes('/issue_comment/')) return Response.json([]);
        if (url.endsWith("/board/3/all_data/1")) {
          return Response.json({ columnsData: { columns: [{ columnId: "4", name: "Todo", subStatusDTOS: [{
            name: "Todo", issues: [{ issueId: "889566095416803328", issueNum: "hzero-cust-14720", summary: "Example task" }],
          }] }] } });
        }
        assert.equal(url, "https://api.choerodon.com.cn/agile/v1/projects/2/issues/889566095416803328?organizationId=1");
        detailReads += 1;
        return Response.json({ description });
      },
    });
    const { port } = await app.listen({ port: 0 });
    async function request(route, body, method = "POST") {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? {} : {
        method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      assert.equal(response.ok, true, JSON.stringify(payload));
      return payload;
    }
    const route = "/api/local/choerodon-sync?projectId=local";
    const preview = await request(route);
    assert.equal(detailReads, 0);
    const selection = { sourceKey: preview.sourceKey, issueIds: ["889566095416803328"] };
    const created = await request(route, selection);
    assert.equal(created.created, 1);
    const id = created.tasks[0].id;
    const first = (await request(`/api/tasks/${id}`)).task;
    assert.equal(first.description, initialDescription === "<p>Original description</p>"
      ? "Original description"
      : "来源：猪齿鱼 / Project / Board\n任务编号：hzero-cust-14720\n猪齿鱼任务 ID：889566095416803328");
    await request(`/api/tasks/${id}`, { version: first.version, status: "in_progress" }, "PATCH");

    description = "<p>Latest <strong>requirements</strong><br>Second line &amp; details</p>";
    const updated = await request(route, selection);
    assert.equal(updated.updated, 1);
    assert.equal(updated.created, 0);
    assert.equal(updated.tasks[0].id, id);
    const latest = (await request(`/api/tasks/${id}`)).task;
    assert.equal(latest.description, "Latest **requirements**  \nSecond line & details");
    assert.equal(latest.status, "in_progress");
    assert.equal(detailReads, 2);
  } finally {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
}
