import React from "react";
import SVG from "react-inlinesvg";
import clsx from "clsx";
import arrowLeftIcon from "@assets/ui/arrow_left.svg";
import { Button } from "@kit/Button";
import { IconButton } from "@kit/IconButton";
import styles from "./JSONOutput.scss";
import { useThrottledFormState } from "../../utils";

export const JSONOutput: React.FC<{
  expanded: boolean;
  onExpand: () => void;
  fn: (_data) => any;
}> = ({ expanded, onExpand, fn }) => {
  const data = useThrottledFormState<FormData>();
  const display = React.useMemo(
    () => (data ? JSON.stringify(fn(data)) : null),
    [data]
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <IconButton onClick={onExpand}>
          <SVG
            src={arrowLeftIcon}
            className={clsx({
              [styles.rotate]: expanded,
            })}
          />
        </IconButton>
        <Button
          onClick={() => {
            navigator.clipboard.writeText(display!);
          }}
        >
          Copy
        </Button>
      </div>
      {/* @ts-expect-error */}
      {expanded && <json-viewer data={display} />}
    </div>
  );
};
