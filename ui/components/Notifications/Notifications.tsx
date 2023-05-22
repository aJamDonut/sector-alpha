import { useNotifications } from "@ui/atoms";
import React from "react";
import { Notification } from "./Notification";
import { NotificationContainer } from "./NotificationContainer";

export const Notifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <NotificationContainer>
      {notifications.map(({ id, onClick, ...props }) => (
        <Notification
          key={id}
          onClick={() => {
            onClick();
            removeNotification(id);
          }}
          {...props}
        />
      ))}
    </NotificationContainer>
  );
};
