import { notifications } from "@mantine/notifications"
import FontAwesome from "./components/FontAwesome"

export const showSuccessMessage = (successMessage: string) => {
  notifications.show({
    title: "הפעולה בוצעה בהצלחה!",
    color: "green",
    icon: <FontAwesome icon="check" />,
    message: successMessage,
  })
}

export const showFailureMessage = (failureMessage: string) => {
  notifications.show({
    title: "שגיאה!",
    color: "red",
    icon: <FontAwesome icon="exclamation" />,
    message: failureMessage,
  })
}

export const showSuccessOrFailure = async (
  p: Promise<boolean>,
  successMessage: string,
  failureMessage: string,
) => {
  const success = await p
  if (success) {
    showSuccessMessage(successMessage)
  } else {
    showFailureMessage(failureMessage)
  }
  return success
}
