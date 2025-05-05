import { Alert, Anchor } from "@mantine/core"
import { canonical, getLocalStorageCopy } from "../utilities"
import FontAwesome from "./FontAwesome"

const MigrationStart = () => {
  if (
    window.location.host === canonical ||
    window.location.hostname === "localhost"
  ) {
    return <></>
  }

  return (
    <Alert
      flex="none"
      mt="xs"
      color="yellow"
      icon={<FontAwesome icon="exclamation" />}
    >
      <p>
        האתר עבר לכתובת אחרת!{" "}
        <Anchor
          fz="inherit"
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(getLocalStorageCopy()))
            window.location.href = `https://${canonical}/finish-migration`
          }}
        >
          אנא לחצו כאן כדי להעביר את הנתונים.
        </Anchor>
      </p>
    </Alert>
  )
}

export default MigrationStart
