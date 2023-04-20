import clsx from "clsx";
import React from "react";
import styles from "./Text.scss";

export type TextColor =
  | "default"
  | "disabled"
  | "text-1"
  | "text-2"
  | "text-3"
  | "text-4"
  | "text-5";
export type TextVariant =
  | "default"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "caption";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  color?: TextColor;
  variant?: TextVariant;
}

const Components: Record<TextVariant, React.ElementType> = {
  default: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  caption: "small",
};

const Text: React.FC<TextProps> = ({
  color = "default",
  variant = "default",
  className,
  ...props
}) => {
  const Component = Components[variant];

  return (
    <Component
      className={clsx(className, styles.root, {
        [styles.defaultFont]: variant === "default",
        [styles.h1]: variant === "h1",
        [styles.h2]: variant === "h2",
        [styles.h3]: variant === "h3",
        [styles.h4]: variant === "h4",
        [styles.h5]: variant === "h5",
        [styles.h6]: variant === "h6",
        [styles.caption]: variant === "caption",
        [styles.colorDefault]: color === "default",
        [styles.colorDisabled]: color === "disabled",
      })}
      style={
        [1, 2, 3, 4, 5].map((v) => `text-${v}`).includes(color)
          ? { color: `var(--palette-text-${color.split("text-")[1]})` }
          : {}
      }
      {...props}
    />
  );
};

Text.displayName = "Text";
export default Text;
