"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import styles from "./mobile-app.module.scss";
import {
  acceptMobileAdminCompliance,
  getMobileAdminComplianceStatus,
  getMobileAdminDashboardSnapshot,
  getMobileAdminAuditLog,
  getMobileAdminGroup,
  getMobileAdminGroupStats,
  getMobileAdminMobileFeedback,
  getMobileAdminOrder,
  getMobileAdminPaymentDashboard,
  getMobileAdminRefundRequest,
  getMobileAdminSubscription,
  getMobileAdminSubscriptionProgress,
  getMobileAdminUser,
  getMobileAdminUserUsage,
  getMobileAdminUserWalletHistory,
  getMobileAdminUserWalletReconciliation,
  getMobileAdminWithdrawal,
  listMobileAdminAuditLogs,
  listMobileAdminGroups,
  listMobileAdminModelCatalog,
  listMobileAdminMobileFeedback,
  listMobileAdminOrders,
  listMobileAdminRefundRequests,
  listMobileAdminSubscriptions,
  listMobileAdminUsage,
  listMobileAdminUsageCleanupTasks,
  listMobileAdminUserSubscriptions,
  listMobileAdminUsers,
  listMobileAdminWithdrawals,
  mobileAdminErrorCode,
  mobileAdminErrorMetadata,
  mobileAdminRequestId,
  verifyMobileAdminStepUp,
} from "../client/mobile-admin";
import type {
  MobileAdminClient,
  MobileAdminComplianceStatus,
  MobileAdminPage,
} from "../client/mobile-admin";
import type { ManagedMobileText } from "../client/managed-mobile-i18n";
import { openExternalUrl } from "../client/android-native";
import { isMobileAdminComplianceAvailable } from "../client/mobile-capabilities";

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
  tickets?: MobileAdminPage<AdminRecord>;
  orders?: MobileAdminPage<AdminRecord>;
  subscriptions?: MobileAdminPage<AdminRecord>;
  withdrawals?: MobileAdminPage<AdminRecord>;
  refunds?: MobileAdminPage<AdminRecord>;
  audit?: MobileAdminPage<AdminRecord>;
};

type AdminPageKey =
  | "users"
  | "groups"
  | "usage"
  | "cleanup"
  | "tickets"
  | "orders"
  | "subscriptions"
  | "withdrawals"
  | "refunds"
  | "audit";

type AdminDetailKind =
  | "user"
  | "order"
  | "subscription"
  | "group"
  | "withdrawal"
  | "refund"
  | "ticket"
  | "audit"
  | "model"
  | "usage"
  | "cleanup";

type AdminDetailSection = {
  title: string;
  data: unknown;
};

type SelectedAdminDetail = {
  kind: AdminDetailKind;
  title: string;
  source: AdminRecord;
  sections: AdminDetailSection[];
  loading: boolean;
  error?: string;
};

