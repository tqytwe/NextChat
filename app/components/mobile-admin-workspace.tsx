"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./mobile-app.module.scss";
import { localizedMobileDisplay } from "../client/mobile-display";
import {
  getMobileAdminDashboardSnapshot,
  getMobileAdminPaymentDashboard,
  getMobileAdminUserWalletHistory,
  getMobileAdminUserWalletReconciliation,
  listMobileAdminAuditLogs,
  listMobileAdminGroups,
  listMobileAdminModelCatalog,
  listMobileAdminOrders,
  listMobileAdminRefundRequests,
  listMobileAdminUsage,
  listMobileAdminUsageCleanupTasks,
  listMobileAdminUsers,
  listMobileAdminWithdrawals,
  mobileAdminRequestId,
  verifyMobileAdminStepUp,
} from "../client/mobile-admin";
import type {
  MobileAdminClient,
  MobileAdminPage,
} from "../client/mobile-admin";
import type { ManagedMobileText } from "../client/managed-mobile-i18n";

type AdminView = "overview" | "users" | "operations" | "funds" | "audit";
type AdminRecord = Record<string, unknown>;

type AdminData = {
  snapshot?: unknown;
  payment?: unknown;
  users?: MobileAdminPage<AdminRecord>;
  groups?: MobileAdminPage<AdminRecord>;
  models?: unknown[];
  usage?: MobileAdminPage<AdminRecord>;
  cleanup?: MobileAdminPage<AdminRecord>;
  orders?: MobileAdminPage<AdminRecord>;
  withdrawals?: MobileAdminPage<AdminRecord>;
  refunds?: MobileAdminPage<AdminRecord>;
  audit?: MobileAdminPage<AdminRecord>;
};

type SelectedUser = {
  user: AdminRecord;
  history?: unknown;
  reconciliation?: unknown;
  loading: boolean;
  error?: string;
};

const VIEWS: AdminView[] = [
  "overview",
  "users",
  "operations",
  "funds",
  "audit",
];

const STATUS_LABELS: Record<string, [string, string]> = {
  active: ["启用", "Active"],
  enabled: ["启用", "Enabled"],
  disabled: ["停用", "Disabled"],
  pending: ["待处理", "Pending"],
  paid: ["已支付", "Paid"],
  completed: ["已完成", "Completed"],
  failed: ["失败", "Failed"],
  cancelled: ["已取消", "Cancelled"],
  refunded: ["已退款", "Refunded"],
  processing: ["处理中", "Processing"],
  running: ["运行中", "Running"],
  queued: ["排队中", "Queued"],
  succeeded: ["成功", "Succeeded"],
  rejected: ["已拒绝", "Rejected"],
};

const FIELD_LABELS: Record<string, [string, string]> = {
  id: ["编号", "ID"],
  user_id: ["用户编号", "User ID"],
  email: ["邮箱", "Email"],
  username: ["用户名", "Username"],
  role: ["角色", "Role"],
  status: ["状态", "Status"],
  balance: ["余额", "Balance"],
  amount: ["金额", "Amount"],
  pay_amount: ["实付金额", "Paid amount"],
  total_amount: ["总金额", "Total amount"],
  created_at: ["创建时间", "Created"],
  updated_at: ["更新时间", "Updated"],
  paid_at: ["支付时间", "Paid at"],
  model: ["模型", "Model"],
  model_name: ["模型名称", "Model name"],
  group_id: ["分组编号", "Group ID"],
  request_id: ["请求编号", "Request ID"],
  action: ["操作", "Action"],
  method: ["方法", "Method"],
  path: ["路径", "Path"],
  success: ["是否成功", "Success"],
};

function record(value: unknown): AdminRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AdminRecord)
    : {};
}

function page(value: unknown): MobileAdminPage<AdminRecord> {
  const current = record(value);
  const items = Array.isArray(current.items) ? current.items.map(record) : [];
  return {
    items,
    total: Number(current.total || items.length),
    page: Number(current.page || 1),
    page_size: Number(current.page_size || items.length || 20),
    pages: Number(current.pages || 1),
  };
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const current = record(value);
  return Array.isArray(current.items) ? current.items : [];
}

function first(value: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (current !== null && current !== undefined && String(current).trim()) {
      return current;
    }
  }
  return "";
}

