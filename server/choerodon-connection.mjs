import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants, publicEncrypt, randomUUID } from "node:crypto";
import TurndownService from "turndown";

import { ApiError, stringField, parseDueDate } from "../shared/api-fields.mjs";

const API_ORIGIN = "https://api.choerodon.com.cn";
const descriptionMarkdown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
descriptionMarkdown.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content) => `~~${content}~~`,
});

function commentDate(value) {
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}+08:00` : value);
  if (!Number.isFinite(date.getTime())) throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼评论时间无效");
  return date.toISOString();
}

function normalizedComment(comment, parentId = null) {
  return {
    id: remoteId(comment.commentId),
    parentId: comment.parentId && String(comment.parentId) !== "0" ? remoteId(comment.parentId) : parentId,
    body: stringField(descriptionMarkdown.turndown(typeof comment.commentText === "string" ? comment.commentText : ""), "commentText", { maxLength: 100_000 }),
    authorId: `choerodon:${remoteId(comment.userId)}`,
    authorName: stringField(comment.userRealName || comment.userName || comment.userLoginName, "commentAuthor", { required: true, maxLength: 240 }),
    authorAvatarUrl: comment.userImageUrl || null,
    replyToAuthorName: comment.replyToUserRealName || comment.replyToUserName || null,
    createdAt: commentDate(comment.creationDate ?? comment.lastUpdateDate),
    updatedAt: commentDate(comment.lastUpdateDate),
  };
}

function remoteId(value) {
  const id = String(value ?? "");
  if (!/^\d+$/.test(id) || id.length > 32 || (typeof value === "number" && !Number.isSafeInteger(value))) {
    throw new ApiError(400, "INVALID_CHOERODON_ID", "猪齿鱼组织、项目和看板 ID 无效");
  }
  return id;
}

function choices(items, idKey, nameKey) {
  if (!Array.isArray(items)) {
    throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效的选项列表");
  }
  return items.map((item) => {
    if (typeof item?.[nameKey] !== "string" || !item[nameKey].trim()) {
      throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼返回的选项缺少名称");
    }
    return { id: remoteId(item[idKey]), name: item[nameKey] };
  });
}

function selected(items, id, label) {
  const item = items.find((candidate) => candidate.id === remoteId(id));
  if (!item) throw new ApiError(400, "CHOERODON_SELECTION_UNAVAILABLE", `请选择当前账号可访问的${label}`);
  return item;
}

function publicConnection(config) {
  return {
    configured: Boolean(config),
    account: config?.account ?? null,
    organization: config?.organization ?? null,
    project: config?.project ?? null,
    board: config?.board ?? null,
  };
}

export function createChoerodonConnection({ configPath, fetch: fetchImplementation = globalThis.fetch }) {
  async function read() {
    try {
      return JSON.parse(await readFile(configPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async function credentials(input) {
    const authorization = input.authorization?.trim() || (await read())?.authorization;
    if (typeof authorization !== "string" || !authorization || authorization.length > 8192 || /[^\x20-\x7e]/.test(authorization)) {
      throw new ApiError(400, "CHOERODON_AUTH_REQUIRED", "请填写请求头 Authorization 的完整值");
    }
    return authorization.includes(" ") ? authorization : `Bearer ${authorization}`;
  }

  async function request(authorization, pathname, organizationId, body) {
    let response;
    try {
      response = await fetchImplementation(`${API_ORIGIN}${pathname}`, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          accept: "application/json",
          authorization,
          ...(organizationId ? { "H-Tenant-Id": organizationId } : {}),
          ...(pathname.startsWith("/agile/") ? { "H-Menu-Id": "21" } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError(502, "CHOERODON_UNAVAILABLE", "连接猪齿鱼失败，请检查网络后重试");
    }
    if (response.status === 401) {
      throw new ApiError(401, "CHOERODON_AUTH_EXPIRED", "认证信息无效或已过期，请重新填写 Authorization");
    }
    if (response.status === 403) {
      throw new ApiError(403, "CHOERODON_ACCESS_DENIED", "当前账号没有访问该组织、项目或看板的权限");
    }
    if (!response.ok) {
      throw new ApiError(502, "CHOERODON_REQUEST_FAILED", `猪齿鱼请求失败（${response.status}），请重试`);
    }
    try {
      // Choerodon sends 64-bit IDs as JSON numbers; preserve their original digits.
      return JSON.parse(await response.text(), (_key, value, context) => (
        typeof value === "number" && !Number.isSafeInteger(value) && /^\d+$/.test(context.source)
          ? context.source
          : value
      ));
    } catch {
      throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效数据，请检查认证信息");
    }
  }

  async function account(authorization) {
    const user = await request(authorization, "/iam/choerodon/v1/users/self");
    return { id: remoteId(user.id), name: user.realName || user.loginName || String(user.id) };
  }

  async function login(input) {
    const username = stringField(input.username, "username", { required: true, maxLength: 240 });
    // Password whitespace is significant; do not use stringField's trimming here.
    if (typeof input.password !== "string" || !input.password || input.password.length > 1024) {
      throw new ApiError(400, "CHOERODON_PASSWORD_REQUIRED", "请输入猪齿鱼密码");
    }
    const cookies = new Map();
    const state = randomUUID();
    const authorizeUrl = new URL("/oauth/oauth/authorize", API_ORIGIN);
    authorizeUrl.search = new URLSearchParams({
      response_type: "token", client_id: "choerodonparent",
      redirect_uri: "https://choerodon.com.cn/", state,
    }).toString();
    const verificationRequired = () => new ApiError(400, "CHOERODON_VERIFICATION_REQUIRED",
      "猪齿鱼要求验证码或额外验证，请在官网完成登录后切换到 Authorization 方式连接");

    async function send(url, body) {
      let response;
      try {
        response = await fetchImplementation(url, {
          method: body ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(20_000),
          headers: {
            accept: "text/html,application/json",
            ...(cookies.size ? { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") } : {}),
            ...(body ? { "content-type": "application/x-www-form-urlencoded", origin: API_ORIGIN, referer: `${API_ORIGIN}/oauth/login` } : {}),
          },
          ...(body ? { body: body.toString() } : {}),
        });
      } catch {
        throw new ApiError(502, "CHOERODON_UNAVAILABLE", "连接猪齿鱼登录服务失败，请稍后重试");
      }
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return response;
    }

    async function follow(url, body) {
      for (let redirects = 0; redirects < 8; redirects += 1) {
        const target = new URL(url);
        if (target.origin === "https://choerodon.com.cn") {
          const params = new URLSearchParams(target.hash.slice(1));
          const token = params.get("access_token");
          if (token && params.get("state") === state) return { token };
          throw new ApiError(502, "CHOERODON_TOKEN_MISSING", "猪齿鱼未返回有效的授权 token，请使用 Authorization 方式连接");
        }
        // Never forward the login password or session cookies to a redirect on another host.
        if (target.origin !== API_ORIGIN || !target.pathname.startsWith("/oauth/")) {
          throw verificationRequired();
        }
        const response = await send(target, body);
        if ([301, 302, 303].includes(response.status) && response.headers.has("location")) {
          const destination = new URL(response.headers.get("location"), target);
          // The login handler replaces the saved authorization URL and drops state.
          // Resume our original request with the newly authenticated session instead.
          url = body && target.pathname === "/oauth/login"
            && destination.origin === API_ORIGIN && destination.pathname === "/oauth/oauth/authorize"
            ? authorizeUrl.href : destination.href;
          body = undefined;
          continue;
        }
        if (!response.ok) {
          throw new ApiError(400, "CHOERODON_LOGIN_FAILED", "猪齿鱼登录失败，请检查账号密码，或在官网确认账号状态");
        }
        return { html: await response.text(), url: target };
      }
      throw new ApiError(502, "CHOERODON_LOGIN_REDIRECT", "猪齿鱼登录跳转未完成，请稍后重试");
    }

    const page = await follow(authorizeUrl);
    if (!page.html) throw new ApiError(502, "CHOERODON_LOGIN_PAGE_INVALID", "无法读取猪齿鱼登录页");
    const template = (html, id, attribute) => {
      const tag = html.match(new RegExp(`<template\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"))?.[0] ?? "";
      return tag.match(new RegExp(`\\b${attribute}=["']([^"']*)["']`, "i"))?.[1] ?? "";
    };
    if (template(page.html, "isNeedCaptchaTemplateData", "data-isNeedCaptcha") === "true") throw verificationRequired();
    const settingsResponse = await send(`${API_ORIGIN}/iam/choerodon/v1/system/setting/login?lang=zh_CN`);
    if (!settingsResponse.ok) throw new ApiError(502, "CHOERODON_LOGIN_PAGE_INVALID", "无法读取猪齿鱼登录设置");
    const settings = await settingsResponse.json();
    if (settings.loginGraph === "true" || settings.loginGraph === true) throw verificationRequired();
    const publicKey = template(page.html, "publicKeyTemplateData", "data-publicKey");
    if (!publicKey || !/^[A-Za-z0-9+/=\s]+$/.test(publicKey)) {
      throw new ApiError(502, "CHOERODON_LOGIN_PAGE_INVALID", "无法读取猪齿鱼登录公钥");
    }
    let encrypted;
    try {
      encrypted = publicEncrypt({
        key: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
        padding: constants.RSA_PKCS1_PADDING,
      }, Buffer.from(input.password, "utf8")).toString("base64");
    } catch {
      throw new ApiError(400, "CHOERODON_PASSWORD_ENCRYPTION_FAILED", "密码无法使用猪齿鱼登录公钥加密，请检查密码长度");
    }
    const result = await follow(`${API_ORIGIN}/oauth/login`, new URLSearchParams({ username, password: encrypted }));
    if (!result.token) {
      if (result.html && (template(result.html, "isNeedCaptchaTemplateData", "data-isNeedCaptcha") === "true"
        || result.url.pathname.includes("phone"))) throw verificationRequired();
      throw new ApiError(400, "CHOERODON_LOGIN_FAILED", "登录未成功，请检查账号密码；如需验证码或账号验证，请先在官网完成登录");
    }
    const authorization = await credentials({ authorization: result.token });
    const [user, items] = await Promise.all([account(authorization), organizations(authorization)]);
    return { authorization, account: user, organizations: items };
  }

  async function organizations(authorization) {
    return choices(await request(authorization, "/iam/choerodon/v1/users/self-tenants"), "tenantId", "tenantName");
  }

  async function projects(authorization, organizationId, userId) {
    const items = [];
    for (let page = 0; ; page += 1) {
      const result = await request(
        authorization,
        `/cbase/choerodon/v1/organizations/${organizationId}/users/${userId}/projects/paging?page=${page}&size=20&button_permission=true&business_type=project`,
        organizationId,
        {},
      );
      if (!Number.isInteger(result.totalPages) || result.totalPages < 0) {
        throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效的项目分页信息");
      }
      items.push(...choices(result.content, "id", "name"));
      if (page + 1 >= result.totalPages) return items;
    }
  }

  async function boards(authorization, organizationId, projectId) {
    return choices(
      await request(authorization, `/agile/v1/projects/${projectId}/board?type=agile`, organizationId),
      "boardId",
      "name",
    );
  }

  async function boardIssues(issueIds = []) {
    const config = await read();
    if (!config) throw new ApiError(400, "CHOERODON_NOT_CONFIGURED", "请先连接猪齿鱼");
    const { organization, project, board } = config;
    const data = await request(config.authorization,
      `/agile/v2/projects/${project.id}/board/${board.id}/all_data/${organization.id}`,
      organization.id, {});
    if (!Array.isArray(data?.columnsData?.columns)) {
      throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效的看板列");
    }
    const columns = data.columnsData.columns;
    const groups = choices(columns, "columnId", "name");
    const issues = new Map();
    for (const [index, column] of columns.entries()) {
      if (!Array.isArray(column.subStatusDTOS)) throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "看板列缺少状态列表");
      for (const status of column.subStatusDTOS) {
        if (!Array.isArray(status.issues)) throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "看板列缺少任务列表");
        for (const issue of status.issues) {
          const id = remoteId(issue.issueId);
          issues.set(id, {
            id,
            key: stringField(issue.issueNum, "issueNum", { required: true, maxLength: 128 }),
            title: stringField(issue.summary, "summary", { required: true, maxLength: 240 }),
            type: issue.issueTypeVO?.name ?? "任务",
            status: status.name,
            groupId: groups[index].id,
            groupName: groups[index].name,
            priority: ({ "最高": "urgent", "紧急": "urgent", "高": "high", "中": "medium", "低": "low", "最低": "low" })[issue.priorityVO?.name] ?? "none",
            priorityName: issue.priorityVO?.name ?? "无优先级",
            assignee: issue.assigneeId ? {
              type: "user", id: `choerodon:${remoteId(issue.assigneeId)}`,
              name: stringField(issue.assigneeRealName || issue.assigneeName, "assigneeName", { required: true, maxLength: 240 }), avatarUrl: null,
            } : { type: "user", id: "unassigned", name: "未分配", avatarUrl: null },
            startDate: parseDueDate(issue.estimatedStartTime?.slice(0, 10) ?? null, "startDate"),
            dueDate: parseDueDate(issue.estimatedEndTime?.slice(0, 10) ?? null),
          });
        }
      }
    }
    for (const id of new Set(issueIds)) {
      const issue = issues.get(id);
      if (!issue) continue;
      const detail = await request(config.authorization,
        `/agile/v1/projects/${project.id}/issues/${id}?organizationId=${organization.id}`,
        organization.id);
      const description = typeof detail?.description === "string"
        ? descriptionMarkdown.turndown(detail.description).trim()
        : "";
      issue.description = stringField(description || `来源：猪齿鱼 / ${project.name} / ${board.name}\n任务编号：${issue.key}\n猪齿鱼任务 ID：${issue.id}`, "description", { maxLength: 100_000 });
      const commentsPath = `/agile/v1/projects/${project.id}/issue_comment`;
      const comments = await request(config.authorization, `${commentsPath}/${id}`, organization.id);
      if (!Array.isArray(comments)) throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效的评论列表");
      issue.comments = [];
      for (const comment of comments) {
        const normalized = normalizedComment(comment);
        issue.comments.push(normalized);
        if (comment.replySize > 0) {
          const replies = await request(config.authorization, `${commentsPath}/reply/${normalized.id}`, organization.id);
          if (!Array.isArray(replies)) throw new ApiError(502, "INVALID_CHOERODON_RESPONSE", "猪齿鱼未返回有效的回复列表");
          issue.comments.push(...replies.map((reply) => normalizedComment(reply, normalized.id)));
        }
      }
    }
    return { organization, project, board, groups, issues: [...issues.values()] };
  }

  return {
    boardIssues,
    login,
    async status() {
      return publicConnection(await read());
    },
    async options(input) {
      const authorization = await credentials(input);
      if (input.resource === "organizations") {
        const [user, items] = await Promise.all([account(authorization), organizations(authorization)]);
        return { account: user, organizations: items };
      }
      const organizationId = remoteId(input.organizationId);
      if (input.resource === "projects") {
        const user = await account(authorization);
        return { projects: await projects(authorization, organizationId, user.id) };
      }
      if (input.resource === "boards") {
        return { boards: await boards(authorization, organizationId, remoteId(input.projectId)) };
      }
      throw new ApiError(400, "INVALID_CHOERODON_RESOURCE", "请选择组织、项目或看板");
    },
    async configure(input) {
      const authorization = await credentials(input);
      const [user, organizationList] = await Promise.all([account(authorization), organizations(authorization)]);
      const organization = selected(organizationList, input.organizationId, "组织");
      const project = selected(await projects(authorization, organization.id, user.id), input.projectId, "项目");
      const board = selected(await boards(authorization, organization.id, project.id), input.boardId, "看板");
      const config = { authorization, account: user, organization, project, board };
      await mkdir(path.dirname(configPath), { recursive: true });
      const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
      await chmod(temporaryPath, 0o600);
      await rename(temporaryPath, configPath);
      return publicConnection(config);
    },
  };
}