const INITIAL_PAGES: Record<AdminPageKey, number> = {
  users: 1,
  groups: 1,
  usage: 1,
  cleanup: 1,
  tickets: 1,
  orders: 1,
  subscriptions: 1,
  withdrawals: 1,
  refunds: 1,
  audit: 1,
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

function stringField(value: Record<string, unknown> | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" ? field.trim() : "";
}

function requiredComplianceFromError(error: unknown) {
  if (
    mobileAdminErrorCode(error).toUpperCase() !==
    "ADMIN_COMPLIANCE_ACK_REQUIRED"
  ) {
    return null;
  }
  const metadata = mobileAdminErrorMetadata(error);
  return {
    required: true,
    version: stringField(metadata, "version"),
    document_path_zh: stringField(metadata, "document_path_zh") || undefined,
    document_path_en: stringField(metadata, "document_path_en") || undefined,
    document_url_zh: stringField(metadata, "document_url_zh") || undefined,
    document_url_en: stringField(metadata, "document_url_en") || undefined,
  } satisfies MobileAdminComplianceStatus;
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

function recordID(value: AdminRecord) {
  const id = first(value, ["id", "user_id", "feedback_id", "order_id"]);
  const normalized = String(id).trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : "";
}

function recordTitle(value: AdminRecord, fallback: string) {
  return String(
    first(value, [
      "title",
      "name",
      "email",
      "out_trade_no",
      "model_name",
      "model",
      "action",
      "id",
    ]) || fallback,
  );
}

const SENSITIVE_ADMIN_FIELD =
  /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|private[_-]?key|payout|bank[_-]?(?:account|number)|card[_-]?number|withdrawal[_-]?(?:address|account)|(?:crypto|wallet)[_-]?(?:address|account)|recipient|beneficiary)/i;

function safeAdminDetail(value: unknown, key = ""): unknown {
  if (SENSITIVE_ADMIN_FIELD.test(key)) return "[protected]";
  if (Array.isArray(value)) return value.map((item) => safeAdminDetail(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, item]) => [
      entryKey,
      safeAdminDetail(item, entryKey),
    ]),
  );
}

function detailEntries(value: unknown, text: ManagedMobileText) {
  return Object.entries(record(safeAdminDetail(value)))
    .filter(([, item]) => item !== null && item !== undefined && item !== "")
    .map(([key, item]) => ({
      key: fieldLabel(key, text),
      value:
        typeof item === "object"
          ? JSON.stringify(item, null, 2)
          : formatValue(item, text),
    }));
}

function AdminPageControls(props: {
  page: MobileAdminPage<AdminRecord>;
  text: ManagedMobileText;
  loading: boolean;
  onPage: (nextPage: number) => void;
}) {
  const labels = props.text.account.adminWorkspace;
  const currentPage = Math.max(1, props.page.page || 1);
  const totalPages = Math.max(1, props.page.pages || 1);

  if (totalPages <= 1) return null;
  return (
    <div className={styles["admin-page-controls"]}>
      <button
        type="button"
        disabled={props.loading || currentPage <= 1}
        onClick={() => props.onPage(currentPage - 1)}
      >
        {labels.previousPage}
      </button>
      <span>{labels.page(currentPage, totalPages)}</span>
      <button
        type="button"
        disabled={props.loading || currentPage >= totalPages}
        onClick={() => props.onPage(currentPage + 1)}
      >
        {labels.nextPage}
      </button>
    </div>
  );
}

