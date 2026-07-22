"use client";

import React from "react";
import { IconButton } from "./button";
import GithubIcon from "../icons/github.svg";
import ResetIcon from "../icons/reload.svg";
import { ISSUE_URL } from "../constant";
import Locale from "../locales";
import { showConfirm } from "./ui-lib";
import { useSyncStore } from "../store/sync";
import { useChatStore } from "../store/chat";
import { getClientConfig } from "../config/client";
import {
  JISUDENG_DASHBOARD_URL,
  resolveManagedWorkspaceURL,
  useManagedWorkspaceStore,
} from "../store/managed-workspace";
import { ManagedWorkspaceStatePage } from "./managed-workspace-state";

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
  diagnosticId: string;
}

export class ErrorBoundary extends React.Component<any, IErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null, diagnosticId: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Update state with error details
    this.setState({
      hasError: true,
      error,
      info,
      diagnosticId: createManagedDiagnosticId(),
    });
  }

  clearAndSaveData() {
    try {
      useSyncStore.getState().export();
    } finally {
      useChatStore.getState().clearAllData();
    }
  }

  render() {
    if (this.state.hasError) {
      const managedMode = !!getClientConfig()?.sub2apiManagedMode;
      const managedBootstrap = useManagedWorkspaceStore.getState().bootstrap;
      const supportContact = managedMode
        ? managedBootstrap?.support_contact
        : undefined;
      const returnUrl = resolveManagedWorkspaceURL(
        managedBootstrap?.urls?.return_url,
        JISUDENG_DASHBOARD_URL,
      );

      if (managedMode) {
        return (
          <ManagedWorkspaceStatePage
            title="工作台发生错误"
            subtitle="当前工作台状态没有完全恢复。请先重新加载，仍然失败时返回控制台或联系人工客服。"
            error={this.state.error?.message || this.state.error?.toString()}
            diagnosticId={this.state.diagnosticId || "managed-runtime-error"}
            supportContact={supportContact}
            primaryAction={{
              label: "重新加载",
              onClick: () => window.location.reload(),
            }}
            secondaryAction={{
              label: "返回控制台",
              onClick: () => window.location.replace(returnUrl),
            }}
          />
        );
      }

      // Render error message
      return (
        <div className="error">
          <h2>Oops, something went wrong!</h2>
          <pre>
            <code>{this.state.error?.toString()}</code>
            <code>{this.state.info?.componentStack}</code>
          </pre>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <a href={ISSUE_URL} className="report">
              <IconButton
                text="Report This Error"
                icon={<GithubIcon />}
                bordered
              />
            </a>
            <IconButton
              icon={<ResetIcon />}
              text="Clear All Data"
              onClick={async () => {
                if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
                  this.clearAndSaveData();
                }
              }}
              bordered
            />
          </div>
        </div>
      );
    }
    // if no error occurred, render children
    return this.props.children;
  }
}

function createManagedDiagnosticId() {
  return `managed-runtime-${Date.now().toString(36)}`;
}
