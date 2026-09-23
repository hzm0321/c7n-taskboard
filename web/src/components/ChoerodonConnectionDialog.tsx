import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { configureChoerodonConnection, getChoerodonConnection, getChoerodonOptions, loginChoerodon } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { ChoerodonChoice, ChoerodonConnection } from "../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function ChoerodonConnectionDialog({ onClose }: { onClose: () => void }) {
  const { text } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const loginCredentials = useRef<{ username: string; password: string } | null>(null);
  const [selectContainer, setSelectContainer] = useState<HTMLDivElement | null>(null);
  const [connection, setConnection] = useState<ChoerodonConnection | null>(null);
  const [authMode, setAuthMode] = useState("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [account, setAccount] = useState<ChoerodonChoice | null>(null);
  const [organizations, setOrganizations] = useState<ChoerodonChoice[]>([]);
  const [projects, setProjects] = useState<ChoerodonChoice[]>([]);
  const [boards, setBoards] = useState<ChoerodonChoice[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState<string | null>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    void getChoerodonConnection().then((value) => {
      if (!active) return;
      setConnection(value);
      setAccount(value.account);
      setOrganizations(value.organization ? [value.organization] : []);
      setProjects(value.project ? [value.project] : []);
      setBoards(value.board ? [value.board] : []);
      setOrganizationId(value.organization?.id ?? "");
      setProjectId(value.project?.id ?? "");
      setBoardId(value.board?.id ?? "");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setPending(null);
    });
    return () => { active = false; };
  }, []);

  async function run(action: string, operation: () => Promise<void>) {
    setPending(action);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(null);
    }
  }

  function resetSelection() {
    loginCredentials.current = null;
    setError(null);
    setVerified(false);
    setAccount(null);
    setOrganizationId("");
    setProjectId("");
    setBoardId("");
    setOrganizations([]);
    setProjects([]);
    setBoards([]);
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    resetSelection();
    await run("login", async () => {
      const result = await loginChoerodon({ username, password });
      setAuthorization(result.authorization);
      loginCredentials.current = { username, password };
      setPassword("");
      setAccount(result.account);
      setOrganizations(result.organizations);
      setVerified(true);
      toast.success(text("猪齿鱼登录成功", "Signed in to Choerodon"));
    });
  }

  async function authenticate() {
    resetSelection();
    await run("organizations", async () => {
      const result = await getChoerodonOptions({ resource: "organizations", authorization });
      setAccount(result.account ?? null);
      setOrganizations(result.organizations ?? []);
      setVerified(true);
    });
  }

  async function selectOrganization(id: string) {
    setOrganizationId(id);
    setProjectId("");
    setBoardId("");
    setProjects([]);
    setBoards([]);
    if (!id) return;
    await run("projects", async () => {
      const result = await getChoerodonOptions({ resource: "projects", authorization, organizationId: id });
      setProjects(result.projects ?? []);
    });
  }

  async function selectProject(id: string) {
    setProjectId(id);
    setBoardId("");
    setBoards([]);
    if (!id) return;
    await run("boards", async () => {
      const result = await getChoerodonOptions({ resource: "boards", authorization, organizationId, projectId: id });
      setBoards(result.boards ?? []);
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !boardId) return;
    await run("save", async () => {
      await configureChoerodonConnection({ authorization, ...loginCredentials.current, organizationId, projectId, boardId });
      onClose();
      toast.success(text("猪齿鱼连接配置已保存", "Choerodon connection saved"));
    });
  }

  const busy = pending !== null;
  return (
    <dialog
      ref={dialog}
      className="delete-dialog project-create-dialog choerodon-connection-dialog"
      aria-labelledby="choerodon-connection-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="choerodon-sync-header">
        <div className="choerodon-sync-heading">
          <div>
            <h2 id="choerodon-connection-title">{text("连接猪齿鱼", "Connect Choerodon")}</h2>
            <p>{text("登录猪齿鱼，选择要连接的组织、项目和看板。", "Sign in and choose your organization, project, and board.")}</p>
          </div>
          <Button variant="ghost" size="icon" className="icon-button" type="button" disabled={busy} onClick={onClose} aria-label={text("关闭", "Close")}><X size={16} /></Button>
        </div>
      </header>
      <div className="choerodon-connection-body">
        <Tabs value={authMode} onValueChange={(value) => { setAuthMode(value); setPassword(""); setError(null); }}>
          <TabsList className="choerodon-auth-tabs" aria-label={text("登录方式", "Sign-in method")}>
            <TabsTrigger value="password" disabled={busy}>{text("账号密码登录", "Account and password")}</TabsTrigger>
            <TabsTrigger value="token" disabled={busy}>Authorization</TabsTrigger>
          </TabsList>
          <TabsContent value="password">
            <form onSubmit={(event) => void signIn(event)} aria-label={text("猪齿鱼账号登录", "Choerodon account sign-in")}>
              <label>
                <span>{text("登录名", "Username")}</span>
                <input autoFocus name="username" autoComplete="username" required maxLength={240} disabled={busy} value={username}
                  placeholder={text("请输入猪齿鱼登录名", "Enter your Choerodon username")}
                  onChange={(event) => { setUsername(event.target.value); resetSelection(); }} />
              </label>
              <label>
                <span>{text("密码", "Password")}</span>
                <input name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} value={password}
                  aria-describedby="choerodon-password-hint" placeholder={text("请输入密码", "Enter your password")}
                  onChange={(event) => { setPassword(event.target.value); resetSelection(); }} />
              </label>
              <p id="choerodon-password-hint" className="choerodon-connection-hint">{text("保存配置后，账号密码仅保存在本机，用于 Token 过期时自动重新登录。", "After saving, credentials stay on this device for automatic sign-in when the token expires.")}</p>
              <Button variant="default" size="sm" type="submit" className="button primary choerodon-auth-submit" disabled={busy || !username.trim() || !password}>
                {pending === "login" ? text("登录中…", "Signing in…") : text("登录并加载组织", "Sign in and load organizations")}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="token">
            <form onSubmit={(event) => { event.preventDefault(); if (!busy) void authenticate(); }} aria-label="Authorization">
              <label>
                <span>{text("认证信息（Authorization）", "Authorization")}</span>
                <input
                  autoFocus
                  type="password"
                  autoComplete="off"
                  maxLength={8192}
                  disabled={busy}
                  value={authorization}
                  aria-describedby="choerodon-auth-hint"
                  placeholder={connection?.configured
                    ? text("已保存；留空则使用原认证信息", "Saved; leave blank to use existing credentials")
                    : text("粘贴 token 或完整 Authorization", "Paste a token or complete Authorization value")}
                  onChange={(event) => { setAuthorization(event.target.value); resetSelection(); }}
                />
              </label>
              <p id="choerodon-auth-hint" className="choerodon-connection-hint">
                {text("支持 token 或完整 Authorization 值。仅填写 token 时自动使用 Bearer 认证，认证信息仅保存在本机。", "Accepts a token or complete Authorization value. Tokens use Bearer authentication. Credentials are stored only on this device.")}
              </p>
              <Button variant="outline" size="sm"
                type="submit"
                className="button secondary choerodon-auth-submit"
                disabled={busy || (!authorization.trim() && !connection?.configured)}
              >
                {pending === "organizations" ? text("验证中…", "Verifying…") : text("验证并加载组织", "Verify and load organizations")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <form className="choerodon-connection-selection" onSubmit={(event) => void save(event)}>
          {account && <p className="choerodon-connection-account" role="status">{text("当前账号：", "Account: ")}{account.name}</p>}
          {/* Radix may emit an empty value while synchronizing its hidden form select. */}
          <label htmlFor="choerodon-organization">
            <span>{text("组织", "Organization")}</span>
            <Select value={organizationId} disabled={busy || !verified} required onValueChange={(id) => { if (id) void selectOrganization(id); }}>
              <SelectTrigger id="choerodon-organization" size="sm" className="w-full">
                <SelectValue placeholder={verified && organizations.length === 0 ? text("当前账号暂无可选组织", "No organizations available") : text("请选择组织", "Select an organization")} />
              </SelectTrigger>
              <SelectContent container={selectContainer}>
                {organizations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label htmlFor="choerodon-project">
            <span>{text("项目", "Project")}</span>
            <Select value={projectId} disabled={busy || !verified || !organizationId} required onValueChange={(id) => { if (id) void selectProject(id); }}>
              <SelectTrigger id="choerodon-project" size="sm" className="w-full">
                <SelectValue placeholder={pending === "projects" ? text("加载项目中…", "Loading projects…") : organizationId && projects.length === 0 ? text("当前组织暂无可选项目", "No projects available") : text("请选择项目", "Select a project")} />
              </SelectTrigger>
              <SelectContent container={selectContainer}>
                {projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label htmlFor="choerodon-board">
            <span>{text("看板", "Board")}</span>
            <Select value={boardId} disabled={busy || !verified || !projectId} required onValueChange={(id) => { if (id) setBoardId(id); }}>
              <SelectTrigger id="choerodon-board" size="sm" className="w-full">
                <SelectValue placeholder={pending === "boards" ? text("加载看板中…", "Loading boards…") : projectId && boards.length === 0 ? text("当前项目暂无可选看板", "No boards available") : text("请选择看板", "Select a board")} />
              </SelectTrigger>
              <SelectContent container={selectContainer}>
                {boards.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          {/* Keep Select portals in the native dialog's modal top layer. */}
          <div ref={setSelectContainer} />
          <div className="choerodon-connection-actions">
            <Button variant="outline" size="sm" className="button secondary" type="button" disabled={busy} onClick={onClose}>{text("关闭", "Close")}</Button>
            <Button variant="default" size="sm" className="button primary" type="submit" disabled={busy || !organizationId || !projectId || !boardId}>
              {pending === "save" ? text("保存中…", "Saving…") : text("保存配置", "Save configuration")}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
