/* eslint-disable @next/next/no-img-element */
import clsx from "clsx";
import CopyIcon from "../icons/copy.svg";
import HeadphoneIcon from "../icons/headphone.svg";
import ReturnIcon from "../icons/return.svg";
import { copyToClipboard } from "../utils";
import {
  enabledSupportContacts,
  normalizeSupportContactConfig,
  primaryQRCodeContacts,
  sanitizeSupportContactImage,
  supportContactActionUrl,
  supportContactCopyValue,
  supportContactDisplayValue,
} from "../utils/support-contact";
import type {
  SupportContactConfig,
  SupportContactMethod,
} from "../utils/support-contact";
import styles from "./managed-support-contact.module.scss";

export function ManagedSupportContact(props: {
  config?: SupportContactConfig | null;
  compact?: boolean;
  showHeader?: boolean;
  className?: string;
}) {
  const showHeader = props.showHeader ?? true;
  const config = normalizeSupportContactConfig(props.config);
  const contacts = enabledSupportContacts(config);
  const primaryContacts = primaryQRCodeContacts(config);
  const primaryIds = new Set(primaryContacts.map((contact) => contact.id));
  const secondaryContacts = contacts.filter(
    (contact) => !primaryIds.has(contact.id),
  );

  if (contacts.length === 0) return null;

  return (
    <section
      className={clsx(
        styles.panel,
        props.compact && styles.compact,
        props.className,
      )}
    >
      {showHeader ? (
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>
              <HeadphoneIcon />
            </span>
            <h3>{config.title}</h3>
          </div>
          {config.subtitle ? <p>{config.subtitle}</p> : null}
        </div>
      ) : null}

      {primaryContacts.length > 0 ? (
        <div className={styles.qrGrid}>
          {primaryContacts.map((contact) => (
            <SupportQRCodeCard key={contact.id} contact={contact} />
          ))}
        </div>
      ) : null}

      {secondaryContacts.length > 0 ? (
        <div
          className={clsx(
            styles.more,
            primaryContacts.length > 0 && styles.moreWithPrimary,
          )}
        >
          {primaryContacts.length > 0 ? (
            <div className={styles.moreTitle}>更多联系方式</div>
          ) : null}
          {secondaryContacts.map((contact) => (
            <SupportContactRow key={contact.id} contact={contact} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SupportQRCodeCard(props: { contact: SupportContactMethod }) {
  const contact = props.contact;
  const image = sanitizeSupportContactImage(contact.qr_image);
  const copyValue = supportContactCopyValue(contact);
  const url = supportContactActionUrl(contact);
  const value = supportContactDisplayValue(contact);

  return (
    <article className={styles.qrCard}>
      <div className={styles.qrImage}>
        <img src={image} alt={contact.label} />
      </div>
      <div className={styles.contactMeta}>
        <div className={styles.contactNameLine}>
          <span>{contactTypeLabel(contact.type)}</span>
          <strong>{contact.label}</strong>
        </div>
        {value ? <code>{value}</code> : null}
        {contact.description ? <p>{contact.description}</p> : null}
      </div>
      <div className={styles.actions}>
        {copyValue ? (
          <button
            type="button"
            aria-label={`复制 ${contact.label}`}
            onClick={() => copyToClipboard(copyValue)}
          >
            <CopyIcon />
            复制
          </button>
        ) : null}
        {url ? (
          <button
            type="button"
            aria-label={`打开 ${contact.label}`}
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <ReturnIcon />
            打开
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SupportContactRow(props: { contact: SupportContactMethod }) {
  const contact = props.contact;
  const copyValue = supportContactCopyValue(contact);
  const url = supportContactActionUrl(contact);
  const value = supportContactDisplayValue(contact);

  return (
    <div className={styles.contactRow}>
      <div className={styles.rowIcon}>{contactTypeLabel(contact.type)}</div>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>
          <strong>{contact.label}</strong>
          <span>{contactTypeLabel(contact.type)}</span>
        </div>
        {value ? <code>{value}</code> : null}
        {contact.description ? <p>{contact.description}</p> : null}
      </div>
      <div className={styles.rowActions}>
        {copyValue ? (
          <button
            type="button"
            title="复制"
            aria-label={`复制 ${contact.label}`}
            onClick={() => copyToClipboard(copyValue)}
          >
            <CopyIcon />
          </button>
        ) : null}
        {url ? (
          <button
            type="button"
            title="打开"
            aria-label={`打开 ${contact.label}`}
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <ReturnIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function contactTypeLabel(type: string) {
  switch (type) {
    case "wechat":
      return "微信";
    case "qq":
      return "QQ";
    case "telegram":
      return "TG";
    case "email":
      return "邮箱";
    case "docs":
      return "文档";
    default:
      return "客服";
  }
}