function numberValue(value: AdminRecord, keys: string[]) {
  const current = first(value, keys);
  const parsed = Number(current);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: unknown, text: ManagedMobileText) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "✓" : "-";
  if (typeof value === "number") return value.toLocaleString(text.dateLocale);
  if (typeof value === "string") {
    const normalized = value.trim();
    const status = STATUS_LABELS[normalized.toLowerCase()];
    if (status) return text.dateLocale.startsWith("zh") ? status[0] : status[1];
    if (/^\d{4}-\d\d-\d\d[T ]/.test(normalized)) {
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat(text.dateLocale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
      }
    }
    return normalized.length > 160
      ? `${normalized.slice(0, 157)}...`
      : normalized;
  }
  return JSON.stringify(value);
}

function fieldLabel(key: string, text: ManagedMobileText) {
  const label = FIELD_LABELS[key.toLowerCase()];
  if (label) return text.dateLocale.startsWith("zh") ? label[0] : label[1];
  return key.replace(/_/g, " ");
}

function displayName(user: AdminRecord, text: ManagedMobileText) {
  const localized = localizedMobileDisplay(user, {
    fallback: String(first(user, ["email", "username", "name", "id"]) || "-"),
    locale: text.dateLocale.startsWith("zh") ? "cn" : "en",
  });
  return (
    localized || String(first(user, ["email", "username", "name", "id"]) || "-")
  );
}

function fieldEntries(value: unknown, text: ManagedMobileText, limit = 6) {
  return Object.entries(record(value))
    .filter(([, item]) => item !== null && item !== undefined && item !== "")
    .filter(
      ([key]) => !["items", "data", "metadata", "localized"].includes(key),
    )
    .slice(0, limit)
    .map(([key, item]) => ({
      key: fieldLabel(key, text),
      value: formatValue(item, text),
    }));
}

function AdminCard(props: { title: string; value: string; detail?: string }) {
  return (
    <article className={styles["admin-summary-card"]}>
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      {props.detail && <small>{props.detail}</small>}
    </article>
  );
}

function AdminList(props: {
  title: string;
  items: unknown[];
  text: ManagedMobileText;
  empty: string;
  onSelect?: (item: AdminRecord) => void;
}) {
  return (
    <section className={styles["section"]}>
      <div className={styles["section-head"]}>
        <h2>{props.title}</h2>
        <span>{props.items.length || 0}</span>
      </div>
      {props.items.length ? (
        <div className={styles["admin-list"]}>
          {props.items.map((item, index) => {
            const current = record(item);
            const title = String(
              first(current, [
                "title",
                "name",
                "email",
                "out_trade_no",
                "id",
              ]) || `#${index + 1}`,
            );
            const body = fieldEntries(current, props.text, 4);
            const content = (
              <>
                <strong>{title}</strong>
                <div className={styles["admin-list-fields"]}>
                  {body.map((field) => (
                    <span key={field.key}>
                      {field.key}: {field.value}
                    </span>
                  ))}
                </div>
              </>
            );
            return props.onSelect ? (
              <button
                type="button"
                className={styles["admin-list-button"]}
                key={`${title}-${index}`}
                onClick={() => props.onSelect?.(current)}
              >
                {content}
              </button>
            ) : (
              <article
                className={styles["admin-list-item"]}
                key={`${title}-${index}`}
              >
                {content}
              </article>
            );
          })}
        </div>
      ) : (
        <p className={styles["empty-copy"]}>{props.empty}</p>
      )}
    </section>
  );
}

