"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import LoadingIcon from "../icons/three-dots.svg";
import type { SupportContactConfig } from "../utils/support-contact";
import { withBasePath } from "../utils/api-path";
import { ManagedBrandLogo } from "./managed-brand";
import { ManagedSupportContact } from "./managed-support-contact";
import styles from "./managed-workspace-state.module.scss";

type ManagedWorkspaceStateAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

function useManagedPublicSupportContact(fallback?: SupportContactConfig) {
  const [supportContact, setSupportContact] = useState<
    SupportContactConfig | undefined
  >(fallback);

  useEffect(() => {
    if (fallback) setSupportContact(fallback);

    const controller = new AbortController();
    fetch(withBasePath("/api/nextchat/public-settings"), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => {
        if (body?.support_contact) setSupportContact(body.support_contact);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("[Sub2API Managed] support contact load failed", error);
        }
      });
    return () => controller.abort();
  }, [fallback]);

  return supportContact;
}

export function ManagedWorkspaceStatePage(props: {
  title: string;
  subtitle: string;
  error?: string;
  loading?: boolean;
  diagnosticId?: string;
  supportContact?: SupportContactConfig;
  primaryAction?: ManagedWorkspaceStateAction;
  secondaryAction?: ManagedWorkspaceStateAction;
}) {
  const supportContact = useManagedPublicSupportContact(props.supportContact);

  return (
    <main className={clsx("no-dark", styles["managed-state-page"])}>
      <div className={styles["managed-state-logo"]}>
        <ManagedBrandLogo large />
      </div>
      <h1 className={styles["managed-state-title"]}>{props.title}</h1>
      <p className={styles["managed-state-subtitle"]}>{props.subtitle}</p>

      {props.loading ? (
        <div
          className={styles["managed-state-loading"]}
          role="status"
          aria-live="polite"
        >
          <LoadingIcon />
        </div>
      ) : null}

      {props.error ? (
        <div className={styles["managed-state-error"]} role="alert">
          {props.error}
        </div>
      ) : null}

      {props.diagnosticId ? (
        <p className={styles["managed-state-diagnostic"]}>
          诊断编号：<code>{props.diagnosticId}</code>
        </p>
      ) : null}

      <div className={styles["managed-state-actions"]}>
        {props.primaryAction ? (
          <button
            className={styles["managed-state-primary"]}
            disabled={props.primaryAction.disabled}
            onClick={props.primaryAction.onClick}
          >
            {props.primaryAction.label}
          </button>
        ) : null}
        {props.secondaryAction ? (
          <button
            className={styles["managed-state-secondary"]}
            disabled={props.secondaryAction.disabled}
            onClick={props.secondaryAction.onClick}
          >
            {props.secondaryAction.label}
          </button>
        ) : null}
      </div>

      <ManagedSupportContact
        config={supportContact}
        compact
        className={styles["managed-state-support"]}
      />
    </main>
  );
}