function AdminDetailSheet(props: {
  detail: SelectedAdminDetail;
  text: ManagedMobileText;
  onClose: () => void;
}) {
  const labels = props.text.account.adminWorkspace;
  return (
    <div
      className={styles["admin-detail-backdrop"]}
      role="presentation"
      onMouseDown={props.onClose}
    >
      <section
        className={styles["admin-detail-sheet"]}
        role="dialog"
        aria-modal="true"
        aria-label={props.detail.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles["admin-detail-header"]}>
          <div>
            <span>{labels.details}</span>
            <h2>{props.detail.title}</h2>
          </div>
          <button type="button" onClick={props.onClose}>
            {labels.closeDetails}
          </button>
        </div>
        {props.detail.loading && (
          <p className={styles["empty-copy"]}>{labels.loading}</p>
        )}
        {props.detail.error && (
          <div className={styles["form-error"]}>{props.detail.error}</div>
        )}
        {!props.detail.loading && !props.detail.error && (
          <div className={styles["admin-detail-content"]}>
            {props.detail.sections.map((section) => {
              const fields = detailEntries(section.data, props.text);
              return (
                <section
                  className={styles["admin-detail-section"]}
                  key={section.title}
                >
                  <h3>{section.title}</h3>
                  {fields.length ? (
                    <dl>
                      {fields.map((field) => (
                        <div key={field.key}>
                          <dt>{field.key}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className={styles["empty-copy"]}>{labels.empty}</p>
                  )}
                </section>
              );
            })}
            <p className={styles["admin-protected-hint"]}>
              {labels.protectedActionHint}
            </p>
          </div>
        )}
      </section>
    </div>
  );
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
  page?: MobileAdminPage<AdminRecord>;
  loading?: boolean;
  onPage?: (nextPage: number) => void;
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
      {props.page && props.onPage && (
        <AdminPageControls
          page={props.page}
          text={props.text}
          loading={Boolean(props.loading)}
          onPage={props.onPage}
        />
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
  const [appliedSearch, setAppliedSearch] = useState("");
  const [compliance, setCompliance] =
    useState<MobileAdminComplianceStatus | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [compliancePhrase, setCompliancePhrase] = useState("");
  const [complianceMessage, setComplianceMessage] = useState("");
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpMessage, setStepUpMessage] = useState("");
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [pages, setPages] =
    useState<Record<AdminPageKey, number>>(INITIAL_PAGES);
  const [selectedDetail, setSelectedDetail] =
    useState<SelectedAdminDetail | null>(null);

  const client = useMemo(() => props.client, [props.client]);
  const complianceSupported = isMobileAdminComplianceAvailable(
    client.mobileProtocol,
  );

  const refreshCompliance = useCallback(
    async (signal?: AbortSignal) => {
      if (!complianceSupported) {
        const legacyStatus: MobileAdminComplianceStatus = {
          required: false,
          version: "",
        };
        setCompliance(legacyStatus);
        setComplianceLoading(false);
        return legacyStatus;
      }
      setComplianceLoading(true);
      try {
        const result = await getMobileAdminComplianceStatus(client, {
          signal,
          locale: props.text.dateLocale,
        });
        if (signal?.aborted) return null;
        setCompliance(result.data);
        setRequestId(result.requestId);
        return result.data;
      } catch (caught) {
        if (signal?.aborted) return null;
        setCompliance(null);
        setError(caught instanceof Error ? caught.message : labels.unavailable);
        setRequestId(mobileAdminRequestId(caught));
        return null;
      } finally {
        if (!signal?.aborted) setComplianceLoading(false);
      }
    },
    [client, complianceSupported, labels.unavailable, props.text.dateLocale],
  );

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
            {
              page: pages.users,
              page_size: 20,
              search: appliedSearch,
            },
            { signal, locale: props.text.dateLocale },
          );
          setData((current) => ({ ...current, users: result.data }));
          setRequestId(result.requestId);
        } else if (nextView === "operations") {
          const [groups, models, usage, cleanup, tickets] = await Promise.all([
            listMobileAdminGroups<AdminRecord>(
              client,
              { page: pages.groups, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminModelCatalog<AdminRecord>(client, undefined, {
              signal,
              locale: props.text.dateLocale,
            }),
            listMobileAdminUsage<AdminRecord>(
              client,
              { page: pages.usage, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminUsageCleanupTasks<AdminRecord>(
              client,
              { page: pages.cleanup, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
            listMobileAdminMobileFeedback<AdminRecord>(
              client,
              { page: pages.tickets, page_size: 20 },
              { signal, locale: props.text.dateLocale },
            ),
          ]);
          setData((current) => ({
            ...current,
            groups: groups.data,
            models: array(models.data).map(record),
            usage: usage.data,
            cleanup: cleanup.data,
            tickets: tickets.data,
          }));
          setRequestId(
            tickets.requestId ||
              cleanup.requestId ||
              usage.requestId ||
              groups.requestId,
          );
        } else if (nextView === "funds") {
          const [orders, subscriptions, withdrawals, refunds] =
            await Promise.all([
              listMobileAdminOrders<AdminRecord>(
                client,
                { page: pages.orders, page_size: 20 },
                { signal, locale: props.text.dateLocale },
              ),
              listMobileAdminSubscriptions<AdminRecord>(
                client,
                { page: pages.subscriptions, page_size: 20 },
                { signal, locale: props.text.dateLocale },
              ),
              listMobileAdminWithdrawals<AdminRecord>(
                client,
                { page: pages.withdrawals, page_size: 20 },
                { signal, locale: props.text.dateLocale },
              ),
              listMobileAdminRefundRequests<AdminRecord>(
                client,
                { page: pages.refunds, page_size: 20 },
                { signal, locale: props.text.dateLocale },
              ),
            ]);
          setData((current) => ({
            ...current,
            orders: orders.data,
            subscriptions: subscriptions.data,
            withdrawals: withdrawals.data,
            refunds: refunds.data,
          }));
          setRequestId(
            refunds.requestId ||
              withdrawals.requestId ||
              subscriptions.requestId ||
              orders.requestId,
          );
        } else {
          const result = await listMobileAdminAuditLogs<AdminRecord>(
            client,
            { page: pages.audit, page_size: 30 },
            { signal, locale: props.text.dateLocale },
          );
          setData((current) => ({ ...current, audit: result.data }));
          setRequestId(result.requestId);
        }
      } catch (caught) {
        if (signal?.aborted) return;
        const requiredCompliance = requiredComplianceFromError(caught);
        if (requiredCompliance && complianceSupported) {
          setCompliance(requiredCompliance);
          setError("");
          void refreshCompliance();
        } else {
          setError(
            caught instanceof Error ? caught.message : labels.unavailable,
          );
        }
        setRequestId(mobileAdminRequestId(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      appliedSearch,
      client,
      complianceSupported,
      labels.unavailable,
      pages,
      props.text.dateLocale,
      refreshCompliance,
    ],
  );

  const loadView = useCallback(
    async (nextView: AdminView, signal?: AbortSignal) => {
      const status = await refreshCompliance(signal);
      if (signal?.aborted || !status || status.required) return;
      await load(nextView, signal);
    },
    [load, refreshCompliance],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadView(view, controller.signal);
    return () => controller.abort();
  }, [loadView, view]);

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

  async function inspectRecord(kind: AdminDetailKind, source: AdminRecord) {
    const title = recordTitle(source, labels.details);
    const selected: SelectedAdminDetail = {
      kind,
      title,
      source,
      sections: [{ title: labels.sourceRecord, data: source }],
      loading: true,
    };
    setSelectedDetail(selected);

    const id = recordID(source);
    if (!id || ["model", "usage", "cleanup"].includes(kind)) {
      setSelectedDetail({ ...selected, loading: false });
      return;
    }

    const options = { locale: props.text.dateLocale };
    try {
      let sections: AdminDetailSection[] = [];
      let nextRequestId = "";

      if (kind === "user") {
        const [user, usage, history, reconciliation, subscriptions] =
          await Promise.all([
            getMobileAdminUser(client, id, options),
            getMobileAdminUserUsage(client, id, { period: "month" }, options),
            getMobileAdminUserWalletHistory(
              client,
              id,
              { page: 1, page_size: 20 },
              options,
            ),
            getMobileAdminUserWalletReconciliation(client, id, options),
            listMobileAdminUserSubscriptions(
              client,
              id,
              { page: 1, page_size: 20 },
              options,
            ),
          ]);
        sections = [
          { title: labels.userDetails, data: user.data },
          { title: labels.usage, data: usage.data },
          { title: labels.reconciliation, data: reconciliation.data },
          { title: labels.balanceHistory, data: history.data },
          { title: labels.subscriptions, data: subscriptions.data },
        ];
        nextRequestId =
          subscriptions.requestId ||
          reconciliation.requestId ||
          history.requestId ||
          usage.requestId ||
          user.requestId;
      } else if (kind === "order") {
        const order = await getMobileAdminOrder(client, id, options);
        sections = [{ title: labels.orderDetails, data: order.data }];
        nextRequestId = order.requestId;
        const subscriptionID = String(
          first(record(order.data), ["subscription_id"]),
        ).trim();
        if (/^[1-9]\d*$/.test(subscriptionID)) {
          const [subscription, progress] = await Promise.all([
            getMobileAdminSubscription(client, subscriptionID, options),
            getMobileAdminSubscriptionProgress(client, subscriptionID, options),
          ]);
          sections.push(
            { title: labels.subscriptions, data: subscription.data },
            { title: labels.subscriptionProgress, data: progress.data },
          );
          nextRequestId =
            progress.requestId || subscription.requestId || nextRequestId;
        }
      } else if (kind === "subscription") {
        const [subscription, progress] = await Promise.all([
          getMobileAdminSubscription(client, id, options),
          getMobileAdminSubscriptionProgress(client, id, options),
        ]);
        sections = [
          { title: labels.subscriptionDetails, data: subscription.data },
          { title: labels.subscriptionProgress, data: progress.data },
        ];
        nextRequestId = progress.requestId || subscription.requestId;
      } else if (kind === "group") {
        const [group, stats] = await Promise.all([
          getMobileAdminGroup(client, id, options),
          getMobileAdminGroupStats(client, id, options),
        ]);
        sections = [
          { title: labels.groupDetails, data: group.data },
          { title: labels.groupStats, data: stats.data },
        ];
        nextRequestId = stats.requestId || group.requestId;
      } else if (kind === "withdrawal") {
        const withdrawal = await getMobileAdminWithdrawal(client, id, options);
        sections = [{ title: labels.withdrawalDetails, data: withdrawal.data }];
        nextRequestId = withdrawal.requestId;
      } else if (kind === "refund") {
        const refund = await getMobileAdminRefundRequest(client, id, options);
        sections = [{ title: labels.refundDetails, data: refund.data }];
        nextRequestId = refund.requestId;
      } else if (kind === "ticket") {
        const ticket = await getMobileAdminMobileFeedback(client, id, options);
        sections = [{ title: labels.ticketDetails, data: ticket.data }];
        nextRequestId = ticket.requestId;
      } else if (kind === "audit") {
        const audit = await getMobileAdminAuditLog(client, id, options);
        sections = [{ title: labels.auditDetails, data: audit.data }];
        nextRequestId = audit.requestId;
      }

      setSelectedDetail({ ...selected, sections, loading: false });
      setRequestId(nextRequestId);
    } catch (caught) {
      const requiredCompliance = requiredComplianceFromError(caught);
      if (requiredCompliance && complianceSupported) {
        setCompliance(requiredCompliance);
        setSelectedDetail(null);
        void refreshCompliance();
        setRequestId(mobileAdminRequestId(caught));
        return;
      }
      setSelectedDetail({
        ...selected,
        loading: false,
        error: caught instanceof Error ? caught.message : labels.unavailable,
      });
      setRequestId(mobileAdminRequestId(caught));
    }
  }

  const complianceLanguage = props.text.dateLocale.startsWith("zh")
    ? "zh"
    : "en";
  const expectedCompliancePhrase =
    complianceLanguage === "zh"
      ? compliance?.ack_phrase_zh || ""
      : compliance?.ack_phrase_en || "";
  const complianceDocumentUrl =
    complianceLanguage === "zh"
      ? compliance?.document_url_zh || ""
      : compliance?.document_url_en || "";

  async function submitCompliance() {
    if (
      !compliancePhrase.trim() ||
      (expectedCompliancePhrase &&
        compliancePhrase.trim() !== expectedCompliancePhrase)
    ) {
      setComplianceMessage(labels.compliancePhraseRequired);
      return;
    }
    setComplianceBusy(true);
    setComplianceMessage("");
    try {
      const result = await acceptMobileAdminCompliance(
        client,
        {
          phrase: compliancePhrase,
          language: complianceLanguage,
        },
        {
          locale: props.text.dateLocale,
          idempotencyKey: `mobile-admin-compliance-${
            compliance?.version || "current"
          }-${complianceLanguage}`,
        },
      );
      setCompliance(result.data);
      setCompliancePhrase("");
      setComplianceMessage(labels.complianceAccepted);
      setRequestId(result.requestId);
      if (!result.data.required) await load(view);
    } catch (caught) {
      const code = mobileAdminErrorCode(caught).toUpperCase();
      setComplianceMessage(
        code === "ADMIN_COMPLIANCE_INVALID_PHRASE"
          ? labels.compliancePhraseRequired
          : caught instanceof Error
          ? caught.message
          : labels.complianceUnavailable,
      );
      setRequestId(mobileAdminRequestId(caught));
    } finally {
      setComplianceBusy(false);
    }
  }

  async function openComplianceDocument() {
    if (!complianceDocumentUrl) {
      setComplianceMessage(labels.complianceUnavailable);
      return;
    }
    try {
      await openExternalUrl(complianceDocumentUrl);
    } catch {
      setComplianceMessage(labels.complianceUnavailable);
    }
  }

  function changePage(key: AdminPageKey, nextPage: number) {
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    setPages((current) =>
      current[key] === nextPage ? current : { ...current, [key]: nextPage },
    );
  }

  function submitUserSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = search.trim();
    if (nextSearch === appliedSearch) {
      void loadView("users");
      return;
    }
    setPages((current) => ({ ...current, users: 1 }));
    setAppliedSearch(nextSearch);
  }

  const snapshot = record(data.snapshot);
  const overview = record(snapshot.overview || snapshot.data || snapshot);
  const payment = record(data.payment);
  const users = data.users || page(undefined);

  if (complianceLoading) {
    return (
      <div className={styles["admin-workspace"]}>
        <p className={styles["admin-readonly-hint"]}>{labels.readonlyHint}</p>
        <p className={styles["empty-copy"]}>{labels.complianceChecking}</p>
      </div>
    );
  }

  if (!compliance) {
    return (
      <div className={styles["admin-workspace"]}>
        <p className={styles["admin-readonly-hint"]}>{labels.readonlyHint}</p>
        <div className={styles["form-error"]}>
          {error || labels.complianceUnavailable}
        </div>
        <div className={styles["admin-toolbar"]}>
          <button type="button" onClick={() => void loadView(view)}>
            {labels.refresh}
          </button>
        </div>
        {requestId && (
          <small className={styles["admin-request-id"]}>
            {labels.request}: {requestId}
          </small>
        )}
      </div>
    );
  }

  if (compliance.required) {
    return (
      <div className={styles["admin-workspace"]}>
        <p className={styles["admin-readonly-hint"]}>{labels.readonlyHint}</p>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{labels.compliance}</h2>
            {compliance.version && <span>{compliance.version}</span>}
          </div>
          <p className={styles["empty-copy"]}>
            {labels.complianceRequiredHint}
          </p>
          <button
            type="button"
            onClick={() => void openComplianceDocument()}
            disabled={!complianceDocumentUrl}
          >
            {labels.complianceDocument}
          </button>
          {expectedCompliancePhrase && (
            <p className={styles["admin-request-id"]}>
              {expectedCompliancePhrase}
            </p>
          )}
          <label className={styles["field-card"]}>
            <span>{labels.compliancePhraseHint}</span>
            <textarea
              value={compliancePhrase}
              onChange={(event) =>
                setCompliancePhrase(event.currentTarget.value)
              }
              placeholder={labels.compliancePhraseHint}
              rows={3}
            />
          </label>
          <div className={styles["dialog-actions"]}>
            <button
              type="button"
              onClick={() => void submitCompliance()}
              disabled={
                complianceBusy ||
                !expectedCompliancePhrase ||
                compliancePhrase.trim() !== expectedCompliancePhrase
              }
            >
              {complianceBusy ? labels.loading : labels.complianceAccept}
            </button>
            <button type="button" onClick={() => void loadView(view)}>
              {labels.refresh}
            </button>
          </div>
          {complianceMessage && (
            <p className={styles["form-error"]}>{complianceMessage}</p>
          )}
        </section>
        {requestId && (
          <small className={styles["admin-request-id"]}>
            {labels.request}: {requestId}
          </small>
        )}
      </div>
    );
  }

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
          onClick={() => void loadView(view)}
          disabled={loading || complianceLoading}
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
            <form
              onSubmit={submitUserSearch}
              className={styles["admin-toolbar"]}
            >
              <label className={styles["field-card"]}>
                <span>{labels.userSearch}</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder={labels.userSearch}
                />
              </label>
              <button type="submit" disabled={loading}>
                {labels.search}
              </button>
            </form>
          </section>
          <AdminList
            title={`${labels.users} · ${users.total}`}
            items={users.items}
            text={props.text}
            empty={labels.noUsers}
            onSelect={(user) => void inspectRecord("user", user)}
            page={users}
            loading={loading}
            onPage={(nextPage) => changePage("users", nextPage)}
          />
        </>
      )}

      {view === "operations" && (
        <>
          <AdminList
            title={labels.groups}
            items={data.groups?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(group) => void inspectRecord("group", group)}
            page={data.groups}
            loading={loading}
            onPage={(nextPage) => changePage("groups", nextPage)}
          />
          <AdminList
            title={labels.models}
            items={data.models || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(model) => void inspectRecord("model", model)}
          />
          <AdminList
            title={labels.usage}
            items={data.usage?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(usage) => void inspectRecord("usage", usage)}
            page={data.usage}
            loading={loading}
            onPage={(nextPage) => changePage("usage", nextPage)}
          />
          <AdminList
            title={labels.cleanup}
            items={data.cleanup?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(task) => void inspectRecord("cleanup", task)}
            page={data.cleanup}
            loading={loading}
            onPage={(nextPage) => changePage("cleanup", nextPage)}
          />
          <AdminList
            title={labels.tickets}
            items={data.tickets?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(ticket) => void inspectRecord("ticket", ticket)}
            page={data.tickets}
            loading={loading}
            onPage={(nextPage) => changePage("tickets", nextPage)}
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
            onSelect={(order) => void inspectRecord("order", order)}
            page={data.orders}
            loading={loading}
            onPage={(nextPage) => changePage("orders", nextPage)}
          />
          <AdminList
            title={labels.subscriptions}
            items={data.subscriptions?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(subscription) =>
              void inspectRecord("subscription", subscription)
            }
            page={data.subscriptions}
            loading={loading}
            onPage={(nextPage) => changePage("subscriptions", nextPage)}
          />
          <AdminList
            title={labels.withdrawals}
            items={data.withdrawals?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(withdrawal) =>
              void inspectRecord("withdrawal", withdrawal)
            }
            page={data.withdrawals}
            loading={loading}
            onPage={(nextPage) => changePage("withdrawals", nextPage)}
          />
          <AdminList
            title={labels.refunds}
            items={data.refunds?.items || []}
            text={props.text}
            empty={labels.empty}
            onSelect={(refund) => void inspectRecord("refund", refund)}
            page={data.refunds}
            loading={loading}
            onPage={(nextPage) => changePage("refunds", nextPage)}
          />
        </>
      )}

      {view === "audit" && (
        <AdminList
          title={labels.auditLogs}
          items={data.audit?.items || []}
          text={props.text}
          empty={labels.empty}
          onSelect={(audit) => void inspectRecord("audit", audit)}
          page={data.audit}
          loading={loading}
          onPage={(nextPage) => changePage("audit", nextPage)}
        />
      )}

      {selectedDetail && (
        <AdminDetailSheet
          detail={selectedDetail}
          text={props.text}
          onClose={() => setSelectedDetail(null)}
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