export function MobileAdminWorkspace(props: {
  client: MobileAdminClient;
  text: ManagedMobileText;
}) {
  const labels = props.text.account.adminWorkspace;
  const [view, setView] = useState<AdminView>("overview");
  const [data, setData] = useState<AdminData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [search, setSearch] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpMessage, setStepUpMessage] = useState("");
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  const client = useMemo(() => props.client, [props.client]);

  const load = useCallback(
    async (nextView: AdminView, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        if (nextView === "overview") {
          const [snapshot, payment] = await Promise.all([
            getMobileAdminDashboardSnapshot(client, {
              signal,
              locale: props.text.dateLocale,
            }),
            getMobileAdminPaymentDashboard(client, undefined, {
              signal,
              locale: props.text.dateLocale,
            }),
          ]);
          setData((current) => ({
            ...current,
            snapshot: snapshot.data,
            payment: payment.data,
          }));
          setRequestId(payment.requestId || snapshot.requestId);
        } else if (nextView === "users") {
          const result = await listMobileAdminUsers<AdminRecord>(
            client,
            { page: 1, page_size: 20, search: search.trim() },
            { signal, locale: props.text.dateLocale },
          );
          setData((current) => ({ ...current, users: result.data }));
          setRequestId(result.requestId);
        } else if (nextView === "operations") {
          const [groups, models, usage, cleanup] = await Promise.all([
            listMobileAdminGroups<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminModelCatalog<AdminRecord>(client, undefined, {
              signal,
              locale: props.text.dateLocale,
            }),
            listMobileAdminUsage<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminUsageCleanupTasks<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
          ]);
          setData((current) => ({
            ...current,
            groups: groups.data,
            models: array(models.data).map(record),
            usage: usage.data,
            cleanup: cleanup.data,
          }));
          setRequestId(
            cleanup.requestId || usage.requestId || groups.requestId,
          );
        } else if (nextView === "funds") {
          const [orders, withdrawals, refunds] = await Promise.all([
            listMobileAdminOrders<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminWithdrawals<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminRefundRequests<AdminRecord>(
              client,
              { page: 1, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
          ]);
          setData((current) => ({
            ...current,
            orders: orders.data,
            withdrawals: withdrawals.data,
            refunds: refunds.data,
          }));
          setRequestId(
            refunds.requestId || withdrawals.requestId || orders.requestId,
          );
        } else {
          const result = await listMobileAdminAuditLogs<AdminRecord>(
            client,
            { page: 1, page_size: 30 },
            { signal, locale: props.text.dateLocale },
          );
          setData((current) => ({ ...current, audit: result.data }));
          setRequestId(result.requestId);
        }
      } catch (caught) {
        if (signal?.aborted) return;
        setError(caught instanceof Error ? caught.message : labels.unavailable);
        setRequestId(mobileAdminRequestId(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [client, labels.unavailable, props.text.dateLocale, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(view, controller.signal);
    return () => controller.abort();
  }, [load, view]);

  async function verifyStepUpCode() {
    if (!/^\d{6}$/.test(stepUpCode.trim())) {
      setStepUpMessage(labels.stepUpFailed);
      return;
    }
    setStepUpBusy(true);
    setStepUpMessage("");
    try {
      const result = await verifyMobileAdminStepUp(client, stepUpCode, {
        locale: props.text.dateLocale,
      });
      setStepUpMessage(
        labels.stepUpVerified(Number(result.data.expires_in || 0)),
      );
      setStepUpCode("");
      setRequestId(result.requestId);
    } catch (caught) {
      setStepUpMessage(
        caught instanceof Error ? caught.message : labels.stepUpFailed,
      );
      setRequestId(mobileAdminRequestId(caught));
    } finally {
      setStepUpBusy(false);
    }
  }

  async function inspectUser(user: AdminRecord) {
    const userId = first(user, ["id", "user_id"]);
    if (!userId) return;
    setSelectedUser({ user, loading: true });
    try {
      const [history, reconciliation] = await Promise.all([
        getMobileAdminUserWalletHistory(
          client,
          String(userId),
          { page: 1, page_size: 20 },
          { locale: props.text.dateLocale },
        ),
        getMobileAdminUserWalletReconciliation(client, String(userId), {
          locale: props.text.dateLocale,
        }),
      ]);
      setSelectedUser({
        user,
        history: history.data,
        reconciliation: reconciliation.data,
        loading: false,
      });
      setRequestId(reconciliation.requestId || history.requestId);
    } catch (caught) {
      setSelectedUser({
        user,
        loading: false,
        error: caught instanceof Error ? caught.message : labels.unavailable,
      });
      setRequestId(mobileAdminRequestId(caught));
    }
  }

  const snapshot = record(data.snapshot);
  const overview = record(snapshot.overview || snapshot.data || snapshot);
  const payment = record(data.payment);
  const users = data.users || page(undefined);

  return (
    <div className={styles["admin-workspace"]}>
      <p className={styles["admin-readonly-hint"]}>{labels.readonlyHint}</p>
      <div
        className={styles["admin-tabs"]}
        role="tablist"
        aria-label={labels.summary}
      >
        {VIEWS.map((item) => {
          const title = labels[item];
          return (
            <button
              type="button"
              role="tab"
              aria-selected={view === item}
              className={view === item ? styles["active"] : ""}
              key={item}
              onClick={() => setView(item)}
            >
              {title}
            </button>
          );
        })}
      </div>
      <div className={styles["admin-toolbar"]}>
        <button
          type="button"
          onClick={() => void load(view)}
          disabled={loading}
        >
          {labels.refresh}
        </button>
        {loading && <span>{labels.loading}</span>}
      </div>
      {error && <div className={styles["form-error"]}>{error}</div>}
      {requestId && (
        <small className={styles["admin-request-id"]}>
          {labels.request}: {requestId}
        </small>
      )}

      {view === "overview" && (
        <>
          <section className={styles["admin-summary-grid"]}>
            <AdminCard
              title={labels.total}
              value={String(
                numberValue(overview, [
                  "total_users",
                  "users",
                  "active_users",
                ]) ?? "-",
              )}
              detail={labels.users}
            />
            <AdminCard
              title={labels.summary}
              value={String(
                numberValue(overview, [
                  "total_requests",
                  "requests",
                  "request_count",
                ]) ?? "-",
              )}
              detail={labels.usage}
            />
            <AdminCard
              title={labels.paymentSummary}
              value={String(
                numberValue(payment, [
                  "total_revenue",
                  "revenue",
                  "paid_amount",
                  "total_amount",
                ]) ?? "-",
              )}
              detail={labels.orders}
            />
          </section>
          <AdminList
            title={labels.summary}
            items={array(overview.items || overview.metrics || overview)}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.paymentSummary}
            items={array(payment.items || payment.orders || payment)}
            text={props.text}
            empty={labels.empty}
          />
        </>
      )}

      {view === "users" && (
        <>
          <section className={styles["section"]}>
            <label className={styles["field-card"]}>
              <span>{labels.userSearch}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={labels.userSearch}
              />
            </label>
          </section>
          <AdminList
            title={`${labels.users} · ${users.total}`}
            items={users.items}
            text={props.text}
            empty={labels.noUsers}
            onSelect={(user) => void inspectUser(user)}
          />
          {selectedUser && (
            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{displayName(selectedUser.user, props.text)}</h2>
                <button type="button" onClick={() => setSelectedUser(null)}>
                  {labels.closeUser}
                </button>
              </div>
              {selectedUser.loading && (
                <p className={styles["empty-copy"]}>{labels.loading}</p>
              )}
              {selectedUser.error && (
                <div className={styles["form-error"]}>{selectedUser.error}</div>
              )}
              {!selectedUser.loading && !selectedUser.error && (
                <>
                  <AdminList
                    title={labels.reconciliation}
                    items={[selectedUser.reconciliation]}
                    text={props.text}
                    empty={labels.empty}
                  />
                  <AdminList
                    title={labels.balanceHistory}
                    items={array(selectedUser.history)}
                    text={props.text}
                    empty={labels.empty}
                  />
                </>
              )}
            </section>
          )}
        </>
      )}

      {view === "operations" && (
        <>
          <AdminList
            title={labels.groups}
            items={data.groups?.items || []}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.models}
            items={data.models || []}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.usage}
            items={data.usage?.items || []}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.cleanup}
            items={data.cleanup?.items || []}
            text={props.text}
            empty={labels.empty}
          />
        </>
      )}

      {view === "funds" && (
        <>
          <AdminList
            title={labels.orders}
            items={data.orders?.items || []}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.withdrawals}
            items={data.withdrawals?.items || []}
            text={props.text}
            empty={labels.empty}
          />
          <AdminList
            title={labels.refunds}
            items={data.refunds?.items || []}
            text={props.text}
            empty={labels.empty}
          />
        </>
      )}

      {view === "audit" && (
        <AdminList
          title={labels.auditLogs}
          items={data.audit?.items || []}
          text={props.text}
          empty={labels.empty}
        />
      )}

      <section className={styles["admin-stepup"]}>
        <div>
          <h2>{labels.stepUp}</h2>
          <p>{labels.stepUpHint}</p>
        </div>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={stepUpCode}
          onChange={(event) =>
            setStepUpCode(
              event.currentTarget.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          placeholder={labels.stepUpCode}
          aria-label={labels.stepUpCode}
        />
        <button
          type="button"
          onClick={() => void verifyStepUpCode()}
          disabled={stepUpBusy || stepUpCode.length !== 6}
        >
          {stepUpBusy ? labels.loading : labels.stepUpVerify}
        </button>
        {stepUpMessage && (
          <p className={styles["form-success"]}>{stepUpMessage}</p>
        )}
      </section>
    </div>
  );
}
