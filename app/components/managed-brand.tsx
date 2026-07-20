import clsx from "clsx";
import styles from "./managed-brand.module.scss";

export function ManagedBrandLogo(props: {
  compact?: boolean;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        styles["brand-logo"],
        {
          [styles.compact]: props.compact,
          [styles.large]: props.large,
        },
        props.className,
      )}
      aria-label="极速蹬"
    >
      J
    </div>
  );
}
